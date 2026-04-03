import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RevenueReport, TopProduct, DashboardKpis } from './dto/reports.types';
import { SalesEffectiveAtService } from '../sales/sales-effective-at.service';

interface RevRow {
  total_revenue: number;
  vat_collected: number;
  sales_count: number;
  refunds: number;
}

interface TopProductRow {
  product_id: string;
  product_name: string;
  units_sold: number;
  revenue: number;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly effectiveSaleAt: SalesEffectiveAtService,
  ) {}

  // ── Revenue report ────────────────────────────────────────────────────────

  async getRevenueReport(
    branchId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<RevenueReport> {
    const at = this.effectiveSaleAt.sql('s');
    /** Inclusive Accra calendar days (YYYY-MM-DD from the web). */
    const saleAccraDay = `(${at} AT TIME ZONE 'Africa/Accra')::date`;
    const [row] = await this.dataSource.query(`
      SELECT
        COALESCE(SUM(CASE WHEN s.status = 'COMPLETED' THEN s.total_amount ELSE 0 END), 0)::int AS total_revenue,
        COALESCE(SUM(CASE WHEN s.status = 'COMPLETED' THEN s.vat_amount ELSE 0 END), 0)::int AS vat_collected,
        COUNT(CASE WHEN s.status = 'COMPLETED' THEN 1 END)::int AS sales_count,
        COALESCE(SUM(CASE WHEN s.status = 'REFUNDED' THEN s.total_amount ELSE 0 END), 0)::int AS refunds
      FROM sales s
      WHERE s.branch_id = $1
        AND ${saleAccraDay} >= $2::date
        AND ${saleAccraDay} <= $3::date
    `, [branchId, periodStart, periodEnd]) as RevRow[];

    const revenue = row?.total_revenue ?? 0;
    const count = row?.sales_count ?? 0;

    return {
      periodStart,
      periodEnd,
      totalRevenuePesewas: revenue,
      totalRevenueFormatted: this.fmt(revenue),
      vatCollectedPesewas: row?.vat_collected ?? 0,
      vatFormatted: this.fmt(row?.vat_collected ?? 0),
      salesCount: count,
      averageSaleGhs: count > 0 ? revenue / 100 / count : 0,
      refundsPesewas: row?.refunds ?? 0,
    };
  }

  // ── Top products ──────────────────────────────────────────────────────────

  async getTopProducts(
    branchId: string,
    periodStart: string,
    periodEnd: string,
    limit = 10,
  ): Promise<TopProduct[]> {
    const at = this.effectiveSaleAt.sql('s');
    const saleAccraDay = `(${at} AT TIME ZONE 'Africa/Accra')::date`;
    const rows = await this.dataSource.query(`
      SELECT
        si.product_id,
        p.name AS product_name,
        SUM(si.quantity)::int AS units_sold,
        SUM(si.quantity * si.unit_price)::int AS revenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      WHERE s.branch_id = $1
        AND s.status = 'COMPLETED'
        AND ${saleAccraDay} >= $2::date
        AND ${saleAccraDay} <= $3::date
      GROUP BY si.product_id, p.name
      ORDER BY revenue DESC
      LIMIT $4
    `, [branchId, periodStart, periodEnd, limit]) as TopProductRow[];

    return rows.map((r) => ({
      productId: r.product_id,
      productName: r.product_name,
      unitsSold: r.units_sold,
      revenuePesewas: r.revenue,
      revenueFormatted: this.fmt(r.revenue),
    }));
  }

  // ── Dashboard KPIs ────────────────────────────────────────────────────────

  async getDashboardKpis(branchId: string): Promise<DashboardKpis> {
    const at = this.effectiveSaleAt.sql('s');
    const saleAccraDay = `(${at} AT TIME ZONE 'Africa/Accra')::date`;
    const [todayRow, monthRow, prevMonthRow, lowStockRow, staffRow] = await Promise.all([
      // Today (Africa/Accra calendar day)
      this.dataSource.query(`
        SELECT
          COALESCE(SUM(s.total_amount), 0)::int AS revenue,
          COUNT(*)::int AS count
        FROM sales s
        WHERE s.branch_id = $1 AND s.status = 'COMPLETED'
          AND ${saleAccraDay} = (NOW() AT TIME ZONE 'Africa/Accra')::date
      `, [branchId]) as Promise<Array<{ revenue: number; count: number }>>,

      // This month (Accra calendar month)
      this.dataSource.query(`
        SELECT
          COALESCE(SUM(s.total_amount), 0)::int AS revenue,
          COUNT(*)::int AS count
        FROM sales s
        WHERE s.branch_id = $1 AND s.status = 'COMPLETED'
          AND to_char(${at} AT TIME ZONE 'Africa/Accra', 'YYYY-MM')
            = to_char(NOW() AT TIME ZONE 'Africa/Accra', 'YYYY-MM')
      `, [branchId]) as Promise<Array<{ revenue: number; count: number }>>,

      // Previous Accra calendar month (for delta)
      this.dataSource.query(`
        SELECT COALESCE(SUM(s.total_amount), 0)::int AS revenue
        FROM sales s
        WHERE s.branch_id = $1 AND s.status = 'COMPLETED'
          AND to_char(${at} AT TIME ZONE 'Africa/Accra', 'YYYY-MM') = to_char(
            (NOW() AT TIME ZONE 'Africa/Accra')::date - INTERVAL '1 month',
            'YYYY-MM'
          )
      `, [branchId]) as Promise<Array<{ revenue: number }>>,

      // Low stock count
      this.dataSource.query(`
        SELECT COUNT(*)::int AS cnt
        FROM products p
        LEFT JOIN inventory inv ON inv.product_id = p.id AND inv.branch_id = $1
        WHERE p.is_active = true
          AND COALESCE(inv.quantity_on_hand, 0) <= COALESCE(inv.reorder_level, 10)
      `, [branchId]) as Promise<Array<{ cnt: number }>>,

      // Active staff
      this.dataSource.query(`
        SELECT COUNT(*)::int AS cnt FROM users
        WHERE branch_id = $1 AND is_active = true AND role != 'se_admin'
      `, [branchId]) as Promise<Array<{ cnt: number }>>,
    ]);

    const todayRevenue = todayRow[0]?.revenue ?? 0;
    const monthRevenue = monthRow[0]?.revenue ?? 0;
    const prevRevenue = prevMonthRow[0]?.revenue ?? 0;

    const delta = prevRevenue > 0
      ? ((monthRevenue - prevRevenue) / prevRevenue) * 100
      : 0;

    return {
      todayRevenuePesewas: todayRevenue,
      todayRevenueFormatted: this.fmt(todayRevenue),
      todaySalesCount: todayRow[0]?.count ?? 0,
      monthRevenuePesewas: monthRevenue,
      monthRevenueFormatted: this.fmt(monthRevenue),
      monthSalesCount: monthRow[0]?.count ?? 0,
      lowStockCount: lowStockRow[0]?.cnt ?? 0,
      activeStaffCount: staffRow[0]?.cnt ?? 0,
      revenueDeltaPct: Math.round(delta * 10) / 10,
    };
  }

  private fmt(pesewas: number): string {
    return `GH₵${(pesewas / 100).toFixed(2)}`;
  }
}
