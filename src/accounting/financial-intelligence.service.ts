import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SalesEffectiveAtService } from '../sales/sales-effective-at.service';
import {
  WorkingCapitalReport,
  InventoryFinancialMetrics,
  SupplierScorecard,
  ProductProfitability,
  RevenueIntelligence,
  RevenueTrendPoint,
  PayrollAnalytics,
  VatComplianceReport,
  InvestmentIntelligenceReport,
  InvestmentRecommendation,
  FinancialAlert,
  FinancialRatio,
  CfoBriefing,
} from './dto/financial-intelligence.types';

// ── Internal row types ────────────────────────────────────────────────────────

interface MonthlyRevenueRow {
  period: string;
  revenue: number;
  tx_count: number;
  avg_tx: number;
}

interface ProductProfitRow {
  product_id: string;
  product_name: string;
  classification: string;
  supplier_name: string;
  units_sold: number;
  revenue: number;
  cogs: number;
}

interface SupplierRow {
  supplier_id: string;
  supplier_name: string;
  total_purchased: number;
  total_cogs: number;
  outstanding: number;
  overdue: number;
  avg_days_to_pay: number;
}

@Injectable()
export class FinancialIntelligenceService {
  private readonly logger = new Logger(FinancialIntelligenceService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly effectiveSaleAt: SalesEffectiveAtService,
  ) {}

  // ── Public entry point: full CFO briefing ─────────────────────────────────

  /**
   * The complete CFO briefing — everything a hired accountant would present.
   * Covers all financial dimensions of the pharmacy business.
   * RBAC: owner, se_admin only.
   */
  async getCfoBriefing(branchId: string): Promise<CfoBriefing> {
    this.logger.log(`Generating CFO briefing for branch=${branchId}`);

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = now.toISOString().split('T')[0];

    // Run all analytics in parallel for performance
    const [
      branchRow,
      workingCapital,
      inventoryMetrics,
      revenueIntelligence,
      payrollAnalytics,
      vatCompliance,
      topSuppliers,
      topProducts,
      cashRow,
      payablesRow,
      plRow,
    ] = await Promise.all([
      this.getBranchName(branchId),
      this.getWorkingCapital(branchId),
      this.getInventoryFinancialMetrics(branchId),
      this.getRevenueIntelligence(branchId),
      this.getPayrollAnalytics(branchId, monthStart, monthEnd),
      this.getVatCompliance(branchId, now.getFullYear(), now.getMonth() + 1),
      this.getTopSupplierScorecards(branchId, 5),
      this.getTopProductProfitability(branchId, monthStart, monthEnd, 10),
      this.getCurrentCash(branchId),
      this.getTotalPayables(branchId),
      this.getMonthPL(branchId, monthStart, monthEnd),
    ]);

    const investmentIntelligence = await this.getInvestmentIntelligence(
      branchId,
      plRow.netMarginPct,
      workingCapital.cashRunwayDays ?? 0,
      plRow.netProfit,
      revenueIntelligence.cmgr6MonthPct,
    );

    const alerts = this.buildAlerts(workingCapital, inventoryMetrics, vatCompliance, payrollAnalytics, cashRow, payablesRow);
    const keyRatios = this.buildKeyRatios(workingCapital, inventoryMetrics, payrollAnalytics, plRow);
    const { score, label } = this.scoreHealth(workingCapital, plRow, inventoryMetrics, payrollAnalytics);

    const executiveSummary = this.buildExecutiveSummary(
      branchRow,
      plRow,
      workingCapital,
      revenueIntelligence,
      alerts,
      investmentIntelligence,
    );

    return {
      generatedAt: now,
      branchName: branchRow,
      periodCovered: `${monthStart} to ${monthEnd}`,
      monthRevenuePesewas: plRow.revenue,
      monthRevenueFormatted: this.fmt(plRow.revenue),
      monthNetProfitPesewas: plRow.netProfit,
      monthNetProfitFormatted: this.fmt(plRow.netProfit),
      monthNetMarginPct: plRow.netMarginPct,
      cashOnHandPesewas: cashRow,
      cashOnHandFormatted: this.fmt(cashRow),
      totalPayablesPesewas: payablesRow,
      totalPayablesFormatted: this.fmt(payablesRow),
      workingCapital,
      inventoryMetrics,
      revenueIntelligence,
      payrollAnalytics,
      vatCompliance,
      investmentIntelligence,
      alerts,
      keyRatios,
      topSuppliers,
      topProducts,
      executiveSummary,
      overallHealthScore: label,
      healthScoreNumeric: score,
    };
  }

  // ── Working Capital ───────────────────────────────────────────────────────

  async getWorkingCapital(branchId: string): Promise<WorkingCapitalReport & { cashRunwayDays: number }> {
    // Cash on hand
    const cash = await this.getCurrentCash(branchId);

    // Inventory value at cost (current stock valued by latest observed supplier cost per product).
    // Falls back to 65% of sell price if no historical supplier cost exists yet.
    const [invRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(
        inv.quantity_on_hand * COALESCE(latest_cost.unit_cost_pesewas, ROUND(p.unit_price * 0.65))
      ), 0)::int AS inv_value
      FROM inventory inv
      JOIN products p ON p.id = inv.product_id
      LEFT JOIN LATERAL (
        SELECT pch.unit_cost_pesewas
        FROM product_cost_history pch
        WHERE pch.branch_id = $1
          AND pch.product_id = inv.product_id
        ORDER BY pch.observed_at DESC
        LIMIT 1
      ) latest_cost ON true
      WHERE inv.branch_id = $1
        AND p.is_active = true
    `, [branchId]) as Array<{ inv_value: number }>;
    const inventoryValue = invRow?.inv_value ?? 0;

    // Accounts payable (outstanding supplier invoices)
    const payables = await this.getTotalPayables(branchId);

    // Accounts receivable (credit sales — if any; most pharmacy sales are cash)
    const [arRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(s.total_amount), 0)::int AS ar
      FROM sales s
      WHERE s.branch_id = $1 AND s.status = 'CREDIT'
        AND (${this.effectiveSaleAt.sql('s')}) >= NOW() - INTERVAL '90 days'
    `, [branchId]) as Array<{ ar: number }>;
    const accountsReceivable = arRow?.ar ?? 0;

    const currentAssets = cash + inventoryValue + accountsReceivable;
    const currentLiabilities = payables;

    const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 99;
    const quickRatio = currentLiabilities > 0 ? (cash + accountsReceivable) / currentLiabilities : 99;
    const workingCapital = currentAssets - currentLiabilities;

    // Cash runway (days) = cash / avg daily expenses (last 30 days)
    const [expRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(amount_pesewas), 0)::int AS expenses
      FROM expenses WHERE branch_id = $1 AND status = 'APPROVED' AND expense_date >= NOW() - INTERVAL '30 days'
    `, [branchId]) as Array<{ expenses: number }>;
    const avgDailyExpenses = (expRow?.expenses ?? 0) / 30;
    const cashRunwayDays = avgDailyExpenses > 0 ? Math.round(cash / avgDailyExpenses) : 999;

    let healthStatus = 'HEALTHY';
    let narrative = '';

    if (currentRatio < 1.0) {
      healthStatus = 'CRITICAL';
      narrative = `Current ratio of ${currentRatio.toFixed(2)} is below 1.0 — the pharmacy cannot cover its short-term obligations. Immediate action required: collect receivables, negotiate supplier extensions, or inject working capital.`;
    } else if (currentRatio < 1.5 || quickRatio < 1.0) {
      healthStatus = 'WATCH';
      narrative = `Current ratio of ${currentRatio.toFixed(2)} is below the pharmacy benchmark of 1.5. Monitor closely. Quick ratio of ${quickRatio.toFixed(2)} suggests limited liquid assets beyond inventory.`;
    } else {
      narrative = `Working capital is healthy. Current ratio of ${currentRatio.toFixed(2)} exceeds the 1.5 benchmark. The pharmacy has ${this.fmt(workingCapital)} in net working capital with a cash runway of ${cashRunwayDays} days.`;
    }

    return {
      currentAssetsPesewas: currentAssets,
      currentAssetsFormatted: this.fmt(currentAssets),
      currentLiabilitiesPesewas: currentLiabilities,
      currentLiabilitiesFormatted: this.fmt(currentLiabilities),
      workingCapitalPesewas: workingCapital,
      workingCapitalFormatted: this.fmt(workingCapital),
      currentRatio: Math.round(currentRatio * 100) / 100,
      quickRatio: Math.round(quickRatio * 100) / 100,
      cashAndEquivalentsPesewas: cash,
      cashAndEquivalentsFormatted: this.fmt(cash),
      inventoryValuePesewas: inventoryValue,
      inventoryValueFormatted: this.fmt(inventoryValue),
      accountsReceivablePesewas: accountsReceivable,
      accountsReceivableFormatted: this.fmt(accountsReceivable),
      accountsPayablePesewas: payables,
      accountsPayableFormatted: this.fmt(payables),
      healthStatus,
      narrative,
      cashRunwayDays,
    };
  }

  // ── Inventory Financial Metrics ───────────────────────────────────────────

  async getInventoryFinancialMetrics(branchId: string): Promise<InventoryFinancialMetrics> {
    // COGS last 12 months
    const [cogsRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(si.total_amount), 0)::int AS cogs
      FROM supplier_invoices si
      WHERE si.branch_id = $1 AND si.status IN ('MATCHED','PAID')
        AND si.invoice_date >= NOW() - INTERVAL '12 months'
    `, [branchId]) as Array<{ cogs: number }>;
    const annualCogs = cogsRow?.cogs ?? 0;

    // Current inventory value at cost (latest supplier cost per product)
    const [invCostRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(
        inv.quantity_on_hand * COALESCE(latest_cost.unit_cost_pesewas, ROUND(p.unit_price * 0.65))
      ), 0)::int AS cost_value
      FROM inventory inv
      JOIN products p ON p.id = inv.product_id
      LEFT JOIN LATERAL (
        SELECT pch.unit_cost_pesewas
        FROM product_cost_history pch
        WHERE pch.branch_id = $1
          AND pch.product_id = inv.product_id
        ORDER BY pch.observed_at DESC
        LIMIT 1
      ) latest_cost ON true
      WHERE inv.branch_id = $1
        AND p.is_active = true
    `, [branchId]) as Array<{ cost_value: number }>;
    const inventoryAtCost = invCostRow?.cost_value ?? 0;

    // Inventory at selling price
    const [invSellRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(p.unit_price * inv.quantity_on_hand), 0)::int AS sell_value
      FROM inventory inv
      JOIN products p ON p.id = inv.product_id
      WHERE inv.branch_id = $1 AND p.is_active = true
    `, [branchId]) as Array<{ sell_value: number }>;
    const inventoryAtSell = invSellRow?.sell_value ?? 0;

    // Turnover ratio = COGS / avg inventory (using current as proxy)
    const avgInventory = inventoryAtCost > 0 ? inventoryAtCost : 1;
    const turnoverRatio = annualCogs > 0 ? annualCogs / avgInventory : 0;
    const daysInventoryOutstanding = turnoverRatio > 0 ? 365 / turnoverRatio : 365;

    // Slow-moving stock (no sales in 60+ days)
    const [slowRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(p.unit_price * inv.quantity_on_hand), 0)::int AS slow_value
      FROM inventory inv
      JOIN products p ON p.id = inv.product_id
      WHERE inv.branch_id = $1 AND p.is_active = true
        AND p.id NOT IN (
          SELECT DISTINCT si2.product_id FROM sale_items si2
          JOIN sales s ON s.id = si2.sale_id
          WHERE s.branch_id = $1 AND (${this.effectiveSaleAt.sql('s')}) >= NOW() - INTERVAL '60 days'
        )
    `, [branchId]) as Array<{ slow_value: number }>;
    const slowMovingValue = slowRow?.slow_value ?? 0;

    // Near-expiry stock (expiring within 90 days)
    const [expiryRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(p.unit_price * inv.quantity_on_hand), 0)::int AS expiry_value
      FROM inventory inv
      JOIN products p ON p.id = inv.product_id
      JOIN stock_movements sm ON sm.product_id = p.id AND sm.branch_id = $1
      WHERE inv.branch_id = $1 AND p.is_active = true
        AND sm.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '90 days'
    `, [branchId]) as Array<{ expiry_value: number }>;
    const nearExpiryValue = expiryRow?.expiry_value ?? 0;

    // Shrinkage (write-offs / total received)
    const [shrinkRow] = await this.dataSource.query(`
      SELECT
        COALESCE(SUM(CASE WHEN movement_type = 'ADJUSTMENT' AND quantity < 0 THEN ABS(quantity) ELSE 0 END), 0) AS writeoffs,
        COALESCE(SUM(CASE WHEN movement_type = 'PURCHASE' THEN quantity ELSE 0 END), 0) AS received
      FROM stock_movements WHERE branch_id = $1 AND created_at >= NOW() - INTERVAL '12 months'
    `, [branchId]) as Array<{ writeoffs: number; received: number }>;
    const shrinkageRate = (shrinkRow?.received ?? 0) > 0
      ? ((shrinkRow?.writeoffs ?? 0) / (shrinkRow?.received ?? 1)) * 100
      : 0;

    const potentialMargin = inventoryAtCost > 0
      ? ((inventoryAtSell - inventoryAtCost) / inventoryAtSell) * 100
      : 0;

    let recommendation = '';
    if (turnoverRatio < 6) {
      recommendation = `Inventory turnover of ${turnoverRatio.toFixed(1)}x is below the 8x pharmacy benchmark. Consider running promotions on slow-moving stock (${this.fmt(slowMovingValue)} at risk) and reducing reorder quantities for low-velocity products.`;
    } else if (nearExpiryValue > 0) {
      recommendation = `Turnover is healthy at ${turnoverRatio.toFixed(1)}x. However, ${this.fmt(nearExpiryValue)} of stock expires within 90 days — prioritise dispensing these batches (FEFO) and consider supplier returns where possible.`;
    } else {
      recommendation = `Excellent inventory efficiency. Turnover of ${turnoverRatio.toFixed(1)}x with DIO of ${Math.round(daysInventoryOutstanding)} days. Shrinkage rate of ${shrinkageRate.toFixed(2)}% is within acceptable range.`;
    }

    return {
      inventoryTurnoverRatio: Math.round(turnoverRatio * 10) / 10,
      daysInventoryOutstanding: Math.round(daysInventoryOutstanding),
      inventoryValueAtCostPesewas: inventoryAtCost,
      inventoryValueAtCostFormatted: this.fmt(inventoryAtCost),
      inventoryValueAtSellingPricePesewas: inventoryAtSell,
      inventoryValueAtSellingPriceFormatted: this.fmt(inventoryAtSell),
      potentialMarginPct: Math.round(potentialMargin * 10) / 10,
      slowMovingStockValuePesewas: slowMovingValue,
      slowMovingStockValueFormatted: this.fmt(slowMovingValue),
      nearExpiryValuePesewas: nearExpiryValue,
      nearExpiryValueFormatted: this.fmt(nearExpiryValue),
      shrinkageRatePct: Math.round(shrinkageRate * 100) / 100,
      recommendation,
    };
  }

  // ── Revenue Intelligence ──────────────────────────────────────────────────

  async getRevenueIntelligence(branchId: string): Promise<RevenueIntelligence> {
    const at = this.effectiveSaleAt.sql('s');
    // Monthly trend — last 13 months (12 + current partial)
    const monthlyRows = await this.dataSource.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', (${at}) AT TIME ZONE 'Africa/Accra'), 'YYYY-MM') AS period,
        COALESCE(SUM(s.total_amount), 0)::int AS revenue,
        COUNT(*)::int AS tx_count,
        COALESCE(AVG(s.total_amount), 0)::float AS avg_tx
      FROM sales s
      WHERE s.branch_id = $1 AND s.status = 'COMPLETED'
        AND (${at}) >= NOW() - INTERVAL '13 months'
      GROUP BY 1 ORDER BY 1 ASC
    `, [branchId]) as MonthlyRevenueRow[];

    const trend: RevenueTrendPoint[] = monthlyRows.map((r, i) => ({
      period: r.period,
      revenuePesewas: r.revenue,
      revenueFormatted: this.fmt(r.revenue),
      transactionCount: r.tx_count,
      avgTransactionGhs: Math.round((r.avg_tx / 100) * 100) / 100,
      growthPct: i > 0 && monthlyRows[i - 1].revenue > 0
        ? Math.round(((r.revenue - monthlyRows[i - 1].revenue) / monthlyRows[i - 1].revenue) * 1000) / 10
        : undefined,
    }));

    // MoM growth
    const len = trend.length;
    const momGrowth = len >= 2 && trend[len - 2].revenuePesewas > 0
      ? ((trend[len - 1].revenuePesewas - trend[len - 2].revenuePesewas) / trend[len - 2].revenuePesewas) * 100
      : 0;

    // YoY growth
    const yoyGrowth = len >= 13 && trend[len - 13].revenuePesewas > 0
      ? ((trend[len - 1].revenuePesewas - trend[len - 13].revenuePesewas) / trend[len - 13].revenuePesewas) * 100
      : 0;

    // CMGR over 6 months = (end/start)^(1/6) - 1
    const cmgr6 = len >= 7 && trend[len - 7].revenuePesewas > 0
      ? (Math.pow(trend[len - 1].revenuePesewas / trend[len - 7].revenuePesewas, 1 / 6) - 1) * 100
      : 0;

    // Linear regression for next month projection
    const recentMonths = trend.slice(-6);
    const projectedNext = this.linearRegressionNextValue(recentMonths.map((r) => r.revenuePesewas));

    // Best day of week
    const [dayRow] = await this.dataSource.query(`
      SELECT TO_CHAR((${at}) AT TIME ZONE 'Africa/Accra', 'Day') AS day_name,
             SUM(s.total_amount)::int AS revenue
      FROM sales s WHERE s.branch_id = $1 AND s.status = 'COMPLETED'
        AND (${at}) >= NOW() - INTERVAL '90 days'
      GROUP BY 1 ORDER BY 2 DESC LIMIT 1
    `, [branchId]) as Array<{ day_name: string; revenue: number }>;

    // Peak hour
    const [hourRow] = await this.dataSource.query(`
      SELECT EXTRACT(HOUR FROM (${at}) AT TIME ZONE 'Africa/Accra')::int AS hour,
             SUM(s.total_amount)::int AS revenue
      FROM sales s WHERE s.branch_id = $1 AND s.status = 'COMPLETED'
        AND (${at}) >= NOW() - INTERVAL '90 days'
      GROUP BY 1 ORDER BY 2 DESC LIMIT 1
    `, [branchId]) as Array<{ hour: number; revenue: number }>;

    // Revenue per Rx
    const [rxRow] = await this.dataSource.query(`
      SELECT
        COALESCE(SUM(s.total_amount), 0)::float AS rx_revenue,
        COUNT(DISTINCT p.id)::float AS rx_count
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      JOIN products p ON p.id = si.product_id AND p.requires_rx = true
      WHERE s.branch_id = $1 AND s.status = 'COMPLETED'
        AND (${at}) >= NOW() - INTERVAL '30 days'
    `, [branchId]) as Array<{ rx_revenue: number; rx_count: number }>;
    const revenuePerRx = (rxRow?.rx_count ?? 0) > 0
      ? (rxRow?.rx_revenue ?? 0) / (rxRow?.rx_count ?? 1) / 100
      : 0;

    // Trend signal
    let trendSignal = 'STABLE';
    if (cmgr6 > 5) trendSignal = 'ACCELERATING';
    else if (cmgr6 > 1) trendSignal = 'STABLE';
    else if (cmgr6 > -2) trendSignal = 'DECELERATING';
    else trendSignal = 'DECLINING';

    const peakHour = hourRow
      ? `${String(hourRow.hour).padStart(2, '0')}:00–${String(hourRow.hour + 1).padStart(2, '0')}:00`
      : 'N/A';

    const insight = this.buildRevenueInsight(trendSignal, momGrowth, yoyGrowth, cmgr6, projectedNext);

    // Payment mix — from sale_tenders (last 30 days)
    let paymentMix: Array<{ method: string; label: string; totalPesewas: number; totalFormatted: string; sharePct: number }> = [];
    try {
      const tenderRows = await this.dataSource.query(`
        SELECT
          st.method,
          COALESCE(SUM(st.amount_pesewas), 0)::int AS total
        FROM sale_tenders st
        JOIN sales s ON s.id = st.sale_id
        WHERE s.branch_id = $1 AND s.status = 'COMPLETED'
          AND (${at}) >= NOW() - INTERVAL '30 days'
        GROUP BY st.method ORDER BY total DESC
      `, [branchId]) as Array<{ method: string; total: number }>;

      const methodLabels: Record<string, string> = {
        CASH: 'Cash', MTN_MOMO: 'MTN MoMo', VODAFONE_CASH: 'Vodafone Cash',
        AIRTELTIGO_MONEY: 'AirtelTigo Money', CARD: 'Card', SPLIT: 'Split',
      };
      const grandTotal = tenderRows.reduce((s, r) => s + r.total, 0);
      paymentMix = tenderRows.map(r => ({
        method: r.method,
        label: methodLabels[r.method] ?? r.method,
        totalPesewas: r.total,
        totalFormatted: this.fmt(r.total),
        sharePct: grandTotal > 0 ? Math.round((r.total / grandTotal) * 1000) / 10 : 0,
      }));
    } catch {
      // sale_tenders not available — degrade gracefully
    }

    return {
      monthlyTrend: trend,
      momGrowthPct: Math.round(momGrowth * 10) / 10,
      yoyGrowthPct: Math.round(yoyGrowth * 10) / 10,
      cmgr6MonthPct: Math.round(cmgr6 * 10) / 10,
      projectedNextMonthPesewas: Math.max(0, projectedNext),
      projectedNextMonthFormatted: this.fmt(Math.max(0, projectedNext)),
      bestDayOfWeek: (dayRow?.day_name ?? 'N/A').trim(),
      peakHour,
      revenuePerRxGhs: Math.round(revenuePerRx * 100) / 100,
      trendSignal,
      insight,
      paymentMix,
    };
  }

  // ── Payroll Analytics ─────────────────────────────────────────────────────

  async getPayrollAnalytics(branchId: string, periodStart: string, periodEnd: string): Promise<PayrollAnalytics> {
    const [payrollRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(amount_pesewas), 0)::int AS payroll
      FROM expenses
      WHERE branch_id = $1 AND category = 'SALARIES' AND status = 'APPROVED'
        AND expense_date >= $2::date AND expense_date <= $3::date
    `, [branchId, periodStart, periodEnd]) as Array<{ payroll: number }>;
    const payroll = payrollRow?.payroll ?? 0;

    const eff = this.effectiveSaleAt.sql('s');
    const [revenueRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(s.total_amount), 0)::int AS revenue,
             COALESCE(SUM(s.total_amount - s.vat_amount), 0)::int AS gross_profit
      FROM sales s
      WHERE s.branch_id = $1 AND s.status = 'COMPLETED'
        AND (${eff}) >= $2::timestamptz
        AND (${eff}) < ($3::date + INTERVAL '1 day')::timestamptz
    `, [branchId, periodStart, periodEnd]) as Array<{ revenue: number; gross_profit: number }>;
    const revenue = revenueRow?.revenue ?? 0;
    const grossProfit = revenueRow?.gross_profit ?? 0;

    const [staffRow] = await this.dataSource.query(`
      SELECT COUNT(*)::int AS count FROM users WHERE branch_id = $1 AND is_active = true
    `, [branchId]) as Array<{ count: number }>;
    const staffCount = staffRow?.count ?? 1;

    const payrollRatio = revenue > 0 ? (payroll / revenue) * 100 : 0;
    const revenuePerStaff = revenue / staffCount / 100;
    const gpPerStaff = grossProfit / staffCount / 100;

    let efficiencyRating = 'EFFICIENT';
    let recommendation = '';

    if (payrollRatio > 30) {
      efficiencyRating = 'OVERSTAFFED';
      recommendation = `Payroll ratio of ${payrollRatio.toFixed(1)}% exceeds the 30% threshold. Review staffing levels or increase revenue through extended hours or marketing. Revenue per staff member is ${this.fmtGhs(revenuePerStaff)}.`;
    } else if (payrollRatio > 25) {
      efficiencyRating = 'WATCH';
      recommendation = `Payroll ratio of ${payrollRatio.toFixed(1)}% is approaching the 25% benchmark. Monitor closely. Consider whether additional revenue streams (delivery service, health screenings) can improve the ratio.`;
    } else {
      recommendation = `Payroll efficiency is excellent at ${payrollRatio.toFixed(1)}% of revenue. Each staff member generates ${this.fmtGhs(revenuePerStaff)} in revenue and ${this.fmtGhs(gpPerStaff)} in gross profit.`;
    }

    return {
      totalPayrollPesewas: payroll,
      totalPayrollFormatted: this.fmt(payroll),
      payrollRatioPct: Math.round(payrollRatio * 10) / 10,
      revenuePerStaffGhs: Math.round(revenuePerStaff * 100) / 100,
      grossProfitPerStaffGhs: Math.round(gpPerStaff * 100) / 100,
      activeStaffCount: staffCount,
      efficiencyRating,
      recommendation,
    };
  }

  // ── VAT Compliance ────────────────────────────────────────────────────────

  // Ghana GRA: VAT compliance report for a given month
  async getVatCompliance(branchId: string, year: number, month: number): Promise<VatComplianceReport> {
    const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const period = `${year}-${String(month).padStart(2, '0')}`;
    const dueDay = new Date(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 30);
    const returnDueDate = dueDay.toISOString().split('T')[0];

    // Ghana GRA: VAT = 12.5%, NHIL = 2.5% on taxable sales
    const [salesRow] = await this.dataSource.query(`
      SELECT
        COALESCE(SUM(CASE WHEN p.requires_rx = false THEN s.total_amount ELSE 0 END), 0)::int AS taxable,
        COALESCE(SUM(CASE WHEN p.requires_rx = true THEN s.total_amount ELSE 0 END), 0)::int AS exempt,
        COALESCE(SUM(s.vat_amount), 0)::int AS vat_collected
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      JOIN products p ON p.id = si.product_id
      WHERE s.branch_id = $1 AND s.status = 'COMPLETED'
        AND (${this.effectiveSaleAt.sql('s')}) >= $2::timestamptz AND (${this.effectiveSaleAt.sql('s')}) < $3::timestamptz
    `, [branchId, periodStart, nextMonth]) as Array<{ taxable: number; exempt: number; vat_collected: number }>;

    const taxableSales = salesRow?.taxable ?? 0;
    const exemptSales = salesRow?.exempt ?? 0;
    const vatCollected = salesRow?.vat_collected ?? 0;
    // Ghana GRA: 12.5% VAT + 2.5% NHIL = 15% total; split proportionally
    const vatPortion = Math.round(vatCollected * (12.5 / 15));
    const nhilPortion = vatCollected - vatPortion;

    // Input VAT on supplier invoices (15% of invoice total — claimable)
    const [inputRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(total_amount * 0.15), 0)::int AS input_vat
      FROM supplier_invoices
      WHERE branch_id = $1 AND status IN ('MATCHED','PAID')
        AND invoice_date >= $2::date AND invoice_date < $3::date
    `, [branchId, periodStart, nextMonth]) as Array<{ input_vat: number }>;
    const inputVat = inputRow?.input_vat ?? 0;

    const netVatPayable = Math.max(0, vatCollected - inputVat);
    const now = new Date();
    const dueDate = new Date(returnDueDate);
    const filingStatus = now > dueDate ? 'OVERDUE' : 'PENDING';

    const reminder = filingStatus === 'OVERDUE'
      ? `⚠️ VAT return for ${period} is OVERDUE. File immediately with GRA to avoid penalties. Net payable: ${this.fmt(netVatPayable)}.`
      : `VAT return for ${period} is due by ${returnDueDate}. Net payable to GRA: ${this.fmt(netVatPayable)}. Ensure all supplier invoices are matched before filing.`;

    return {
      period,
      returnDueDate,
      taxableSalesPesewas: taxableSales,
      taxableSalesFormatted: this.fmt(taxableSales),
      exemptSalesPesewas: exemptSales,
      exemptSalesFormatted: this.fmt(exemptSales),
      vatCollectedPesewas: vatPortion,
      vatCollectedFormatted: this.fmt(vatPortion),
      nhilCollectedPesewas: nhilPortion,
      nhilCollectedFormatted: this.fmt(nhilPortion),
      totalTaxLiabilityPesewas: vatCollected,
      totalTaxLiabilityFormatted: this.fmt(vatCollected),
      inputVatPesewas: inputVat,
      inputVatFormatted: this.fmt(inputVat),
      netVatPayablePesewas: netVatPayable,
      netVatPayableFormatted: this.fmt(netVatPayable),
      filingStatus,
      reminder,
    };
  }

  // ── Supplier Scorecards ───────────────────────────────────────────────────

  async getTopSupplierScorecards(branchId: string, limit: number): Promise<SupplierScorecard[]> {
    const rows = await this.dataSource.query(`
      SELECT
        s.id AS supplier_id,
        s.name AS supplier_name,
        COALESCE(SUM(si.total_amount), 0)::int AS total_purchased,
        COALESCE(SUM(si.total_amount - si.paid_amount), 0)::int AS outstanding,
        COALESCE(SUM(CASE WHEN si.due_date < NOW() THEN si.total_amount - si.paid_amount ELSE 0 END), 0)::int AS overdue,
        COALESCE(AVG(EXTRACT(EPOCH FROM (sp.paid_at - si.invoice_date)) / 86400), 0)::float AS avg_days_to_pay,
        COALESCE(SUM(si.total_amount), 0)::int AS total_cogs
      FROM suppliers s
      JOIN supplier_invoices si ON si.supplier_id = s.id AND si.branch_id = $1
      LEFT JOIN supplier_payments sp ON sp.invoice_id = si.id
      WHERE s.is_active = true
        AND si.invoice_date >= NOW() - INTERVAL '12 months'
      GROUP BY s.id, s.name
      ORDER BY total_purchased DESC
      LIMIT $2
    `, [branchId, limit]) as SupplierRow[];

    // Total COGS for share calculation
    const totalCogs = rows.reduce((sum, r) => sum + r.total_cogs, 0) || 1;

    return rows.map((r, i) => {
      const cogsShare = (r.total_purchased / totalCogs) * 100;
      // ABC: A = top 70% of spend, B = next 20%, C = bottom 10%
      const cumulativeShare = rows.slice(0, i + 1).reduce((s, x) => s + (x.total_purchased / totalCogs) * 100, 0);
      const abcTier = cumulativeShare <= 70 ? 'A' : cumulativeShare <= 90 ? 'B' : 'C';

      // Relationship recommendation based on tier + overdue
      let relationship = 'STANDARD';
      if (abcTier === 'A' && r.overdue === 0) relationship = 'STRATEGIC';
      else if (abcTier === 'A') relationship = 'PREFERRED';
      else if (r.overdue > 0) relationship = 'REVIEW';

      return {
        supplierId: r.supplier_id,
        supplierName: r.supplier_name,
        totalPurchasedPesewas: r.total_purchased,
        totalPurchasedFormatted: this.fmt(r.total_purchased),
        cogsSharePct: Math.round(cogsShare * 10) / 10,
        avgGrossMarginPct: 0, // Would need product-level cost data — placeholder
        avgDaysToPayDpo: Math.round(r.avg_days_to_pay),
        outstandingPesewas: r.outstanding,
        outstandingFormatted: this.fmt(r.outstanding),
        overduePesewas: r.overdue,
        onTimeDeliveryRatePct: 95, // Placeholder — would need delivery tracking
        abcTier,
        relationshipRecommendation: relationship,
      };
    });
  }

  // ── Product Profitability ─────────────────────────────────────────────────

  async getTopProductProfitability(
    branchId: string,
    periodStart: string,
    periodEnd: string,
    limit: number,
  ): Promise<ProductProfitability[]> {
    const rows = await this.dataSource.query(`
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        p.classification,
        COALESCE(s.name, 'Unknown') AS supplier_name,
        COALESCE(SUM(si2.quantity), 0)::int AS units_sold,
        COALESCE(SUM(si2.quantity * si2.unit_price), 0)::int AS revenue,
        COALESCE(SUM(
          si2.quantity * COALESCE(latest_cost.unit_cost_pesewas, ROUND(p.unit_price * 0.65))
        ), 0)::int AS cogs
      FROM products p
      JOIN sale_items si2 ON si2.product_id = p.id
      JOIN sales sa ON sa.id = si2.sale_id AND sa.branch_id = $1
        AND sa.status = 'COMPLETED'
        AND (${this.effectiveSaleAt.sql('sa')}) >= $2::timestamptz
        AND (${this.effectiveSaleAt.sql('sa')}) < ($3::date + INTERVAL '1 day')::timestamptz
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN LATERAL (
        SELECT pch.unit_cost_pesewas
        FROM product_cost_history pch
        WHERE pch.branch_id = $1
          AND pch.product_id = p.id
        ORDER BY pch.observed_at DESC
        LIMIT 1
      ) latest_cost ON true
      WHERE p.is_active = true
      GROUP BY p.id, p.name, p.classification, s.name
      ORDER BY revenue DESC
      LIMIT $4
    `, [branchId, periodStart, periodEnd, limit]) as ProductProfitRow[];

    const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0) || 1;

    return rows.map((r) => {
      const grossProfit = r.revenue - r.cogs;
      const grossMargin = r.revenue > 0 ? (grossProfit / r.revenue) * 100 : 0;
      const revenueContrib = (r.revenue / totalRevenue) * 100;

      // BCG matrix: high margin + high volume = STAR, high margin + low volume = CASH_COW, etc.
      const isHighMargin = grossMargin > 30;
      const isHighVolume = r.units_sold > 50;
      let bcg = 'QUESTION_MARK';
      if (isHighMargin && isHighVolume) bcg = 'STAR';
      else if (isHighMargin && !isHighVolume) bcg = 'CASH_COW';
      else if (!isHighMargin && isHighVolume) bcg = 'QUESTION_MARK';
      else bcg = 'DOG';

      const action = bcg === 'STAR' ? 'PROMOTE' : bcg === 'CASH_COW' ? 'MAINTAIN' : bcg === 'QUESTION_MARK' ? 'REVIEW_PRICE' : 'DISCONTINUE';
      const abcTier = revenueContrib > 10 ? 'A' : revenueContrib > 3 ? 'B' : 'C';

      return {
        productId: r.product_id,
        productName: r.product_name,
        classification: r.classification,
        supplierName: r.supplier_name,
        unitsSold: r.units_sold,
        revenuePesewas: r.revenue,
        revenueFormatted: this.fmt(r.revenue),
        cogsPesewas: r.cogs,
        grossProfitPesewas: grossProfit,
        grossProfitFormatted: this.fmt(grossProfit),
        grossMarginPct: Math.round(grossMargin * 10) / 10,
        revenueContributionPct: Math.round(revenueContrib * 10) / 10,
        abcTier,
        bcgClassification: bcg,
        action,
      };
    });
  }

  // ── Investment Intelligence ───────────────────────────────────────────────

  /**
   * Only fires recommendations when the business is genuinely profitable.
   * Benchmarks: net margin > 10%, cash runway > 60 days, positive CMGR.
   */
  async getInvestmentIntelligence(
    branchId: string,
    netMarginPct: number,
    cashRunwayDays: number,
    netProfitPesewas: number,
    cmgr6Month: number,
  ): Promise<InvestmentIntelligenceReport> {
    const qualifies = netMarginPct > 10 && cashRunwayDays > 60 && netProfitPesewas > 0;

    if (!qualifies) {
      const reason = netProfitPesewas <= 0
        ? `Business is not profitable this period (net profit: ${this.fmt(netProfitPesewas)}). Focus on reducing COGS and operating expenses before considering investment.`
        : cashRunwayDays <= 60
          ? `Cash runway of ${cashRunwayDays} days is insufficient for investment. Build cash reserves to at least 90 days before deploying capital.`
          : `Net margin of ${netMarginPct.toFixed(1)}% is below the 10% threshold for investment recommendations. Target 15%+ margin first.`;

      return {
        qualifiesForInvestment: false,
        qualificationReason: reason,
        netProfitMarginPct: netMarginPct,
        cashRunwayDays,
        recommendations: [],
        executiveSummary: reason,
      };
    }

    // Gather data to build intelligent recommendations
    const [invRow] = await this.dataSource.query(`
      SELECT COUNT(*)::int AS low_stock_count
      FROM inventory inv
      JOIN products p ON p.id = inv.product_id
      WHERE inv.branch_id = $1 AND p.is_active = true
        AND inv.quantity_on_hand <= inv.reorder_level
    `, [branchId]) as Array<{ low_stock_count: number }>;
    const lowStockCount = invRow?.low_stock_count ?? 0;

    const [branchRow] = await this.dataSource.query(`
      SELECT COUNT(*)::int AS branch_count FROM branches WHERE organization_id = (
        SELECT organization_id FROM branches WHERE id = $1
      ) AND is_active = true
    `, [branchId]) as Array<{ branch_count: number }>;
    const branchCount = branchRow?.branch_count ?? 1;

    const [staffRow] = await this.dataSource.query(`
      SELECT COUNT(*)::int AS count FROM users WHERE branch_id = $1 AND is_active = true
    `, [branchId]) as Array<{ count: number }>;
    const staffCount = staffRow?.count ?? 0;

    const recommendations: InvestmentRecommendation[] = [];

    // 1. Expand inventory if low stock is high and growth is positive
    if (lowStockCount > 10 && cmgr6Month > 2) {
      recommendations.push({
        type: 'EXPAND_INVENTORY',
        title: 'Expand Inventory to Meet Growing Demand',
        rationale: `${lowStockCount} products are at or below reorder level while revenue is growing at ${cmgr6Month.toFixed(1)}% CMGR. Stocking out during growth phase costs sales and damages customer loyalty. Increase reorder quantities by 20–30% for top-selling products.`,
        estimatedInvestmentPesewas: Math.round(netProfitPesewas * 0.4),
        estimatedInvestmentFormatted: this.fmt(Math.round(netProfitPesewas * 0.4)),
        estimatedRoi12MonthPct: 35,
        paybackMonths: 3,
        confidence: 'HIGH',
        riskLevel: 'LOW',
        urgency: 'IMMEDIATE',
      });
    }

    // 2. Open second branch if single branch and strong growth
    if (branchCount === 1 && cmgr6Month > 5 && netMarginPct > 15) {
      recommendations.push({
        type: 'OPEN_BRANCH',
        title: 'Open Second Branch — Growth Justifies Expansion',
        rationale: `Revenue growing at ${cmgr6Month.toFixed(1)}% CMGR with ${netMarginPct.toFixed(1)}% net margin. Ghana's pharmaceutical market is growing — a second branch in a nearby neighbourhood could double revenue within 18 months. Recommended areas: Tema, East Legon, or Spintex Road (high foot traffic, underserved pharmacy density).`,
        estimatedInvestmentPesewas: 5000000 * 100, // GH₵50,000 setup cost
        estimatedInvestmentFormatted: 'GH₵50,000.00',
        estimatedRoi12MonthPct: 45,
        paybackMonths: 14,
        confidence: 'MEDIUM',
        riskLevel: 'MEDIUM',
        urgency: 'WITHIN_6_MONTHS',
      });
    }

    // 3. Hire delivery staff if revenue is strong
    if (netMarginPct > 12 && staffCount < 8) {
      recommendations.push({
        type: 'HIRE_STAFF',
        title: 'Add Delivery Service — Capture Home Delivery Market',
        rationale: `With ${netMarginPct.toFixed(1)}% net margin, the business can absorb a delivery rider salary (approx. GH₵1,200/month). Home delivery is growing rapidly in Accra — pharmacies offering delivery see 15–25% revenue uplift from repeat customers and Rx refills.`,
        estimatedInvestmentPesewas: 120000 * 100, // GH₵1,200/month × 12
        estimatedInvestmentFormatted: 'GH₵14,400.00/year',
        estimatedRoi12MonthPct: 25,
        paybackMonths: 6,
        confidence: 'HIGH',
        riskLevel: 'LOW',
        urgency: 'WITHIN_3_MONTHS',
      });
    }

    // 4. Marketing investment if growth is slowing
    if (cmgr6Month < 2 && netMarginPct > 12) {
      recommendations.push({
        type: 'MARKETING',
        title: 'Invest in Digital Marketing to Reignite Growth',
        rationale: `Revenue growth has slowed to ${cmgr6Month.toFixed(1)}% CMGR. A targeted social media campaign (Facebook/Instagram in Accra) and Google My Business optimisation can increase walk-in traffic by 10–20%. Budget: GH₵500–1,000/month for 3 months.`,
        estimatedInvestmentPesewas: 300000, // GH₵3,000
        estimatedInvestmentFormatted: 'GH₵3,000.00',
        estimatedRoi12MonthPct: 60,
        paybackMonths: 2,
        confidence: 'MEDIUM',
        riskLevel: 'LOW',
        urgency: 'WITHIN_3_MONTHS',
      });
    }

    // 5. Treasury / savings if cash is very healthy
    if (cashRunwayDays > 180 && netProfitPesewas > 500000) {
      recommendations.push({
        type: 'TREASURY',
        title: 'Deploy Excess Cash into Treasury Bills',
        rationale: `Cash runway of ${cashRunwayDays} days indicates excess liquidity. Ghana Government 91-day Treasury Bills currently yield ~28% p.a. (Bank of Ghana rate). Deploying ${this.fmt(Math.round(netProfitPesewas * 0.3))} into T-Bills generates passive income while maintaining operational liquidity.`,
        estimatedInvestmentPesewas: Math.round(netProfitPesewas * 0.3),
        estimatedInvestmentFormatted: this.fmt(Math.round(netProfitPesewas * 0.3)),
        estimatedRoi12MonthPct: 28,
        paybackMonths: 4,
        confidence: 'HIGH',
        riskLevel: 'LOW',
        urgency: 'WITHIN_3_MONTHS',
      });
    }

    // Sort by estimated ROI descending
    recommendations.sort((a, b) => b.estimatedRoi12MonthPct - a.estimatedRoi12MonthPct);

    const summary = recommendations.length > 0
      ? `The business qualifies for investment with ${netMarginPct.toFixed(1)}% net margin and ${cashRunwayDays}-day cash runway. Top recommendation: ${recommendations[0].title}. Estimated 12-month ROI: ${recommendations[0].estimatedRoi12MonthPct}%.`
      : `Business is profitable but no high-confidence investment opportunities identified at this time. Continue building cash reserves and monitor growth trajectory.`;

    return {
      qualifiesForInvestment: true,
      qualificationReason: `Net margin ${netMarginPct.toFixed(1)}% > 10% threshold. Cash runway ${cashRunwayDays} days > 60-day minimum. Business is healthy and ready for strategic investment.`,
      netProfitMarginPct: netMarginPct,
      cashRunwayDays,
      recommendations,
      executiveSummary: summary,
    };
  }

  // ── Alerts engine ─────────────────────────────────────────────────────────

  private buildAlerts(
    wc: WorkingCapitalReport,
    inv: InventoryFinancialMetrics,
    vat: VatComplianceReport,
    payroll: PayrollAnalytics,
    cash: number,
    payables: number,
  ): FinancialAlert[] {
    const alerts: FinancialAlert[] = [];

    if (wc.healthStatus === 'CRITICAL') {
      alerts.push({ severity: 'CRITICAL', category: 'CASH', title: 'Working Capital Crisis', message: wc.narrative, action: 'Negotiate supplier payment extensions immediately', impactPesewas: wc.workingCapitalPesewas, impactFormatted: wc.workingCapitalFormatted });
    }
    if (wc.healthStatus === 'WATCH') {
      alerts.push({ severity: 'WARNING', category: 'CASH', title: 'Working Capital Under Pressure', message: wc.narrative, action: 'Review payment terms with top 3 suppliers' });
    }
    if (payables > cash) {
      alerts.push({ severity: 'CRITICAL', category: 'PAYABLES', title: 'Payables Exceed Cash on Hand', message: `Outstanding supplier payables (${this.fmt(payables)}) exceed cash on hand (${this.fmt(cash)}). Risk of default.`, action: 'Prioritise collections and negotiate payment plans', impactPesewas: payables - cash, impactFormatted: this.fmt(payables - cash) });
    }
    if (inv.nearExpiryValuePesewas > 0) {
      alerts.push({ severity: 'WARNING', category: 'INVENTORY', title: 'Near-Expiry Stock Risk', message: `${inv.nearExpiryValueFormatted} of stock expires within 90 days. Prioritise FEFO dispensing.`, action: 'Run promotions on near-expiry items or arrange supplier returns', impactPesewas: inv.nearExpiryValuePesewas, impactFormatted: inv.nearExpiryValueFormatted });
    }
    if (inv.slowMovingStockValuePesewas > 0) {
      alerts.push({ severity: 'WARNING', category: 'INVENTORY', title: 'Slow-Moving Stock Tying Up Capital', message: `${inv.slowMovingStockValueFormatted} in stock has had no sales in 60+ days.`, action: 'Review reorder strategy and consider supplier returns or promotions', impactPesewas: inv.slowMovingStockValuePesewas, impactFormatted: inv.slowMovingStockValueFormatted });
    }
    if (vat.filingStatus === 'OVERDUE') {
      alerts.push({ severity: 'CRITICAL', category: 'TAX', title: 'VAT Return Overdue — GRA Penalty Risk', message: vat.reminder, action: `File VAT return immediately. Net payable: ${vat.netVatPayableFormatted}`, impactPesewas: vat.netVatPayablePesewas, impactFormatted: vat.netVatPayableFormatted });
    }
    if (payroll.efficiencyRating === 'OVERSTAFFED') {
      alerts.push({ severity: 'WARNING', category: 'STAFF', title: 'Payroll Ratio Above Benchmark', message: payroll.recommendation, action: 'Review staffing schedule and consider revenue-generating activities' });
    }
    if (inv.inventoryTurnoverRatio < 6 && inv.inventoryTurnoverRatio > 0) {
      alerts.push({ severity: 'INFO', category: 'INVENTORY', title: 'Inventory Turnover Below Benchmark', message: `Turnover of ${inv.inventoryTurnoverRatio}x is below the 8x pharmacy benchmark.`, action: 'Reduce reorder quantities for slow-moving products' });
    }

    // Sort: CRITICAL first, then WARNING, then INFO
    const order: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2, OPPORTUNITY: 3 };
    return alerts.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  }

  // ── Key ratios ────────────────────────────────────────────────────────────

  private buildKeyRatios(
    wc: WorkingCapitalReport,
    inv: InventoryFinancialMetrics,
    payroll: PayrollAnalytics,
    pl: { grossMarginPct: number; netMarginPct: number },
  ): FinancialRatio[] {
    return [
      { name: 'Current Ratio', value: wc.currentRatio.toFixed(2), benchmark: '≥ 1.5', status: wc.currentRatio >= 1.5 ? 'ABOVE_BENCHMARK' : wc.currentRatio >= 1.0 ? 'AT_BENCHMARK' : 'BELOW_BENCHMARK', interpretation: 'Ability to cover short-term obligations with current assets' },
      { name: 'Quick Ratio', value: wc.quickRatio.toFixed(2), benchmark: '≥ 1.0', status: wc.quickRatio >= 1.0 ? 'ABOVE_BENCHMARK' : 'BELOW_BENCHMARK', interpretation: 'Liquid assets vs short-term liabilities (excludes inventory)' },
      { name: 'Gross Margin', value: `${pl.grossMarginPct.toFixed(1)}%`, benchmark: '30–45%', status: pl.grossMarginPct >= 30 ? 'ABOVE_BENCHMARK' : pl.grossMarginPct >= 20 ? 'AT_BENCHMARK' : 'BELOW_BENCHMARK', interpretation: 'Revenue remaining after cost of goods sold' },
      { name: 'Net Margin', value: `${pl.netMarginPct.toFixed(1)}%`, benchmark: '10–20%', status: pl.netMarginPct >= 10 ? 'ABOVE_BENCHMARK' : pl.netMarginPct >= 5 ? 'AT_BENCHMARK' : 'BELOW_BENCHMARK', interpretation: 'Bottom-line profitability after all expenses' },
      { name: 'Inventory Turnover', value: `${inv.inventoryTurnoverRatio.toFixed(1)}x`, benchmark: '8–12x/year', status: inv.inventoryTurnoverRatio >= 8 ? 'ABOVE_BENCHMARK' : inv.inventoryTurnoverRatio >= 6 ? 'AT_BENCHMARK' : 'BELOW_BENCHMARK', interpretation: 'How efficiently inventory is sold and replenished' },
      { name: 'Days Inventory Outstanding', value: `${Math.round(inv.daysInventoryOutstanding)} days`, benchmark: '30–45 days', status: inv.daysInventoryOutstanding <= 45 ? 'ABOVE_BENCHMARK' : inv.daysInventoryOutstanding <= 60 ? 'AT_BENCHMARK' : 'BELOW_BENCHMARK', interpretation: 'Average days to sell through inventory' },
      { name: 'Payroll Ratio', value: `${payroll.payrollRatioPct.toFixed(1)}%`, benchmark: '15–25%', status: payroll.payrollRatioPct <= 25 ? 'ABOVE_BENCHMARK' : payroll.payrollRatioPct <= 30 ? 'AT_BENCHMARK' : 'BELOW_BENCHMARK', interpretation: 'Staff costs as a percentage of revenue' },
    ];
  }

  // ── Health score ──────────────────────────────────────────────────────────

  private scoreHealth(
    wc: WorkingCapitalReport,
    pl: { grossMarginPct: number; netMarginPct: number },
    inv: InventoryFinancialMetrics,
    payroll: PayrollAnalytics,
  ): { score: number; label: string } {
    let score = 100;
    if (wc.currentRatio < 1.0) score -= 30;
    else if (wc.currentRatio < 1.5) score -= 15;
    if (pl.netMarginPct < 0) score -= 25;
    else if (pl.netMarginPct < 5) score -= 15;
    else if (pl.netMarginPct < 10) score -= 5;
    if (inv.inventoryTurnoverRatio < 6 && inv.inventoryTurnoverRatio > 0) score -= 10;
    if (payroll.payrollRatioPct > 30) score -= 10;
    else if (payroll.payrollRatioPct > 25) score -= 5;
    if (inv.nearExpiryValuePesewas > 0) score -= 5;
    score = Math.max(0, Math.min(100, score));
    const label = score >= 80 ? 'EXCELLENT' : score >= 65 ? 'GOOD' : score >= 45 ? 'FAIR' : 'POOR';
    return { score, label };
  }

  // ── Executive summary ─────────────────────────────────────────────────────

  private buildExecutiveSummary(
    branchName: string,
    pl: { revenue: number; netProfit: number; netMarginPct: number; grossMarginPct: number },
    wc: WorkingCapitalReport,
    rev: RevenueIntelligence,
    alerts: FinancialAlert[],
    inv: InvestmentIntelligenceReport,
  ): string {
    const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL').length;
    const profitStatus = pl.netProfit > 0 ? `profitable at ${pl.netMarginPct.toFixed(1)}% net margin` : `operating at a loss of ${this.fmt(Math.abs(pl.netProfit))}`;

    let summary = `${branchName} is ${profitStatus} this period with ${this.fmt(pl.revenue)} in revenue. `;
    summary += `Revenue trend is ${rev.trendSignal.toLowerCase()} (${rev.momGrowthPct > 0 ? '+' : ''}${rev.momGrowthPct.toFixed(1)}% MoM). `;
    summary += `Working capital is ${wc.healthStatus.toLowerCase()} with a current ratio of ${wc.currentRatio.toFixed(2)}. `;

    if (criticalCount > 0) {
      summary += `⚠️ ${criticalCount} critical issue${criticalCount > 1 ? 's' : ''} require immediate attention. `;
    }

    if (inv.qualifiesForInvestment && inv.recommendations.length > 0) {
      summary += `The business qualifies for strategic investment — top opportunity: ${inv.recommendations[0].title} (est. ${inv.recommendations[0].estimatedRoi12MonthPct}% ROI).`;
    } else if (!inv.qualifiesForInvestment) {
      summary += `Focus on improving profitability before deploying capital: ${inv.qualificationReason}`;
    }

    return summary;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async getCurrentCash(branchId: string): Promise<number> {
    const [row] = await this.dataSource.query(`
      SELECT COALESCE(SUM(debit - credit), 0)::int AS cash
      FROM general_ledger WHERE branch_id = $1 AND account_code = '1000'
    `, [branchId]) as Array<{ cash: number }>;
    return row?.cash ?? 0;
  }

  private async getTotalPayables(branchId: string): Promise<number> {
    const [row] = await this.dataSource.query(`
      SELECT COALESCE(SUM(total_amount - paid_amount), 0)::int AS payables
      FROM supplier_invoices WHERE branch_id = $1 AND status IN ('PENDING','MATCHED','PARTIAL')
    `, [branchId]) as Array<{ payables: number }>;
    return row?.payables ?? 0;
  }

  private async getBranchName(branchId: string): Promise<string> {
    const [row] = await this.dataSource.query(
      `SELECT name FROM branches WHERE id = $1`,
      [branchId],
    ) as Array<{ name: string }>;
    return row?.name ?? 'Branch';
  }

  private async getMonthPL(branchId: string, periodStart: string, periodEnd: string): Promise<{
    revenue: number; cogs: number; opex: number;
    grossProfit: number; netProfit: number;
    grossMarginPct: number; netMarginPct: number;
  }> {
    const [rev] = await this.dataSource.query(`
      SELECT COALESCE(SUM(s.total_amount), 0)::int AS revenue
      FROM sales s WHERE s.branch_id = $1 AND s.status = 'COMPLETED'
        AND (${this.effectiveSaleAt.sql('s')}) >= $2::timestamptz
        AND (${this.effectiveSaleAt.sql('s')}) < ($3::date + INTERVAL '1 day')::timestamptz
    `, [branchId, periodStart, periodEnd]) as Array<{ revenue: number }>;

    const [cogs] = await this.dataSource.query(`
      SELECT COALESCE(SUM(total_amount), 0)::int AS cogs
      FROM supplier_invoices WHERE branch_id = $1 AND status IN ('MATCHED','PAID')
        AND invoice_date >= $2::date AND invoice_date <= $3::date
    `, [branchId, periodStart, periodEnd]) as Array<{ cogs: number }>;

    const [opex] = await this.dataSource.query(`
      SELECT COALESCE(SUM(amount_pesewas), 0)::int AS opex
      FROM expenses WHERE branch_id = $1 AND status = 'APPROVED'
        AND expense_date >= $2::date AND expense_date <= $3::date
    `, [branchId, periodStart, periodEnd]) as Array<{ opex: number }>;

    const revenue = rev?.revenue ?? 0;
    const cogsVal = cogs?.cogs ?? 0;
    const opexVal = opex?.opex ?? 0;
    const grossProfit = revenue - cogsVal;
    const netProfit = grossProfit - opexVal;

    return {
      revenue,
      cogs: cogsVal,
      opex: opexVal,
      grossProfit,
      netProfit,
      grossMarginPct: revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0,
      netMarginPct: revenue > 0 ? Math.round((netProfit / revenue) * 1000) / 10 : 0,
    };
  }

  /** Simple linear regression — projects next value in a series */
  private linearRegressionNextValue(values: number[]): number {
    const n = values.length;
    if (n < 2) return values[0] ?? 0;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((s, v) => s + v, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (values[i] - yMean);
      den += (i - xMean) ** 2;
    }
    const slope = den !== 0 ? num / den : 0;
    const intercept = yMean - slope * xMean;
    return Math.round(intercept + slope * n);
  }

  private buildRevenueInsight(
    signal: string, mom: number, yoy: number, cmgr: number, projected: number,
  ): string {
    if (signal === 'ACCELERATING') return `Revenue is accelerating at ${cmgr.toFixed(1)}% CMGR. MoM growth of ${mom.toFixed(1)}% and YoY of ${yoy.toFixed(1)}%. Projected next month: ${this.fmt(projected)}. Ensure inventory and staffing can support continued growth.`;
    if (signal === 'DECLINING') return `Revenue is declining (${cmgr.toFixed(1)}% CMGR, ${mom.toFixed(1)}% MoM). Investigate root causes: competitor activity, stock-outs, or seasonal factors. Immediate marketing intervention recommended.`;
    if (signal === 'DECELERATING') return `Growth is slowing (${cmgr.toFixed(1)}% CMGR). MoM: ${mom.toFixed(1)}%. Consider promotional campaigns or new product lines to reignite momentum.`;
    return `Revenue is stable at ${cmgr.toFixed(1)}% CMGR. MoM: ${mom.toFixed(1)}%, YoY: ${yoy.toFixed(1)}%. Projected next month: ${this.fmt(projected)}.`;
  }

  private fmt(pesewas: number): string {
    return `GH₵${(pesewas / 100).toFixed(2)}`;
  }

  private fmtGhs(ghs: number): string {
    return `GH₵${ghs.toFixed(2)}`;
  }
}
