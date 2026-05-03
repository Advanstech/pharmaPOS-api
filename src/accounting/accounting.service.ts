import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import ExcelJS from 'exceljs';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { SalesEffectiveAtService } from '../sales/sales-effective-at.service';
import { ReportsService } from '../reports/reports.service';
import {
  CreateExpenseInput,
  ApproveExpenseInput,
  RecordSupplierPaymentInput,
  MatchSupplierInvoiceInput,
  IngestSupplierInvoiceOcrInput,
  UpsertOcrColumnMappingPresetInput,
  ExpenseOutput,
  SupplierCreditSummary,
  SupplierInvoiceOutput,
  CashFlowForecast,
  ProfitLossStatement,
  AccountingWorkbookExport,
  InvoiceOcrIngestionResult,
  OcrColumnMappingPresetOutput,
  PaymentStatus,
  SupplierInvoiceOcrLineInput,
} from './dto/accounting.types';

const ORG_WIDE_ACCOUNTING_ROLES = ['owner', 'se_admin'] as const;

interface ExpenseRow {
  id: string;
  branch_id: string;
  category: string;
  amount_pesewas: number;
  description: string;
  receipt_s3_key: string | null;
  expense_date: Date;
  status: string;
  created_by: string;
  created_by_name: string;
  approved_by: string | null;
  approved_by_name: string | null;
  approval_notes: string | null;
  created_at: Date;
}

interface InvoiceRow {
  id: string;
  supplier_id: string;
  supplier_name: string;
  branch_id: string;
  grn_id: string | null;
  invoice_number: string;
  invoice_date: Date;
  due_date: Date | null;
  total_amount: number;
  paid_amount: number;
  status: string;
  payment_status: string;
  s3_pdf_key: string | null;
  created_at: Date;
  days_outstanding: number;
  is_overdue: boolean;
  overdue_by_days: number;
}

interface InvoiceLookupRow {
  id: string;
  branch_id: string;
  supplier_id: string;
  invoice_number: string;
}

interface OcrPresetRow {
  id: string;
  branch_id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  name: string;
  header_map: Record<string, string> | null;
  updated_at: Date;
}

interface SalesLedgerRow {
  sale_id: string;
  sold_at: Date;
  cashier_name: string | null;
  customer_code: string | null;
  status: string;
  item_count: number;
  subtotal_pesewas: number;
  vat_pesewas: number;
  total_pesewas: number;
}

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly effectiveSaleAt: SalesEffectiveAtService,
    private readonly reportsService: ReportsService,
  ) {}

  // ── Expenses ──────────────────────────────────────────────────────────────

  /**
   * Create a new expense — requires manager/owner approval before payment.
   * RBAC: all authenticated users can create expenses.
   */
  async createExpense(input: CreateExpenseInput, actor: JwtUser): Promise<ExpenseOutput> {
    const expenseDate = input.expenseDate ?? new Date().toISOString().split('T')[0];

    const [row] = await this.dataSource.query(`
      INSERT INTO expenses (
        id, branch_id, category, amount_pesewas, description,
        receipt_s3_key, expense_date, status, created_by
      )
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6::date, 'PENDING', $7)
      RETURNING id
    `, [
      actor.branchId,
      input.category,
      input.amountPesewas,
      input.description,
      input.receiptS3Key ?? null,
      expenseDate,
      actor.sub,
    ]) as Array<{ id: string }>;

    // Audit log
    await this.dataSource.query(`
      INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
      VALUES (gen_random_uuid(), $1, $2, 'EXPENSE_CREATED', 'expense', $3, $4)
    `, [
      actor.branchId,
      actor.sub,
      row.id,
      JSON.stringify({ category: input.category, amount: input.amountPesewas }),
    ]);

    this.logger.log(`Expense created: id=${row.id} category=${input.category} by=${actor.sub}`);
    return this.getExpense(row.id);
  }

  /**
   * Approve or reject an expense.
   * RBAC: owner, se_admin, manager only.
   */
  async approveExpense(input: ApproveExpenseInput, actor: JwtUser): Promise<ExpenseOutput> {
    const [expense] = await this.dataSource.query(
      `SELECT id, status FROM expenses WHERE id = $1`,
      [input.expenseId],
    ) as Array<{ id: string; status: string }>;

    if (!expense) throw new NotFoundException(`Expense ${input.expenseId} not found`);
    if (expense.status !== 'PENDING') {
      throw new BadRequestException(`Expense ${input.expenseId} is already ${expense.status}`);
    }

    await this.dataSource.query(`
      UPDATE expenses
      SET status = $1, approved_by = $2, approval_notes = $3, updated_at = NOW()
      WHERE id = $4
    `, [input.status, actor.sub, input.notes ?? null, input.expenseId]);

    // If approved, post to general ledger
    if (input.status === PaymentStatus.APPROVED) {
      const [exp] = await this.dataSource.query(
        `SELECT amount_pesewas, category FROM expenses WHERE id = $1`,
        [input.expenseId],
      ) as Array<{ amount_pesewas: number; category: string }>;

      await this.postToGeneralLedger({
        branchId: actor.branchId,
        accountCode: this.getExpenseAccountCode(exp.category),
        accountName: exp.category,
        debit: exp.amount_pesewas,
        credit: 0,
        description: `Expense approved: ${exp.category}`,
        referenceType: 'expense',
        referenceId: input.expenseId,
      });
    }

    this.logger.log(`Expense ${input.status}: id=${input.expenseId} by=${actor.sub}`);
    return this.getExpense(input.expenseId);
  }

  /**
   * List expenses for the current branch.
   * RBAC: owner, se_admin, manager see all; staff see only their own.
   */
  async listExpenses(actor: JwtUser, status?: PaymentStatus): Promise<ExpenseOutput[]> {
    const isManager = ['owner', 'se_admin', 'manager'].includes(actor.role);
    const orgWide = (ORG_WIDE_ACCOUNTING_ROLES as readonly string[]).includes(actor.role);

    const branchClause = orgWide
      ? `e.branch_id IN (SELECT id FROM branches WHERE organization_id = (SELECT organization_id FROM branches WHERE id = $1))`
      : 'e.branch_id = $1';

    let query = `
      SELECT
        e.id, e.branch_id, e.category, e.amount_pesewas, e.description,
        e.receipt_s3_key, e.expense_date, e.status, e.created_by,
        u1.name AS created_by_name,
        e.approved_by, u2.name AS approved_by_name,
        e.approval_notes, e.created_at
      FROM expenses e
      JOIN users u1 ON u1.id = e.created_by
      LEFT JOIN users u2 ON u2.id = e.approved_by
      WHERE ${branchClause}
    `;

    const params: unknown[] = [actor.branchId];

    if (!isManager) {
      query += ` AND e.created_by = $${params.length + 1}`;
      params.push(actor.sub);
    }

    if (status) {
      query += ` AND e.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY e.created_at DESC`;

    const rows = await this.dataSource.query(query, params) as ExpenseRow[];
    return rows.map((r) => this.mapExpenseOutput(r));
  }

  private async getExpense(id: string): Promise<ExpenseOutput> {
    const [row] = await this.dataSource.query(`
      SELECT
        e.id, e.branch_id, e.category, e.amount_pesewas, e.description,
        e.receipt_s3_key, e.expense_date, e.status, e.created_by,
        u1.name AS created_by_name,
        e.approved_by, u2.name AS approved_by_name,
        e.approval_notes, e.created_at
      FROM expenses e
      JOIN users u1 ON u1.id = e.created_by
      LEFT JOIN users u2 ON u2.id = e.approved_by
      WHERE e.id = $1
    `, [id]) as ExpenseRow[];

    if (!row) throw new NotFoundException(`Expense ${id} not found`);
    return this.mapExpenseOutput(row);
  }

  // ── Supplier Credit & Invoices ────────────────────────────────────────────

  /**
   * Get supplier credit summary — outstanding balance, overdue, aging.
   * Used by owner/manager to decide when to pay suppliers.
   */
  async getSupplierCreditSummary(supplierId: string, branchId: string): Promise<SupplierCreditSummary> {
    const [supplier] = await this.dataSource.query(
      `SELECT name, credit_limit FROM suppliers WHERE id = $1`,
      [supplierId],
    ) as Array<{ name: string; credit_limit: number }>;

    if (!supplier) throw new NotFoundException(`Supplier ${supplierId} not found`);

    const [summary] = await this.dataSource.query(`
      SELECT
        COALESCE(SUM(total_amount - paid_amount), 0)::int AS outstanding,
        COALESCE(SUM(CASE WHEN due_date < NOW() THEN total_amount - paid_amount ELSE 0 END), 0)::int AS overdue,
        COUNT(CASE WHEN status IN ('PENDING','MATCHED','PARTIAL') THEN 1 END)::int AS unpaid_count,
        COUNT(CASE WHEN due_date < NOW() AND status IN ('PENDING','MATCHED','PARTIAL') THEN 1 END)::int AS overdue_count,
        MIN(CASE WHEN status IN ('PENDING','MATCHED','PARTIAL') THEN due_date END) AS next_due
      FROM supplier_invoices
      WHERE supplier_id = $1 AND branch_id = $2
    `, [supplierId, branchId]) as Array<{
      outstanding: number;
      overdue: number;
      unpaid_count: number;
      overdue_count: number;
      next_due: Date | null;
    }>;

    const creditLimit = supplier.credit_limit ?? 0;
    const utilization = creditLimit > 0 ? (summary.outstanding / creditLimit) * 100 : 0;

    return {
      supplierId,
      supplierName: supplier.name,
      outstandingBalancePesewas: summary.outstanding,
      outstandingBalanceFormatted: this.fmt(summary.outstanding),
      overduePesewas: summary.overdue,
      overdueFormatted: this.fmt(summary.overdue),
      unpaidInvoiceCount: summary.unpaid_count,
      overdueInvoiceCount: summary.overdue_count,
      nextPaymentDue: summary.next_due ?? undefined,
      creditLimitPesewas: creditLimit,
      creditUtilizationPct: Math.round(utilization * 10) / 10,
    };
  }

  /**
   * List supplier invoices for a branch.
   * RBAC: owner, se_admin, manager only.
   */
  async listSupplierInvoices(actor: JwtUser, supplierId?: string): Promise<SupplierInvoiceOutput[]> {
    const orgWide = (ORG_WIDE_ACCOUNTING_ROLES as readonly string[]).includes(actor.role);
    const branchClause = orgWide
      ? `si.branch_id IN (SELECT id FROM branches WHERE organization_id = (SELECT organization_id FROM branches WHERE id = $1))`
      : 'si.branch_id = $1';

    let query = `
      SELECT
        si.id, si.supplier_id, s.name AS supplier_name, si.branch_id, si.grn_id,
        si.invoice_number, si.invoice_date, si.due_date,
        si.total_amount, si.paid_amount, si.status, si.payment_status, si.s3_pdf_key, si.created_at,
        EXTRACT(DAY FROM (NOW() - si.invoice_date))::INT as days_outstanding,
        (si.due_date IS NOT NULL AND si.due_date < CURRENT_DATE AND si.payment_status != 'PAID') as is_overdue,
        CASE 
          WHEN si.due_date IS NOT NULL AND si.due_date < CURRENT_DATE AND si.payment_status != 'PAID'
          THEN EXTRACT(DAY FROM (CURRENT_DATE - si.due_date))::INT
          ELSE 0
        END as overdue_by_days
      FROM supplier_invoices si
      JOIN suppliers s ON s.id = si.supplier_id
      WHERE ${branchClause}
    `;

    const params: unknown[] = [actor.branchId];

    if (supplierId) {
      query += ` AND si.supplier_id = $${params.length + 1}`;
      params.push(supplierId);
    }

    query += ` ORDER BY si.invoice_date DESC`;

    const rows = await this.dataSource.query(query, params) as InvoiceRow[];
    return rows.map((r) => this.mapInvoiceOutput(r));
  }

  /**
   * Record a payment to a supplier against an invoice.
   * RBAC: owner, se_admin, manager only.
   * Updates invoice paid_amount and status. Posts to general ledger.
   */
  async recordSupplierPayment(
    input: RecordSupplierPaymentInput,
    actor: JwtUser,
  ): Promise<SupplierInvoiceOutput> {
    const [invoice] = await this.dataSource.query(
      `SELECT id, total_amount, paid_amount, supplier_id FROM supplier_invoices WHERE id = $1`,
      [input.invoiceId],
    ) as Array<{ id: string; total_amount: number; paid_amount: number; supplier_id: string }>;

    if (!invoice) throw new NotFoundException(`Invoice ${input.invoiceId} not found`);

    const newPaidAmount = invoice.paid_amount + input.amountPesewas;
    if (newPaidAmount > invoice.total_amount) {
      throw new BadRequestException(
        `Payment amount ${input.amountPesewas} exceeds remaining balance ${invoice.total_amount - invoice.paid_amount}`,
      );
    }

    const newStatus = newPaidAmount >= invoice.total_amount ? 'PAID' : 'PARTIAL';

    await this.dataSource.transaction(async (em) => {
      // Insert payment record
      await em.query(`
        INSERT INTO supplier_payments (id, invoice_id, branch_id, amount_pesewas, payment_method, reference, paid_by, paid_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())
      `, [input.invoiceId, actor.branchId, input.amountPesewas, input.paymentMethod, input.reference ?? null, actor.sub]);

      // Update invoice
      await em.query(`
        UPDATE supplier_invoices
        SET paid_amount = paid_amount + $1, status = $2, updated_at = NOW()
        WHERE id = $3
      `, [input.amountPesewas, newStatus, input.invoiceId]);

      // Post to general ledger — debit Accounts Payable, credit Cash
      await this.postToGeneralLedger({
        branchId: actor.branchId,
        accountCode: '2100',
        accountName: 'Accounts Payable',
        debit: input.amountPesewas,
        credit: 0,
        description: `Payment to supplier — Invoice ${input.invoiceId}`,
        referenceType: 'supplier_payment',
        referenceId: input.invoiceId,
      });

      await this.postToGeneralLedger({
        branchId: actor.branchId,
        accountCode: '1000',
        accountName: 'Cash',
        debit: 0,
        credit: input.amountPesewas,
        description: `Payment to supplier — Invoice ${input.invoiceId}`,
        referenceType: 'supplier_payment',
        referenceId: input.invoiceId,
      });

      // Audit log
      await em.query(`
        INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
        VALUES (gen_random_uuid(), $1, $2, 'SUPPLIER_PAYMENT', 'supplier_invoice', $3, $4)
      `, [
        actor.branchId,
        actor.sub,
        input.invoiceId,
        JSON.stringify({ amount: input.amountPesewas, method: input.paymentMethod }),
      ]);
    });

    this.logger.log(`Supplier payment: invoice=${input.invoiceId} amount=${input.amountPesewas} by=${actor.sub}`);

    const invoices = await this.listSupplierInvoices(actor);
    const updated = invoices.find((i) => i.id === input.invoiceId);
    if (!updated) throw new NotFoundException('Invoice not found after payment');
    return updated;
  }

  /**
   * Match a supplier invoice to a GRN (3-way match: PO → GRN → Invoice).
   * RBAC: owner, se_admin, manager only.
   */
  async matchSupplierInvoice(input: MatchSupplierInvoiceInput, actor: JwtUser): Promise<SupplierInvoiceOutput> {
    const [invoice] = await this.dataSource.query(
      `SELECT id, status FROM supplier_invoices WHERE id = $1`,
      [input.invoiceId],
    ) as Array<{ id: string; status: string }>;

    if (!invoice) throw new NotFoundException(`Invoice ${input.invoiceId} not found`);

    const [grn] = await this.dataSource.query(
      `SELECT id FROM goods_received_notes WHERE id = $1`,
      [input.grnId],
    ) as Array<{ id: string }>;

    if (!grn) throw new NotFoundException(`GRN ${input.grnId} not found`);

    await this.dataSource.query(`
      UPDATE supplier_invoices
      SET grn_id = $1, status = 'MATCHED', updated_at = NOW()
      WHERE id = $2
    `, [input.grnId, input.invoiceId]);

    this.logger.log(`Invoice matched: invoice=${input.invoiceId} grn=${input.grnId} by=${actor.sub}`);

    const invoices = await this.listSupplierInvoices(actor);
    const matched = invoices.find((i) => i.id === input.invoiceId);
    if (!matched) throw new NotFoundException('Invoice not found after match');
    return matched;
  }

  /**
   * Ingest OCR-extracted supplier invoice lines into product_cost_history.
   * This lets pricing control prefill supplier costs from invoices, not only GRNs.
   */
  async ingestSupplierInvoiceOcr(
    input: IngestSupplierInvoiceOcrInput,
    actor: JwtUser,
  ): Promise<InvoiceOcrIngestionResult> {
    if (!input.lines || input.lines.length === 0) {
      throw new BadRequestException('OCR lines are required');
    }

    const [invoice] = await this.dataSource.query(
      `SELECT id, branch_id, supplier_id, invoice_number
       FROM supplier_invoices
       WHERE id = $1 AND branch_id = $2`,
      [input.invoiceId, actor.branchId],
    ) as InvoiceLookupRow[];

    if (!invoice) {
      throw new NotFoundException(`Supplier invoice ${input.invoiceId} not found for this branch`);
    }

    let matchedLines = 0;
    let createdCostRows = 0;
    const unmatchedHints: string[] = [];

    await this.dataSource.transaction(async (em) => {
      // Keep ingestion idempotent for the invoice by replacing old OCR-sourced cost rows.
      await em.query(
        `DELETE FROM product_cost_history
         WHERE branch_id = $1 AND source_type = 'INVOICE' AND source_reference_id = $2`,
        [actor.branchId, input.invoiceId],
      );

      const ocrAuditLines: Array<Record<string, unknown>> = [];

      for (let index = 0; index < input.lines.length; index++) {
        const line = input.lines[index];
        const qty = line.quantity && line.quantity > 0 ? line.quantity : 1;
        const unitCostPesewas = this.resolveInvoiceLineUnitCost(line);
        const resolvedProductId = await this.resolveInvoiceLineProductId(
          em,
          invoice.supplier_id,
          line,
        );

        let status = 'UNMATCHED';
        let reason: string | undefined;

        if (!unitCostPesewas) {
          reason = 'Missing unit cost (or inferable line total/quantity)';
        } else if (!resolvedProductId) {
          reason = 'No catalog product match';
        } else {
          await em.query(`
            INSERT INTO product_cost_history (
              id, branch_id, product_id, supplier_id, source_type, source_reference_id,
              unit_cost_pesewas, currency, observed_at, created_by
            )
            VALUES (gen_random_uuid(), $1, $2, $3, 'INVOICE', $4, $5, 'GHS', NOW(), $6)
          `, [
            actor.branchId,
            resolvedProductId,
            invoice.supplier_id,
            input.invoiceId,
            unitCostPesewas,
            actor.sub,
          ]);
          status = 'MATCHED';
          matchedLines += 1;
          createdCostRows += 1;
        }

        if (status === 'UNMATCHED') {
          const hintLabel =
            line.productName?.trim() ||
            line.barcode?.trim() ||
            line.rawText?.trim() ||
            `line-${index + 1}`;
          unmatchedHints.push(`Line ${index + 1}: ${hintLabel} (${reason ?? 'unknown reason'})`);
        }

        ocrAuditLines.push({
          lineNumber: index + 1,
          rawText: line.rawText ?? null,
          barcode: line.barcode ?? null,
          productName: line.productName ?? null,
          providedProductId: line.productId ?? null,
          resolvedProductId: resolvedProductId ?? null,
          quantity: qty,
          unitCostPesewas: unitCostPesewas ?? null,
          status,
          reason: reason ?? null,
        });
      }

      const ocrPayload = {
        ocr: {
          parser: input.parser ?? 'unknown',
          ingestedAt: new Date().toISOString(),
          totalLines: input.lines.length,
          matchedLines,
          unmatchedLines: input.lines.length - matchedLines,
          lines: ocrAuditLines,
        },
      };

      await em.query(
        `UPDATE supplier_invoices
         SET extracted_data = COALESCE(extracted_data, '{}'::jsonb) || $1::jsonb,
             updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(ocrPayload), input.invoiceId],
      );

      await em.query(`
        INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
        VALUES (gen_random_uuid(), $1, $2, 'INVOICE_OCR_INGESTED', 'supplier_invoice', $3, $4)
      `, [
        actor.branchId,
        actor.sub,
        input.invoiceId,
        JSON.stringify({
          invoiceNumber: invoice.invoice_number,
          parser: input.parser ?? 'unknown',
          totalLines: input.lines.length,
          matchedLines,
          unmatchedLines: input.lines.length - matchedLines,
          costSnapshotsCreated: createdCostRows,
        }),
      ]);
    });

    this.logger.log(
      `Invoice OCR ingested: invoice=${input.invoiceId} matched=${matchedLines}/${input.lines.length} by=${actor.sub}`,
    );

    return {
      invoiceId: input.invoiceId,
      totalLines: input.lines.length,
      matchedLines,
      unmatchedLines: input.lines.length - matchedLines,
      costSnapshotsCreated: createdCostRows,
      unmatchedHints,
    };
  }

  async listOcrColumnMappingPresets(
    branchId: string,
    supplierId?: string,
  ): Promise<OcrColumnMappingPresetOutput[]> {
    let query = `
      SELECT
        p.id, p.branch_id, p.supplier_id, s.name AS supplier_name,
        p.name, p.header_map, p.updated_at
      FROM ocr_mapping_presets p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.branch_id = $1
    `;
    const params: unknown[] = [branchId];
    if (supplierId) {
      query += ` AND (p.supplier_id = $2 OR p.supplier_id IS NULL)`;
      params.push(supplierId);
    }
    query += ` ORDER BY p.updated_at DESC`;

    const rows = await this.dataSource.query(query, params) as OcrPresetRow[];
    return rows.map((row) => this.mapOcrPresetOutput(row));
  }

  async upsertOcrColumnMappingPreset(
    input: UpsertOcrColumnMappingPresetInput,
    actor: JwtUser,
  ): Promise<OcrColumnMappingPresetOutput> {
    const normalizedName = input.name.trim();
    if (!normalizedName) {
      throw new BadRequestException('Preset name is required');
    }
    if (!input.mappings || input.mappings.length === 0) {
      throw new BadRequestException('At least one column mapping is required');
    }

    const headerMap: Record<string, string> = {};
    for (const pair of input.mappings) {
      const sourceHeader = pair.sourceHeader.trim().toLowerCase();
      const targetField = pair.targetField.trim();
      if (!sourceHeader) continue;
      headerMap[sourceHeader] = targetField || 'ignore';
    }
    if (Object.keys(headerMap).length === 0) {
      throw new BadRequestException('No valid column mappings provided');
    }

    const saved = await this.dataSource.transaction(async (em) => {
      if (input.presetId) {
        const existing = await em.query(
          `SELECT id FROM ocr_mapping_presets WHERE id = $1 AND branch_id = $2`,
          [input.presetId, actor.branchId],
        ) as Array<{ id: string }>;
        if (!existing[0]) {
          throw new NotFoundException(`OCR preset ${input.presetId} not found`);
        }
        const rows = await em.query(`
          UPDATE ocr_mapping_presets
          SET supplier_id = $1,
              name = $2,
              header_map = $3::jsonb,
              updated_by = $4,
              updated_at = NOW()
          WHERE id = $5 AND branch_id = $6
          RETURNING id
        `, [
          input.supplierId ?? null,
          normalizedName,
          JSON.stringify(headerMap),
          actor.sub,
          input.presetId,
          actor.branchId,
        ]) as Array<{ id: string }>;
        return rows[0];
      }

      const rows = await em.query(`
        INSERT INTO ocr_mapping_presets (
          id, branch_id, supplier_id, name, header_map, created_by, updated_by
        )
        VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, $5, $5)
        RETURNING id
      `, [
        actor.branchId,
        input.supplierId ?? null,
        normalizedName,
        JSON.stringify(headerMap),
        actor.sub,
      ]) as Array<{ id: string }>;
      return rows[0];
    });

    const presets = await this.listOcrColumnMappingPresets(actor.branchId);
    const found = presets.find((preset) => preset.id === saved.id);
    if (!found) throw new NotFoundException('Preset not found after save');
    return found;
  }

  async deleteOcrColumnMappingPreset(presetId: string, actor: JwtUser): Promise<boolean> {
    const rows = await this.dataSource.query(
      `DELETE FROM ocr_mapping_presets
       WHERE id = $1 AND branch_id = $2
       RETURNING id`,
      [presetId, actor.branchId],
    ) as Array<{ id: string }>;
    return !!rows[0];
  }

  // ── Cash Flow Intelligence ───────────────────────────────────────────────

  /**
   * Predict when to pay suppliers based on sales velocity and cash runway.
   * Algorithm:
   * 1. Calculate current cash on hand (from GL account 1000)
   * 2. Calculate avg daily sales revenue (last 30 days)
   * 3. Calculate avg daily expenses (last 30 days)
   * 4. Project revenue for next 7/30 days
   * 5. Calculate cash runway = current cash / avg daily expenses
   * 6. Recommend: PAY_NOW if runway > 60 days, WAIT if runway < 30 days, etc.
   */
  async getCashFlowForecast(branchId: string): Promise<CashFlowForecast> {
    // Current cash on hand (GL account 1000 — Cash)
    const [cashRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(debit - credit), 0)::int AS cash
      FROM general_ledger
      WHERE branch_id = $1 AND account_code = '1000'
    `, [branchId]) as Array<{ cash: number }>;

    const currentCash = cashRow?.cash ?? 0;

    // Avg daily sales revenue (last 30 days)
    const [revenueRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(s.total_amount), 0)::int AS revenue
      FROM sales s
      WHERE s.branch_id = $1
        AND s.status = 'COMPLETED'
        AND (${this.effectiveSaleAt.sql('s')}) >= NOW() - INTERVAL '30 days'
    `, [branchId]) as Array<{ revenue: number }>;

    const revenue30Days = revenueRow?.revenue ?? 0;
    const avgDailyRevenue = revenue30Days / 30;

    // Avg daily expenses (last 30 days) — combine both expense tables
    const [expenseRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(amount_pesewas), 0)::int AS expenses
      FROM (
        SELECT amount_pesewas FROM expenses
        WHERE branch_id = $1 AND status = 'APPROVED'
          AND expense_date >= NOW() - INTERVAL '30 days'
        UNION ALL
        SELECT amount_pesewas FROM staff_expenses
        WHERE branch_id = $1 AND status IN ('APPROVED', 'REIMBURSED')
          AND expense_date >= NOW() - INTERVAL '30 days'
      ) combined
    `, [branchId]) as Array<{ expenses: number }>;

    const expenses30Days = expenseRow?.expenses ?? 0;
    const avgDailyExpenses = expenses30Days / 30;

    // Payables due in next 7/30 days
    const [payables7] = await this.dataSource.query(`
      SELECT COALESCE(SUM(total_amount - paid_amount), 0)::int AS due
      FROM supplier_invoices
      WHERE branch_id = $1
        AND status IN ('PENDING','MATCHED','PARTIAL')
        AND due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
    `, [branchId]) as Array<{ due: number }>;

    const [payables30] = await this.dataSource.query(`
      SELECT COALESCE(SUM(total_amount - paid_amount), 0)::int AS due
      FROM supplier_invoices
      WHERE branch_id = $1
        AND status IN ('PENDING','MATCHED','PARTIAL')
        AND due_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
    `, [branchId]) as Array<{ due: number }>;

    const payablesDue7Days = payables7?.due ?? 0;
    const payablesDue30Days = payables30?.due ?? 0;

    // Projected revenue
    const projectedRevenue7Days = Math.round(avgDailyRevenue * 7);
    const projectedRevenue30Days = Math.round(avgDailyRevenue * 30);

    // Cash runway
    const cashRunwayDays = avgDailyExpenses > 0 ? currentCash / avgDailyExpenses : 999;

    // Recommendation algorithm
    let recommendation = 'PAY_NOW';
    let reason = '';

    if (currentCash < payablesDue7Days) {
      recommendation = 'CRITICAL_LOW_CASH';
      reason = `Current cash (${this.fmt(currentCash)}) is less than payables due in 7 days (${this.fmt(payablesDue7Days)}). Negotiate payment extensions or delay non-critical expenses.`;
    } else if (cashRunwayDays < 30) {
      recommendation = 'NEGOTIATE_EXTENSION';
      reason = `Cash runway is only ${Math.round(cashRunwayDays)} days. Negotiate 30-day extensions with suppliers to preserve cash.`;
    } else if (cashRunwayDays < 60 && payablesDue7Days > projectedRevenue7Days) {
      recommendation = 'WAIT_7_DAYS';
      reason = `Cash runway is ${Math.round(cashRunwayDays)} days. Wait 7 days to collect more revenue (projected ${this.fmt(projectedRevenue7Days)}) before paying suppliers.`;
    } else if (cashRunwayDays >= 60) {
      recommendation = 'PAY_NOW';
      reason = `Cash runway is healthy (${Math.round(cashRunwayDays)} days). Pay suppliers now to maintain good relationships and secure early payment discounts.`;
    } else {
      recommendation = 'WAIT_30_DAYS';
      reason = `Cash runway is ${Math.round(cashRunwayDays)} days. Wait until closer to due dates to preserve working capital.`;
    }

    return {
      currentCashPesewas: currentCash,
      currentCashFormatted: this.fmt(currentCash),
      payablesDue7DaysPesewas: payablesDue7Days,
      payablesDue7DaysFormatted: this.fmt(payablesDue7Days),
      payablesDue30DaysPesewas: payablesDue30Days,
      payablesDue30DaysFormatted: this.fmt(payablesDue30Days),
      projectedRevenue7DaysPesewas: projectedRevenue7Days,
      projectedRevenue7DaysFormatted: this.fmt(projectedRevenue7Days),
      projectedRevenue30DaysPesewas: projectedRevenue30Days,
      projectedRevenue30DaysFormatted: this.fmt(projectedRevenue30Days),
      cashRunwayDays: Math.round(cashRunwayDays * 10) / 10,
      recommendation,
      recommendationReason: reason,
    };
  }

  // ── Profit & Loss ─────────────────────────────────────────────────────────

  /**
   * Generate P&L statement for a period.
   * Revenue = sales, COGS = supplier invoices matched to sales, Operating expenses = approved expenses.
   */
  async getProfitLoss(branchId: string, periodStart: string, periodEnd: string): Promise<ProfitLossStatement> {
    // Revenue
    const [revenueRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(s.total_amount), 0)::int AS revenue
      FROM sales s
      WHERE s.branch_id = $1
        AND s.status = 'COMPLETED'
        AND (${this.effectiveSaleAt.sql('s')}) >= $2::timestamptz
        AND (${this.effectiveSaleAt.sql('s')}) < ($3::date + INTERVAL '1 day')::timestamptz
    `, [branchId, periodStart, periodEnd]) as Array<{ revenue: number }>;

    const revenue = revenueRow?.revenue ?? 0;

    // COGS — supplier invoices matched to sales in this period
    const [cogsRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(si.total_amount), 0)::int AS cogs
      FROM supplier_invoices si
      WHERE si.branch_id = $1
        AND si.status IN ('MATCHED','PAID')
        AND si.invoice_date >= $2::timestamptz
        AND si.invoice_date < ($3::date + INTERVAL '1 day')::timestamptz
    `, [branchId, periodStart, periodEnd]) as Array<{ cogs: number }>;

    const cogs = cogsRow?.cogs ?? 0;

    // Operating expenses — combine both old and new expense tables
    const [expensesRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(amount_pesewas), 0)::int AS expenses
      FROM (
        SELECT amount_pesewas FROM expenses
        WHERE branch_id = $1 AND status = 'APPROVED'
          AND expense_date >= $2::date AND expense_date <= $3::date
        UNION ALL
        SELECT amount_pesewas FROM staff_expenses
        WHERE branch_id = $1 AND status IN ('APPROVED', 'REIMBURSED')
          AND expense_date >= $2::date AND expense_date <= $3::date
      ) combined
    `, [branchId, periodStart, periodEnd]) as Array<{ expenses: number }>;

    const opex = expensesRow?.expenses ?? 0;

    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - opex;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      periodStart,
      periodEnd,
      revenuePesewas: revenue,
      revenueFormatted: this.fmt(revenue),
      cogsPesewas: cogs,
      cogsFormatted: this.fmt(cogs),
      grossProfitPesewas: grossProfit,
      grossProfitFormatted: this.fmt(grossProfit),
      grossProfitMarginPct: Math.round(grossMargin * 10) / 10,
      operatingExpensesPesewas: opex,
      operatingExpensesFormatted: this.fmt(opex),
      netProfitPesewas: netProfit,
      netProfitFormatted: this.fmt(netProfit),
      netProfitMarginPct: Math.round(netMargin * 10) / 10,
    };
  }

  async exportAccountingWorkbook(
    actor: JwtUser,
    periodStart: string,
    periodEnd: string,
  ): Promise<AccountingWorkbookExport> {
    const [branch, revenue, topProducts, profitLoss, cashFlow, supplierInvoices, expenseRows, salesLedger] =
      await Promise.all([
        this.getBranchName(actor.branchId),
        this.reportsService.getRevenueReport(actor.branchId, periodStart, periodEnd),
        this.reportsService.getTopProducts(actor.branchId, periodStart, periodEnd, 30),
        this.getProfitLoss(actor.branchId, periodStart, periodEnd),
        this.getCashFlowForecast(actor.branchId),
        this.listSupplierInvoices(actor),
        this.listApprovedExpensesForBranch(actor.branchId, periodStart, periodEnd),
        this.getSalesLedger(actor.branchId, periodStart, periodEnd),
      ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Azzay Pharmacy Pro';
    wb.created = new Date();

    const summary = wb.addWorksheet('Executive Summary');
    summary.columns = [
      { header: 'Metric', key: 'metric', width: 40 },
      { header: 'Value', key: 'value', width: 26 },
      { header: 'Value (pesewas)', key: 'pesewas', width: 20 },
    ];
    summary.addRows([
      { metric: 'Branch', value: branch },
      { metric: 'Period Start', value: periodStart },
      { metric: 'Period End', value: periodEnd },
      { metric: 'Revenue', value: revenue.totalRevenueFormatted, pesewas: revenue.totalRevenuePesewas },
      { metric: 'VAT Collected', value: revenue.vatFormatted, pesewas: revenue.vatCollectedPesewas },
      { metric: 'Sales Count', value: revenue.salesCount },
      { metric: 'P&L Net Profit', value: profitLoss.netProfitFormatted, pesewas: profitLoss.netProfitPesewas },
      { metric: 'Gross Margin %', value: profitLoss.grossProfitMarginPct },
      { metric: 'Net Margin %', value: profitLoss.netProfitMarginPct },
      { metric: 'Cash Runway (days)', value: cashFlow.cashRunwayDays },
      { metric: 'Cash Recommendation', value: cashFlow.recommendation },
      { metric: 'Cash Recommendation Reason', value: cashFlow.recommendationReason },
    ]);

    const salesSheet = wb.addWorksheet('Sales Ledger');
    salesSheet.columns = [
      { header: 'Sale ID', key: 'sale_id', width: 38 },
      { header: 'Sold At (UTC)', key: 'sold_at', width: 24 },
      { header: 'Cashier', key: 'cashier_name', width: 24 },
      { header: 'Customer Code', key: 'customer_code', width: 16 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Line Items', key: 'item_count', width: 12 },
      { header: 'Subtotal (pesewas)', key: 'subtotal_pesewas', width: 18 },
      { header: 'VAT (pesewas)', key: 'vat_pesewas', width: 16 },
      { header: 'Total (pesewas)', key: 'total_pesewas', width: 18 },
    ];
    salesLedger.forEach((row) => salesSheet.addRow(row));

    const plSheet = wb.addWorksheet('Profit and Loss');
    plSheet.columns = [
      { header: 'Line Item', key: 'line', width: 36 },
      { header: 'Amount (pesewas)', key: 'pesewas', width: 20 },
      { header: 'Formatted', key: 'formatted', width: 20 },
    ];
    plSheet.addRows([
      { line: 'Revenue', pesewas: profitLoss.revenuePesewas, formatted: profitLoss.revenueFormatted },
      { line: 'COGS', pesewas: profitLoss.cogsPesewas, formatted: profitLoss.cogsFormatted },
      { line: 'Gross Profit', pesewas: profitLoss.grossProfitPesewas, formatted: profitLoss.grossProfitFormatted },
      { line: 'Operating Expenses', pesewas: profitLoss.operatingExpensesPesewas, formatted: profitLoss.operatingExpensesFormatted },
      { line: 'Net Profit', pesewas: profitLoss.netProfitPesewas, formatted: profitLoss.netProfitFormatted },
      { line: 'Gross Margin %', pesewas: Math.round(profitLoss.grossProfitMarginPct * 100) },
      { line: 'Net Margin %', pesewas: Math.round(profitLoss.netProfitMarginPct * 100) },
    ]);

    const cashSheet = wb.addWorksheet('Cash Flow');
    cashSheet.columns = [
      { header: 'Metric', key: 'metric', width: 38 },
      { header: 'Value', key: 'value', width: 26 },
      { header: 'Value (pesewas)', key: 'pesewas', width: 20 },
    ];
    cashSheet.addRows([
      { metric: 'Current Cash', value: cashFlow.currentCashFormatted, pesewas: cashFlow.currentCashPesewas },
      { metric: 'Payables Due 7 Days', value: cashFlow.payablesDue7DaysFormatted, pesewas: cashFlow.payablesDue7DaysPesewas },
      { metric: 'Payables Due 30 Days', value: cashFlow.payablesDue30DaysFormatted, pesewas: cashFlow.payablesDue30DaysPesewas },
      { metric: 'Projected Revenue 7 Days', value: cashFlow.projectedRevenue7DaysFormatted, pesewas: cashFlow.projectedRevenue7DaysPesewas },
      { metric: 'Projected Revenue 30 Days', value: cashFlow.projectedRevenue30DaysFormatted, pesewas: cashFlow.projectedRevenue30DaysPesewas },
      { metric: 'Cash Runway Days', value: cashFlow.cashRunwayDays },
      { metric: 'Recommendation', value: cashFlow.recommendation },
      { metric: 'Reason', value: cashFlow.recommendationReason },
    ]);

    const expenseSheet = wb.addWorksheet('Expenses');
    expenseSheet.columns = [
      { header: 'Expense Date', key: 'expenseDate', width: 18 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Amount (pesewas)', key: 'amountPesewas', width: 20 },
      { header: 'Amount', key: 'amountFormatted', width: 16 },
      { header: 'Created By', key: 'createdByName', width: 22 },
      { header: 'Approved By', key: 'approvedByName', width: 22 },
    ];
    expenseRows.forEach((row) => expenseSheet.addRow(row));

    const invoicesSheet = wb.addWorksheet('Supplier Invoices');
    invoicesSheet.columns = [
      { header: 'Supplier', key: 'supplierName', width: 28 },
      { header: 'Invoice Number', key: 'invoiceNumber', width: 22 },
      { header: 'Invoice Date', key: 'invoiceDate', width: 18 },
      { header: 'Due Date', key: 'dueDate', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Total (pesewas)', key: 'totalAmountPesewas', width: 18 },
      { header: 'Paid (pesewas)', key: 'paidAmountPesewas', width: 18 },
      { header: 'Balance (pesewas)', key: 'balancePesewas', width: 18 },
    ];
    supplierInvoices.forEach((inv) =>
      invoicesSheet.addRow({
        supplierName: inv.supplierName,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate ?? '',
        status: inv.status,
        totalAmountPesewas: inv.totalAmountPesewas,
        paidAmountPesewas: inv.paidAmountPesewas,
        balancePesewas: inv.balancePesewas,
      }),
    );

    const topProductsSheet = wb.addWorksheet('Top Products');
    topProductsSheet.columns = [
      { header: 'Product Name', key: 'productName', width: 40 },
      { header: 'Units Sold', key: 'unitsSold', width: 12 },
      { header: 'Revenue (pesewas)', key: 'revenuePesewas', width: 18 },
      { header: 'Revenue', key: 'revenueFormatted', width: 16 },
    ];
    topProducts.forEach((product) => topProductsSheet.addRow(product));

    const buffer = await wb.xlsx.writeBuffer();
    const base64Content = Buffer.from(buffer as ArrayBuffer).toString('base64');
    const fileName = `accounting-workbook-${periodStart}-to-${periodEnd}.xlsx`;

    return {
      fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64Content,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async postToGeneralLedger(entry: {
    branchId: string;
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    description: string;
    referenceType: string;
    referenceId: string;
  }): Promise<void> {
    await this.dataSource.query(`
      INSERT INTO general_ledger (
        id, branch_id, account_code, account_name, debit, credit,
        description, reference_type, reference_id, posted_at
      )
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [
      entry.branchId,
      entry.accountCode,
      entry.accountName,
      entry.debit,
      entry.credit,
      entry.description,
      entry.referenceType,
      entry.referenceId,
    ]);
  }

  private getExpenseAccountCode(category: string): string {
    const map: Record<string, string> = {
      UTILITIES: '5100',
      RENT: '5200',
      SALARIES: '5300',
      FUEL: '5400',
      MAINTENANCE: '5500',
      MARKETING: '5600',
      LICENSES: '5700',
      BANK_CHARGES: '5800',
      MISCELLANEOUS: '5900',
    };
    return map[category] ?? '5900';
  }

  private mapExpenseOutput(row: ExpenseRow): ExpenseOutput {
    return {
      id: row.id,
      branchId: row.branch_id,
      category: row.category as never,
      amountPesewas: row.amount_pesewas,
      amountFormatted: this.fmt(row.amount_pesewas),
      description: row.description,
      receiptS3Key: row.receipt_s3_key ?? undefined,
      expenseDate: row.expense_date,
      status: row.status as never,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      approvedBy: row.approved_by ?? undefined,
      approvedByName: row.approved_by_name ?? undefined,
      approvalNotes: row.approval_notes ?? undefined,
      createdAt: row.created_at,
    };
  }

  private mapInvoiceOutput(row: InvoiceRow): SupplierInvoiceOutput {
    const balance = row.total_amount - row.paid_amount;
    const paymentProgressPct = row.total_amount > 0
      ? Math.max(0, Math.min(100, Math.round((row.paid_amount / row.total_amount) * 100)))
      : 0;
    return {
      id: row.id,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      branchId: row.branch_id,
      grnId: row.grn_id ?? undefined,
      invoiceNumber: row.invoice_number,
      invoiceDate: row.invoice_date,
      dueDate: row.due_date ?? undefined,
      totalAmountPesewas: row.total_amount,
      totalAmountFormatted: this.fmt(row.total_amount),
      paidAmountPesewas: row.paid_amount,
      paidAmountFormatted: this.fmt(row.paid_amount),
      balancePesewas: balance,
      balanceFormatted: this.fmt(balance),
      status: row.status,
      paymentStatus: row.payment_status,
      paymentProgressPct,
      daysOutstanding: row.days_outstanding,
      isOverdue: row.is_overdue,
      overdueByDays: row.overdue_by_days > 0 ? row.overdue_by_days : undefined,
      s3PdfKey: row.s3_pdf_key ?? undefined,
      createdAt: row.created_at,
    };
  }

  private fmt(pesewas: number): string {
    return `GH₵${(pesewas / 100).toFixed(2)}`;
  }

  private async getBranchName(branchId: string): Promise<string> {
    const [row] = await this.dataSource.query(`SELECT name FROM branches WHERE id = $1 LIMIT 1`, [
      branchId,
    ]) as Array<{ name: string }>;
    return row?.name ?? branchId;
  }

  private async listApprovedExpensesForBranch(
    branchId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<ExpenseOutput[]> {
    const rows = await this.dataSource.query(
      `
      SELECT
        e.id, e.branch_id, e.category, e.amount_pesewas, e.description,
        e.receipt_s3_key, e.expense_date, e.status, e.created_by,
        u1.name AS created_by_name,
        e.approved_by, u2.name AS approved_by_name,
        e.approval_notes, e.created_at
      FROM expenses e
      JOIN users u1 ON u1.id = e.created_by
      LEFT JOIN users u2 ON u2.id = e.approved_by
      WHERE e.branch_id = $1
        AND e.expense_date >= $2::date
        AND e.expense_date <= $3::date
      ORDER BY e.expense_date DESC, e.created_at DESC
    `,
      [branchId, periodStart, periodEnd],
    ) as ExpenseRow[];

    return rows.map((row) => this.mapExpenseOutput(row));
  }

  private async getSalesLedger(
    branchId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<SalesLedgerRow[]> {
    const at = this.effectiveSaleAt.sql('s');
    return (await this.dataSource.query(
      `
      SELECT
        s.id AS sale_id,
        (${at}) AS sold_at,
        u.name AS cashier_name,
        c.customer_code,
        s.status,
        COALESCE(COUNT(si.id), 0)::int AS item_count,
        COALESCE(SUM(si.total), 0)::int AS subtotal_pesewas,
        COALESCE(SUM(si.vat_amount), 0)::int AS vat_pesewas,
        COALESCE(s.total_amount, 0)::int AS total_pesewas
      FROM sales s
      LEFT JOIN users u ON u.id = s.cashier_id
      LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      WHERE s.branch_id = $1
        AND (${at}) >= $2::timestamptz
        AND (${at}) < ($3::date + INTERVAL '1 day')::timestamptz
      GROUP BY s.id, (${at}), u.name, c.customer_code, s.status, s.total_amount
      ORDER BY (${at}) DESC
    `,
      [branchId, periodStart, periodEnd],
    )) as SalesLedgerRow[];
  }

  private mapOcrPresetOutput(row: OcrPresetRow): OcrColumnMappingPresetOutput {
    const mappings = Object.entries(row.header_map ?? {}).map(([sourceHeader, targetField]) => ({
      sourceHeader,
      targetField,
    }));
    return {
      id: row.id,
      branchId: row.branch_id,
      supplierId: row.supplier_id ?? undefined,
      supplierName: row.supplier_name ?? undefined,
      name: row.name,
      mappings,
      updatedAt: row.updated_at,
    };
  }

  private resolveInvoiceLineUnitCost(line: SupplierInvoiceOcrLineInput): number | null {
    if (line.unitCostPesewas && line.unitCostPesewas > 0) {
      return line.unitCostPesewas;
    }
    const qty = line.quantity && line.quantity > 0 ? line.quantity : 1;
    if (line.lineTotalPesewas && line.lineTotalPesewas > 0 && qty > 0) {
      return Math.max(1, Math.round(line.lineTotalPesewas / qty));
    }
    return null;
  }

  private async resolveInvoiceLineProductId(
    runner: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    supplierId: string,
    line: SupplierInvoiceOcrLineInput,
  ): Promise<string | null> {
    if (line.productId) {
      const rows = await runner.query(
        `SELECT id FROM products WHERE id = $1 AND is_active = true LIMIT 1`,
        [line.productId],
      ) as Array<{ id: string }>;
      if (rows[0]?.id) return rows[0].id;
    }

    if (line.barcode?.trim()) {
      const barcode = line.barcode.trim();
      const rows = await runner.query(`
        SELECT id
        FROM products
        WHERE is_active = true
          AND barcode = $1
          AND (supplier_id = $2 OR supplier_id IS NULL)
        ORDER BY CASE WHEN supplier_id = $2 THEN 0 ELSE 1 END
        LIMIT 1
      `, [barcode, supplierId]) as Array<{ id: string }>;
      if (rows[0]?.id) return rows[0].id;
    }

    if (line.productName?.trim()) {
      const productName = line.productName.trim();
      const likePattern = `%${productName}%`;
      const rows = await runner.query(`
        SELECT id
        FROM products
        WHERE is_active = true
          AND (supplier_id = $1 OR supplier_id IS NULL)
          AND (
            LOWER(name) = LOWER($2)
            OR LOWER(COALESCE(generic_name, '')) = LOWER($2)
            OR name ILIKE $3
            OR COALESCE(generic_name, '') ILIKE $3
          )
        ORDER BY
          CASE
            WHEN LOWER(name) = LOWER($2) THEN 0
            WHEN LOWER(COALESCE(generic_name, '')) = LOWER($2) THEN 1
            WHEN name ILIKE $3 THEN 2
            ELSE 3
          END,
          LENGTH(name) ASC
        LIMIT 1
      `, [supplierId, productName, likePattern]) as Array<{ id: string }>;
      if (rows[0]?.id) return rows[0].id;
    }

    return null;
  }
}
