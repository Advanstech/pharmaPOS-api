import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { GLPostingService } from '../accounting/gl-posting.service';
import { SalesEffectiveAtService } from './sales-effective-at.service';

export interface CloseRegisterInput {
  businessDate: string;          // YYYY-MM-DD (Accra calendar day)
  cashCountedPesewas: number;
  momoCountedPesewas: number;
  closingNotes?: string;
}

export interface EodRecord {
  id: string;
  branchId: string;
  branchName: string;
  cashierName: string;
  businessDate: string;
  totalSalesCount: number;
  grossRevenuePesewas: number;
  grossRevenueFormatted: string;
  vatCollectedPesewas: number;
  vatCollectedFormatted: string;
  refundsCount: number;
  refundsPesewas: number;
  refundsFormatted: string;
  expensesCount: number;
  expensesPesewas: number;
  expensesFormatted: string;
  netRevenuePesewas: number;
  netRevenueFormatted: string;
  expectedCashPesewas: number;
  expectedCashFormatted: string;
  cashCountedPesewas: number;
  cashCountedFormatted: string;
  momoCountedPesewas: number;
  momoCountedFormatted: string;
  totalCountedPesewas: number;
  totalCountedFormatted: string;
  variancePesewas: number;
  varianceFormatted: string;
  isBalanced: boolean;
  closingNotes: string | null;
  closedAt: Date;
  approvalStatus: string;
  approvedByName: string | null;
  approvedAt: Date | null;
  managerNotes: string | null;
}

@Injectable()
export class EodService {
  private readonly logger = new Logger(EodService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly glPosting: GLPostingService,
    private readonly effectiveSaleAt: SalesEffectiveAtService,
  ) {}

  private fmt(pesewas: number): string {
    return `GH₵${(pesewas / 100).toFixed(2)}`;
  }

  // ── Close Register ────────────────────────────────────────────────────────

  async closeRegister(input: CloseRegisterInput, actor: JwtUser): Promise<EodRecord> {
    // Any authenticated staff can close their own register
    const { businessDate, cashCountedPesewas, momoCountedPesewas, closingNotes } = input;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
      throw new BadRequestException('businessDate must be YYYY-MM-DD');
    }

    // Check not already closed for this cashier+branch+date
    const [existing] = await this.dataSource.query(
      `SELECT id FROM end_of_day_records WHERE branch_id = $1 AND cashier_id = $2 AND business_date = $3`,
      [actor.branchId, actor.sub, businessDate],
    ) as Array<{ id: string }>;

    if (existing) {
      throw new BadRequestException(`You have already submitted an end-of-day record for ${businessDate}.`);
    }

    const at = this.effectiveSaleAt.sql('s');
    const saleAccraDay = `(${at} AT TIME ZONE 'Africa/Accra')::date`;

    // Snapshot today's sales
    const [salesRow] = await this.dataSource.query(`
      SELECT
        COUNT(CASE WHEN s.status = 'COMPLETED' THEN 1 END)::int AS sales_count,
        COALESCE(SUM(CASE WHEN s.status = 'COMPLETED' THEN s.total_amount END), 0)::bigint AS gross_revenue,
        COALESCE(SUM(CASE WHEN s.status = 'COMPLETED' THEN s.vat_amount END), 0)::bigint AS vat_collected,
        COUNT(CASE WHEN s.status = 'REFUNDED' THEN 1 END)::int AS refunds_count,
        COALESCE(SUM(CASE WHEN s.status = 'REFUNDED' THEN s.total_amount END), 0)::bigint AS refunds_pesewas
      FROM sales s
      WHERE s.branch_id = $1
        AND ${saleAccraDay} = $2::date
    `, [actor.branchId, businessDate]) as Array<{
      sales_count: number; gross_revenue: number; vat_collected: number;
      refunds_count: number; refunds_pesewas: number;
    }>;

    // Snapshot today's approved expenses
    const [expRow] = await this.dataSource.query(`
      SELECT
        COUNT(*)::int AS expenses_count,
        COALESCE(SUM(amount_pesewas), 0)::bigint AS expenses_pesewas
      FROM expenses
      WHERE branch_id = $1
        AND expense_date::date = $2::date
        AND status IN ('APPROVED', 'REIMBURSED')
    `, [actor.branchId, businessDate]) as Array<{ expenses_count: number; expenses_pesewas: number }>;

    const grossRevenue = Number(salesRow?.gross_revenue ?? 0);
    const vatCollected = Number(salesRow?.vat_collected ?? 0);
    const refundsPesewas = Number(salesRow?.refunds_pesewas ?? 0);
    const expensesPesewas = Number(expRow?.expenses_pesewas ?? 0);
    const netRevenue = grossRevenue - refundsPesewas - expensesPesewas;
    const totalCounted = cashCountedPesewas + momoCountedPesewas;
    const variance = totalCounted - grossRevenue;
    const isBalanced = Math.abs(variance) <= 100; // within GH₵1.00

    // Save EOD record
    const [record] = await this.dataSource.query(`
      INSERT INTO end_of_day_records (
        id, branch_id, cashier_id, business_date,
        total_sales_count, gross_revenue_pesewas, vat_collected_pesewas,
        refunds_count, refunds_pesewas,
        expenses_count, expenses_pesewas, net_revenue_pesewas,
        expected_cash_pesewas, cash_counted_pesewas, momo_counted_pesewas,
        total_counted_pesewas, variance_pesewas, is_balanced, closing_notes
      ) VALUES (
        gen_random_uuid(), $1, $2, $3,
        $4, $5, $6,
        $7, $8,
        $9, $10, $11,
        $12, $13, $14,
        $15, $16, $17, $18
      )
      RETURNING id, closed_at
    `, [
      actor.branchId, actor.sub, businessDate,
      salesRow?.sales_count ?? 0, grossRevenue, vatCollected,
      salesRow?.refunds_count ?? 0, refundsPesewas,
      expRow?.expenses_count ?? 0, expensesPesewas, netRevenue,
      grossRevenue, cashCountedPesewas, momoCountedPesewas,
      totalCounted, variance, isBalanced, closingNotes?.trim() || null,
    ]) as Array<{ id: string; closed_at: Date }>;

    // Audit log
    await this.dataSource.query(`
      INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
      VALUES (gen_random_uuid(), $1, $2, 'EOD_REGISTER_CLOSED', 'eod_record', $3, $4)
    `, [
      actor.branchId, actor.sub, record.id,
      JSON.stringify({
        business_date: businessDate,
        variance_pesewas: variance,
        is_balanced: isBalanced,
        gross_revenue: grossRevenue,
        total_counted: totalCounted,
      }),
    ]);

    // GL posting — only if variance is non-zero
    if (Math.abs(variance) > 0) {
      setImmediate(async () => {
        try {
          const desc = `EOD Cash Variance — ${businessDate}`;
          if (variance > 0) {
            // Over — more cash than expected: debit Cash, credit Cash Discrepancy
            await this.glPosting.postDoubleEntry([
              { branchId: actor.branchId, accountCode: '1000', accountName: 'Cash & Bank', debit: variance, credit: 0, description: desc, referenceType: 'EOD_VARIANCE', referenceId: record.id },
              { branchId: actor.branchId, accountCode: '4200', accountName: 'Other Income', debit: 0, credit: variance, description: desc, referenceType: 'EOD_VARIANCE', referenceId: record.id },
            ]);
          } else {
            // Short — less cash than expected: debit Cash Discrepancy, credit Cash
            const abs = Math.abs(variance);
            await this.glPosting.postDoubleEntry([
              { branchId: actor.branchId, accountCode: '5900', accountName: 'Cash Discrepancy / Shortage', debit: abs, credit: 0, description: desc, referenceType: 'EOD_VARIANCE', referenceId: record.id },
              { branchId: actor.branchId, accountCode: '1000', accountName: 'Cash & Bank', debit: 0, credit: abs, description: desc, referenceType: 'EOD_VARIANCE', referenceId: record.id },
            ]);
          }
          this.logger.log(`EOD GL variance posted: ${this.fmt(variance)} for ${businessDate}`);
        } catch (err) {
          this.logger.warn(`EOD GL posting failed: ${err}`);
        }
      });
    }

    this.logger.log(`Register closed: branch=${actor.branchId} date=${businessDate} variance=${variance} by=${actor.sub}`);

    return this.getEodRecord(record.id, actor.branchId);
  }

  // ── Get single EOD record ─────────────────────────────────────────────────

  async getEodRecord(id: string, branchId: string): Promise<EodRecord> {
    const [r] = await this.dataSource.query(`
      SELECT e.*, b.name AS branch_name, u.name AS cashier_name, m.name AS approved_by_name
      FROM end_of_day_records e
      JOIN branches b ON b.id = e.branch_id
      JOIN users u ON u.id = e.cashier_id
      LEFT JOIN users m ON m.id = e.approved_by
      WHERE e.id = $1 AND e.branch_id = $2
    `, [id, branchId]) as any[];

    return this.mapRecord(r);
  }

  // ── List EOD records for branch ───────────────────────────────────────────

  async listEodRecords(actor: JwtUser, limit = 30): Promise<EodRecord[]> {
    const rows = await this.dataSource.query(`
      SELECT e.*, b.name AS branch_name, u.name AS cashier_name, m.name AS approved_by_name
      FROM end_of_day_records e
      JOIN branches b ON b.id = e.branch_id
      JOIN users u ON u.id = e.cashier_id
      LEFT JOIN users m ON m.id = e.approved_by
      WHERE e.branch_id = $1
      ORDER BY e.business_date DESC
      LIMIT $2
    `, [actor.branchId, limit]) as any[];

    return rows.map((r: any) => this.mapRecord(r));
  }

  // ── Check if today is already closed ─────────────────────────────────────

  async getTodayStatus(branchId: string, cashierId: string): Promise<{ isClosed: boolean; record: EodRecord | null }> {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' });
    const [r] = await this.dataSource.query(`
      SELECT e.*, b.name AS branch_name, u.name AS cashier_name, m.name AS approved_by_name
      FROM end_of_day_records e
      JOIN branches b ON b.id = e.branch_id
      JOIN users u ON u.id = e.cashier_id
      LEFT JOIN users m ON m.id = e.approved_by
      WHERE e.branch_id = $1 AND e.cashier_id = $2 AND e.business_date = $3
    `, [branchId, cashierId, today]) as any[];

    if (!r) return { isClosed: false, record: null };
    return { isClosed: true, record: this.mapRecord(r) };
  }

  // ── All staff EOD records for a branch+date (manager view) ─────────────────

  async getBranchEodForDate(branchId: string, businessDate: string): Promise<EodRecord[]> {
    const rows = await this.dataSource.query(`
      SELECT e.*, b.name AS branch_name, u.name AS cashier_name, m.name AS approved_by_name
      FROM end_of_day_records e
      JOIN branches b ON b.id = e.branch_id
      JOIN users u ON u.id = e.cashier_id
      LEFT JOIN users m ON m.id = e.approved_by
      WHERE e.branch_id = $1 AND e.business_date = $2
      ORDER BY e.closed_at ASC
    `, [branchId, businessDate]) as any[];
    return rows.map((r: any) => this.mapRecord(r));
  }

  // ── Staff who have NOT yet submitted for a given date ───────────────────

  async getStaffPendingEod(branchId: string, businessDate: string): Promise<Array<{ id: string; name: string; role: string }>> {
    const rows = await this.dataSource.query(`
      SELECT u.id, u.name, u.role
      FROM users u
      WHERE u.branch_id = $1 AND u.is_active = true AND u.role != 'se_admin'
        AND u.id NOT IN (
          SELECT e.cashier_id FROM end_of_day_records e
          WHERE e.branch_id = $1 AND e.business_date = $2
        )
      ORDER BY u.name ASC
    `, [branchId, businessDate]) as any[];
    return rows;
  }

  // ── Map DB row → EodRecord ────────────────────────────────────────────────

  private mapRecord(r: any): EodRecord {
    return {
      id: r.id,
      branchId: r.branch_id,
      branchName: r.branch_name,
      cashierName: r.cashier_name,
      businessDate: typeof r.business_date === 'string'
        ? r.business_date.slice(0, 10)
        : new Date(r.business_date).toLocaleDateString('en-CA'),
      totalSalesCount: Number(r.total_sales_count),
      grossRevenuePesewas: Number(r.gross_revenue_pesewas),
      grossRevenueFormatted: this.fmt(Number(r.gross_revenue_pesewas)),
      vatCollectedPesewas: Number(r.vat_collected_pesewas),
      vatCollectedFormatted: this.fmt(Number(r.vat_collected_pesewas)),
      refundsCount: Number(r.refunds_count),
      refundsPesewas: Number(r.refunds_pesewas),
      refundsFormatted: this.fmt(Number(r.refunds_pesewas)),
      expensesCount: Number(r.expenses_count),
      expensesPesewas: Number(r.expenses_pesewas),
      expensesFormatted: this.fmt(Number(r.expenses_pesewas)),
      netRevenuePesewas: Number(r.net_revenue_pesewas),
      netRevenueFormatted: this.fmt(Number(r.net_revenue_pesewas)),
      expectedCashPesewas: Number(r.expected_cash_pesewas),
      expectedCashFormatted: this.fmt(Number(r.expected_cash_pesewas)),
      cashCountedPesewas: Number(r.cash_counted_pesewas),
      cashCountedFormatted: this.fmt(Number(r.cash_counted_pesewas)),
      momoCountedPesewas: Number(r.momo_counted_pesewas),
      momoCountedFormatted: this.fmt(Number(r.momo_counted_pesewas)),
      totalCountedPesewas: Number(r.total_counted_pesewas),
      totalCountedFormatted: this.fmt(Number(r.total_counted_pesewas)),
      variancePesewas: Number(r.variance_pesewas),
      varianceFormatted: this.fmt(Math.abs(Number(r.variance_pesewas))),
      isBalanced: Boolean(r.is_balanced),
      closingNotes: r.closing_notes || null,
      closedAt: new Date(r.closed_at),
      approvalStatus: r.approval_status ?? 'PENDING',
      approvedByName: r.approved_by_name || null,
      approvedAt: r.approved_at ? new Date(r.approved_at) : null,
      managerNotes: r.manager_notes || null,
    };
  }

  // ── Approve EOD ──────────────────────────────────────────────────────────

  async approveEodRecord(eodId: string, actor: JwtUser, managerNotes?: string): Promise<EodRecord> {
    await this.dataSource.query(`
      UPDATE end_of_day_records
      SET approval_status = 'APPROVED', approved_by = $1, approved_at = NOW(), manager_notes = $2
      WHERE id = $3 AND branch_id = $4
    `, [actor.sub, managerNotes?.trim() || null, eodId, actor.branchId]);

    await this.dataSource.query(`
      INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
      VALUES (gen_random_uuid(), $1, $2, 'EOD_APPROVED', 'eod_record', $3, $4)
    `, [actor.branchId, actor.sub, eodId, JSON.stringify({ manager_notes: managerNotes })]);

    return this.getEodRecord(eodId, actor.branchId);
  }

  // ── Decline EOD ──────────────────────────────────────────────────────────

  async declineEodRecord(eodId: string, actor: JwtUser, managerNotes?: string): Promise<EodRecord> {
    await this.dataSource.query(`
      UPDATE end_of_day_records
      SET approval_status = 'DECLINED', approved_by = $1, approved_at = NOW(), manager_notes = $2
      WHERE id = $3 AND branch_id = $4
    `, [actor.sub, managerNotes?.trim() || null, eodId, actor.branchId]);

    await this.dataSource.query(`
      INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
      VALUES (gen_random_uuid(), $1, $2, 'EOD_DECLINED', 'eod_record', $3, $4)
    `, [actor.branchId, actor.sub, eodId, JSON.stringify({ manager_notes: managerNotes })]);

    return this.getEodRecord(eodId, actor.branchId);
  }

  // ── Pending approvals ────────────────────────────────────────────────────

  async getPendingApprovals(branchId: string): Promise<EodRecord[]> {
    const rows = await this.dataSource.query(`
      SELECT e.*,
             b.name AS branch_name,
             u.name AS cashier_name,
             m.name AS approved_by_name
      FROM end_of_day_records e
      JOIN branches b ON b.id = e.branch_id
      JOIN users u ON u.id = e.cashier_id
      LEFT JOIN users m ON m.id = e.approved_by
      WHERE e.branch_id = $1 AND e.approval_status = 'PENDING'
      ORDER BY e.business_date DESC
    `, [branchId]) as any[];
    return rows.map((r: any) => this.mapRecord(r));
  }
}
