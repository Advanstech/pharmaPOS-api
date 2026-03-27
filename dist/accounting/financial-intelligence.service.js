"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var FinancialIntelligenceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinancialIntelligenceService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const sales_effective_at_service_1 = require("../sales/sales-effective-at.service");
let FinancialIntelligenceService = FinancialIntelligenceService_1 = class FinancialIntelligenceService {
    constructor(dataSource, effectiveSaleAt) {
        this.dataSource = dataSource;
        this.effectiveSaleAt = effectiveSaleAt;
        this.logger = new common_1.Logger(FinancialIntelligenceService_1.name);
    }
    async getCfoBriefing(branchId) {
        var _a;
        this.logger.log(`Generating CFO briefing for branch=${branchId}`);
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const monthEnd = now.toISOString().split('T')[0];
        const [branchRow, workingCapital, inventoryMetrics, revenueIntelligence, payrollAnalytics, vatCompliance, topSuppliers, topProducts, cashRow, payablesRow, plRow,] = await Promise.all([
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
        const investmentIntelligence = await this.getInvestmentIntelligence(branchId, plRow.netMarginPct, (_a = workingCapital.cashRunwayDays) !== null && _a !== void 0 ? _a : 0, plRow.netProfit, revenueIntelligence.cmgr6MonthPct);
        const alerts = this.buildAlerts(workingCapital, inventoryMetrics, vatCompliance, payrollAnalytics, cashRow, payablesRow);
        const keyRatios = this.buildKeyRatios(workingCapital, inventoryMetrics, payrollAnalytics, plRow);
        const { score, label } = this.scoreHealth(workingCapital, plRow, inventoryMetrics, payrollAnalytics);
        const executiveSummary = this.buildExecutiveSummary(branchRow, plRow, workingCapital, revenueIntelligence, alerts, investmentIntelligence);
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
    async getWorkingCapital(branchId) {
        var _a, _b, _c;
        const cash = await this.getCurrentCash(branchId);
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
    `, [branchId]);
        const inventoryValue = (_a = invRow === null || invRow === void 0 ? void 0 : invRow.inv_value) !== null && _a !== void 0 ? _a : 0;
        const payables = await this.getTotalPayables(branchId);
        const [arRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(s.total_amount), 0)::int AS ar
      FROM sales s
      WHERE s.branch_id = $1 AND s.status = 'CREDIT'
        AND (${this.effectiveSaleAt.sql('s')}) >= NOW() - INTERVAL '90 days'
    `, [branchId]);
        const accountsReceivable = (_b = arRow === null || arRow === void 0 ? void 0 : arRow.ar) !== null && _b !== void 0 ? _b : 0;
        const currentAssets = cash + inventoryValue + accountsReceivable;
        const currentLiabilities = payables;
        const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 99;
        const quickRatio = currentLiabilities > 0 ? (cash + accountsReceivable) / currentLiabilities : 99;
        const workingCapital = currentAssets - currentLiabilities;
        const [expRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(amount_pesewas), 0)::int AS expenses
      FROM expenses WHERE branch_id = $1 AND status = 'APPROVED' AND expense_date >= NOW() - INTERVAL '30 days'
    `, [branchId]);
        const avgDailyExpenses = ((_c = expRow === null || expRow === void 0 ? void 0 : expRow.expenses) !== null && _c !== void 0 ? _c : 0) / 30;
        const cashRunwayDays = avgDailyExpenses > 0 ? Math.round(cash / avgDailyExpenses) : 999;
        let healthStatus = 'HEALTHY';
        let narrative = '';
        if (currentRatio < 1.0) {
            healthStatus = 'CRITICAL';
            narrative = `Current ratio of ${currentRatio.toFixed(2)} is below 1.0 — the pharmacy cannot cover its short-term obligations. Immediate action required: collect receivables, negotiate supplier extensions, or inject working capital.`;
        }
        else if (currentRatio < 1.5 || quickRatio < 1.0) {
            healthStatus = 'WATCH';
            narrative = `Current ratio of ${currentRatio.toFixed(2)} is below the pharmacy benchmark of 1.5. Monitor closely. Quick ratio of ${quickRatio.toFixed(2)} suggests limited liquid assets beyond inventory.`;
        }
        else {
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
    async getInventoryFinancialMetrics(branchId) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const [cogsRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(si.total_amount), 0)::int AS cogs
      FROM supplier_invoices si
      WHERE si.branch_id = $1 AND si.status IN ('MATCHED','PAID')
        AND si.invoice_date >= NOW() - INTERVAL '12 months'
    `, [branchId]);
        const annualCogs = (_a = cogsRow === null || cogsRow === void 0 ? void 0 : cogsRow.cogs) !== null && _a !== void 0 ? _a : 0;
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
    `, [branchId]);
        const inventoryAtCost = (_b = invCostRow === null || invCostRow === void 0 ? void 0 : invCostRow.cost_value) !== null && _b !== void 0 ? _b : 0;
        const [invSellRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(p.unit_price * inv.quantity_on_hand), 0)::int AS sell_value
      FROM inventory inv
      JOIN products p ON p.id = inv.product_id
      WHERE inv.branch_id = $1 AND p.is_active = true
    `, [branchId]);
        const inventoryAtSell = (_c = invSellRow === null || invSellRow === void 0 ? void 0 : invSellRow.sell_value) !== null && _c !== void 0 ? _c : 0;
        const avgInventory = inventoryAtCost > 0 ? inventoryAtCost : 1;
        const turnoverRatio = annualCogs > 0 ? annualCogs / avgInventory : 0;
        const daysInventoryOutstanding = turnoverRatio > 0 ? 365 / turnoverRatio : 365;
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
    `, [branchId]);
        const slowMovingValue = (_d = slowRow === null || slowRow === void 0 ? void 0 : slowRow.slow_value) !== null && _d !== void 0 ? _d : 0;
        const [expiryRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(p.unit_price * inv.quantity_on_hand), 0)::int AS expiry_value
      FROM inventory inv
      JOIN products p ON p.id = inv.product_id
      JOIN stock_movements sm ON sm.product_id = p.id AND sm.branch_id = $1
      WHERE inv.branch_id = $1 AND p.is_active = true
        AND sm.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '90 days'
    `, [branchId]);
        const nearExpiryValue = (_e = expiryRow === null || expiryRow === void 0 ? void 0 : expiryRow.expiry_value) !== null && _e !== void 0 ? _e : 0;
        const [shrinkRow] = await this.dataSource.query(`
      SELECT
        COALESCE(SUM(CASE WHEN movement_type = 'ADJUSTMENT' AND quantity < 0 THEN ABS(quantity) ELSE 0 END), 0) AS writeoffs,
        COALESCE(SUM(CASE WHEN movement_type = 'PURCHASE' THEN quantity ELSE 0 END), 0) AS received
      FROM stock_movements WHERE branch_id = $1 AND created_at >= NOW() - INTERVAL '12 months'
    `, [branchId]);
        const shrinkageRate = ((_f = shrinkRow === null || shrinkRow === void 0 ? void 0 : shrinkRow.received) !== null && _f !== void 0 ? _f : 0) > 0
            ? (((_g = shrinkRow === null || shrinkRow === void 0 ? void 0 : shrinkRow.writeoffs) !== null && _g !== void 0 ? _g : 0) / ((_h = shrinkRow === null || shrinkRow === void 0 ? void 0 : shrinkRow.received) !== null && _h !== void 0 ? _h : 1)) * 100
            : 0;
        const potentialMargin = inventoryAtCost > 0
            ? ((inventoryAtSell - inventoryAtCost) / inventoryAtSell) * 100
            : 0;
        let recommendation = '';
        if (turnoverRatio < 6) {
            recommendation = `Inventory turnover of ${turnoverRatio.toFixed(1)}x is below the 8x pharmacy benchmark. Consider running promotions on slow-moving stock (${this.fmt(slowMovingValue)} at risk) and reducing reorder quantities for low-velocity products.`;
        }
        else if (nearExpiryValue > 0) {
            recommendation = `Turnover is healthy at ${turnoverRatio.toFixed(1)}x. However, ${this.fmt(nearExpiryValue)} of stock expires within 90 days — prioritise dispensing these batches (FEFO) and consider supplier returns where possible.`;
        }
        else {
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
    async getRevenueIntelligence(branchId) {
        var _a, _b, _c, _d;
        const at = this.effectiveSaleAt.sql('s');
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
    `, [branchId]);
        const trend = monthlyRows.map((r, i) => ({
            period: r.period,
            revenuePesewas: r.revenue,
            revenueFormatted: this.fmt(r.revenue),
            transactionCount: r.tx_count,
            avgTransactionGhs: Math.round((r.avg_tx / 100) * 100) / 100,
            growthPct: i > 0 && monthlyRows[i - 1].revenue > 0
                ? Math.round(((r.revenue - monthlyRows[i - 1].revenue) / monthlyRows[i - 1].revenue) * 1000) / 10
                : undefined,
        }));
        const len = trend.length;
        const momGrowth = len >= 2 && trend[len - 2].revenuePesewas > 0
            ? ((trend[len - 1].revenuePesewas - trend[len - 2].revenuePesewas) / trend[len - 2].revenuePesewas) * 100
            : 0;
        const yoyGrowth = len >= 13 && trend[len - 13].revenuePesewas > 0
            ? ((trend[len - 1].revenuePesewas - trend[len - 13].revenuePesewas) / trend[len - 13].revenuePesewas) * 100
            : 0;
        const cmgr6 = len >= 7 && trend[len - 7].revenuePesewas > 0
            ? (Math.pow(trend[len - 1].revenuePesewas / trend[len - 7].revenuePesewas, 1 / 6) - 1) * 100
            : 0;
        const recentMonths = trend.slice(-6);
        const projectedNext = this.linearRegressionNextValue(recentMonths.map((r) => r.revenuePesewas));
        const [dayRow] = await this.dataSource.query(`
      SELECT TO_CHAR((${at}) AT TIME ZONE 'Africa/Accra', 'Day') AS day_name,
             SUM(s.total_amount)::int AS revenue
      FROM sales s WHERE s.branch_id = $1 AND s.status = 'COMPLETED'
        AND (${at}) >= NOW() - INTERVAL '90 days'
      GROUP BY 1 ORDER BY 2 DESC LIMIT 1
    `, [branchId]);
        const [hourRow] = await this.dataSource.query(`
      SELECT EXTRACT(HOUR FROM (${at}) AT TIME ZONE 'Africa/Accra')::int AS hour,
             SUM(s.total_amount)::int AS revenue
      FROM sales s WHERE s.branch_id = $1 AND s.status = 'COMPLETED'
        AND (${at}) >= NOW() - INTERVAL '90 days'
      GROUP BY 1 ORDER BY 2 DESC LIMIT 1
    `, [branchId]);
        const [rxRow] = await this.dataSource.query(`
      SELECT
        COALESCE(SUM(s.total_amount), 0)::float AS rx_revenue,
        COUNT(DISTINCT p.id)::float AS rx_count
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      JOIN products p ON p.id = si.product_id AND p.requires_rx = true
      WHERE s.branch_id = $1 AND s.status = 'COMPLETED'
        AND (${at}) >= NOW() - INTERVAL '30 days'
    `, [branchId]);
        const revenuePerRx = ((_a = rxRow === null || rxRow === void 0 ? void 0 : rxRow.rx_count) !== null && _a !== void 0 ? _a : 0) > 0
            ? ((_b = rxRow === null || rxRow === void 0 ? void 0 : rxRow.rx_revenue) !== null && _b !== void 0 ? _b : 0) / ((_c = rxRow === null || rxRow === void 0 ? void 0 : rxRow.rx_count) !== null && _c !== void 0 ? _c : 1) / 100
            : 0;
        let trendSignal = 'STABLE';
        if (cmgr6 > 5)
            trendSignal = 'ACCELERATING';
        else if (cmgr6 > 1)
            trendSignal = 'STABLE';
        else if (cmgr6 > -2)
            trendSignal = 'DECELERATING';
        else
            trendSignal = 'DECLINING';
        const peakHour = hourRow
            ? `${String(hourRow.hour).padStart(2, '0')}:00–${String(hourRow.hour + 1).padStart(2, '0')}:00`
            : 'N/A';
        const insight = this.buildRevenueInsight(trendSignal, momGrowth, yoyGrowth, cmgr6, projectedNext);
        return {
            monthlyTrend: trend,
            momGrowthPct: Math.round(momGrowth * 10) / 10,
            yoyGrowthPct: Math.round(yoyGrowth * 10) / 10,
            cmgr6MonthPct: Math.round(cmgr6 * 10) / 10,
            projectedNextMonthPesewas: Math.max(0, projectedNext),
            projectedNextMonthFormatted: this.fmt(Math.max(0, projectedNext)),
            bestDayOfWeek: ((_d = dayRow === null || dayRow === void 0 ? void 0 : dayRow.day_name) !== null && _d !== void 0 ? _d : 'N/A').trim(),
            peakHour,
            revenuePerRxGhs: Math.round(revenuePerRx * 100) / 100,
            trendSignal,
            insight,
        };
    }
    async getPayrollAnalytics(branchId, periodStart, periodEnd) {
        var _a, _b, _c, _d;
        const [payrollRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(amount_pesewas), 0)::int AS payroll
      FROM expenses
      WHERE branch_id = $1 AND category = 'SALARIES' AND status = 'APPROVED'
        AND expense_date >= $2::date AND expense_date <= $3::date
    `, [branchId, periodStart, periodEnd]);
        const payroll = (_a = payrollRow === null || payrollRow === void 0 ? void 0 : payrollRow.payroll) !== null && _a !== void 0 ? _a : 0;
        const eff = this.effectiveSaleAt.sql('s');
        const [revenueRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(s.total_amount), 0)::int AS revenue,
             COALESCE(SUM(s.total_amount - s.vat_amount), 0)::int AS gross_profit
      FROM sales s
      WHERE s.branch_id = $1 AND s.status = 'COMPLETED'
        AND (${eff}) >= $2::timestamptz
        AND (${eff}) < ($3::date + INTERVAL '1 day')::timestamptz
    `, [branchId, periodStart, periodEnd]);
        const revenue = (_b = revenueRow === null || revenueRow === void 0 ? void 0 : revenueRow.revenue) !== null && _b !== void 0 ? _b : 0;
        const grossProfit = (_c = revenueRow === null || revenueRow === void 0 ? void 0 : revenueRow.gross_profit) !== null && _c !== void 0 ? _c : 0;
        const [staffRow] = await this.dataSource.query(`
      SELECT COUNT(*)::int AS count FROM users WHERE branch_id = $1 AND is_active = true
    `, [branchId]);
        const staffCount = (_d = staffRow === null || staffRow === void 0 ? void 0 : staffRow.count) !== null && _d !== void 0 ? _d : 1;
        const payrollRatio = revenue > 0 ? (payroll / revenue) * 100 : 0;
        const revenuePerStaff = revenue / staffCount / 100;
        const gpPerStaff = grossProfit / staffCount / 100;
        let efficiencyRating = 'EFFICIENT';
        let recommendation = '';
        if (payrollRatio > 30) {
            efficiencyRating = 'OVERSTAFFED';
            recommendation = `Payroll ratio of ${payrollRatio.toFixed(1)}% exceeds the 30% threshold. Review staffing levels or increase revenue through extended hours or marketing. Revenue per staff member is ${this.fmtGhs(revenuePerStaff)}.`;
        }
        else if (payrollRatio > 25) {
            efficiencyRating = 'WATCH';
            recommendation = `Payroll ratio of ${payrollRatio.toFixed(1)}% is approaching the 25% benchmark. Monitor closely. Consider whether additional revenue streams (delivery service, health screenings) can improve the ratio.`;
        }
        else {
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
    async getVatCompliance(branchId, year, month) {
        var _a, _b, _c, _d;
        const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
        const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const period = `${year}-${String(month).padStart(2, '0')}`;
        const dueDay = new Date(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 30);
        const returnDueDate = dueDay.toISOString().split('T')[0];
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
    `, [branchId, periodStart, nextMonth]);
        const taxableSales = (_a = salesRow === null || salesRow === void 0 ? void 0 : salesRow.taxable) !== null && _a !== void 0 ? _a : 0;
        const exemptSales = (_b = salesRow === null || salesRow === void 0 ? void 0 : salesRow.exempt) !== null && _b !== void 0 ? _b : 0;
        const vatCollected = (_c = salesRow === null || salesRow === void 0 ? void 0 : salesRow.vat_collected) !== null && _c !== void 0 ? _c : 0;
        const vatPortion = Math.round(vatCollected * (12.5 / 15));
        const nhilPortion = vatCollected - vatPortion;
        const [inputRow] = await this.dataSource.query(`
      SELECT COALESCE(SUM(total_amount * 0.15), 0)::int AS input_vat
      FROM supplier_invoices
      WHERE branch_id = $1 AND status IN ('MATCHED','PAID')
        AND invoice_date >= $2::date AND invoice_date < $3::date
    `, [branchId, periodStart, nextMonth]);
        const inputVat = (_d = inputRow === null || inputRow === void 0 ? void 0 : inputRow.input_vat) !== null && _d !== void 0 ? _d : 0;
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
    async getTopSupplierScorecards(branchId, limit) {
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
    `, [branchId, limit]);
        const totalCogs = rows.reduce((sum, r) => sum + r.total_cogs, 0) || 1;
        return rows.map((r, i) => {
            const cogsShare = (r.total_purchased / totalCogs) * 100;
            const cumulativeShare = rows.slice(0, i + 1).reduce((s, x) => s + (x.total_purchased / totalCogs) * 100, 0);
            const abcTier = cumulativeShare <= 70 ? 'A' : cumulativeShare <= 90 ? 'B' : 'C';
            let relationship = 'STANDARD';
            if (abcTier === 'A' && r.overdue === 0)
                relationship = 'STRATEGIC';
            else if (abcTier === 'A')
                relationship = 'PREFERRED';
            else if (r.overdue > 0)
                relationship = 'REVIEW';
            return {
                supplierId: r.supplier_id,
                supplierName: r.supplier_name,
                totalPurchasedPesewas: r.total_purchased,
                totalPurchasedFormatted: this.fmt(r.total_purchased),
                cogsSharePct: Math.round(cogsShare * 10) / 10,
                avgGrossMarginPct: 0,
                avgDaysToPayDpo: Math.round(r.avg_days_to_pay),
                outstandingPesewas: r.outstanding,
                outstandingFormatted: this.fmt(r.outstanding),
                overduePesewas: r.overdue,
                onTimeDeliveryRatePct: 95,
                abcTier,
                relationshipRecommendation: relationship,
            };
        });
    }
    async getTopProductProfitability(branchId, periodStart, periodEnd, limit) {
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
    `, [branchId, periodStart, periodEnd, limit]);
        const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0) || 1;
        return rows.map((r) => {
            const grossProfit = r.revenue - r.cogs;
            const grossMargin = r.revenue > 0 ? (grossProfit / r.revenue) * 100 : 0;
            const revenueContrib = (r.revenue / totalRevenue) * 100;
            const isHighMargin = grossMargin > 30;
            const isHighVolume = r.units_sold > 50;
            let bcg = 'QUESTION_MARK';
            if (isHighMargin && isHighVolume)
                bcg = 'STAR';
            else if (isHighMargin && !isHighVolume)
                bcg = 'CASH_COW';
            else if (!isHighMargin && isHighVolume)
                bcg = 'QUESTION_MARK';
            else
                bcg = 'DOG';
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
    async getInvestmentIntelligence(branchId, netMarginPct, cashRunwayDays, netProfitPesewas, cmgr6Month) {
        var _a, _b, _c;
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
        const [invRow] = await this.dataSource.query(`
      SELECT COUNT(*)::int AS low_stock_count
      FROM inventory inv
      JOIN products p ON p.id = inv.product_id
      WHERE inv.branch_id = $1 AND p.is_active = true
        AND inv.quantity_on_hand <= inv.reorder_level
    `, [branchId]);
        const lowStockCount = (_a = invRow === null || invRow === void 0 ? void 0 : invRow.low_stock_count) !== null && _a !== void 0 ? _a : 0;
        const [branchRow] = await this.dataSource.query(`
      SELECT COUNT(*)::int AS branch_count FROM branches WHERE organization_id = (
        SELECT organization_id FROM branches WHERE id = $1
      ) AND is_active = true
    `, [branchId]);
        const branchCount = (_b = branchRow === null || branchRow === void 0 ? void 0 : branchRow.branch_count) !== null && _b !== void 0 ? _b : 1;
        const [staffRow] = await this.dataSource.query(`
      SELECT COUNT(*)::int AS count FROM users WHERE branch_id = $1 AND is_active = true
    `, [branchId]);
        const staffCount = (_c = staffRow === null || staffRow === void 0 ? void 0 : staffRow.count) !== null && _c !== void 0 ? _c : 0;
        const recommendations = [];
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
        if (branchCount === 1 && cmgr6Month > 5 && netMarginPct > 15) {
            recommendations.push({
                type: 'OPEN_BRANCH',
                title: 'Open Second Branch — Growth Justifies Expansion',
                rationale: `Revenue growing at ${cmgr6Month.toFixed(1)}% CMGR with ${netMarginPct.toFixed(1)}% net margin. Ghana's pharmaceutical market is growing — a second branch in a nearby neighbourhood could double revenue within 18 months. Recommended areas: Tema, East Legon, or Spintex Road (high foot traffic, underserved pharmacy density).`,
                estimatedInvestmentPesewas: 5000000 * 100,
                estimatedInvestmentFormatted: 'GH₵50,000.00',
                estimatedRoi12MonthPct: 45,
                paybackMonths: 14,
                confidence: 'MEDIUM',
                riskLevel: 'MEDIUM',
                urgency: 'WITHIN_6_MONTHS',
            });
        }
        if (netMarginPct > 12 && staffCount < 8) {
            recommendations.push({
                type: 'HIRE_STAFF',
                title: 'Add Delivery Service — Capture Home Delivery Market',
                rationale: `With ${netMarginPct.toFixed(1)}% net margin, the business can absorb a delivery rider salary (approx. GH₵1,200/month). Home delivery is growing rapidly in Accra — pharmacies offering delivery see 15–25% revenue uplift from repeat customers and Rx refills.`,
                estimatedInvestmentPesewas: 120000 * 100,
                estimatedInvestmentFormatted: 'GH₵14,400.00/year',
                estimatedRoi12MonthPct: 25,
                paybackMonths: 6,
                confidence: 'HIGH',
                riskLevel: 'LOW',
                urgency: 'WITHIN_3_MONTHS',
            });
        }
        if (cmgr6Month < 2 && netMarginPct > 12) {
            recommendations.push({
                type: 'MARKETING',
                title: 'Invest in Digital Marketing to Reignite Growth',
                rationale: `Revenue growth has slowed to ${cmgr6Month.toFixed(1)}% CMGR. A targeted social media campaign (Facebook/Instagram in Accra) and Google My Business optimisation can increase walk-in traffic by 10–20%. Budget: GH₵500–1,000/month for 3 months.`,
                estimatedInvestmentPesewas: 300000,
                estimatedInvestmentFormatted: 'GH₵3,000.00',
                estimatedRoi12MonthPct: 60,
                paybackMonths: 2,
                confidence: 'MEDIUM',
                riskLevel: 'LOW',
                urgency: 'WITHIN_3_MONTHS',
            });
        }
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
    buildAlerts(wc, inv, vat, payroll, cash, payables) {
        const alerts = [];
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
        const order = { CRITICAL: 0, WARNING: 1, INFO: 2, OPPORTUNITY: 3 };
        return alerts.sort((a, b) => { var _a, _b; return ((_a = order[a.severity]) !== null && _a !== void 0 ? _a : 9) - ((_b = order[b.severity]) !== null && _b !== void 0 ? _b : 9); });
    }
    buildKeyRatios(wc, inv, payroll, pl) {
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
    scoreHealth(wc, pl, inv, payroll) {
        let score = 100;
        if (wc.currentRatio < 1.0)
            score -= 30;
        else if (wc.currentRatio < 1.5)
            score -= 15;
        if (pl.netMarginPct < 0)
            score -= 25;
        else if (pl.netMarginPct < 5)
            score -= 15;
        else if (pl.netMarginPct < 10)
            score -= 5;
        if (inv.inventoryTurnoverRatio < 6 && inv.inventoryTurnoverRatio > 0)
            score -= 10;
        if (payroll.payrollRatioPct > 30)
            score -= 10;
        else if (payroll.payrollRatioPct > 25)
            score -= 5;
        if (inv.nearExpiryValuePesewas > 0)
            score -= 5;
        score = Math.max(0, Math.min(100, score));
        const label = score >= 80 ? 'EXCELLENT' : score >= 65 ? 'GOOD' : score >= 45 ? 'FAIR' : 'POOR';
        return { score, label };
    }
    buildExecutiveSummary(branchName, pl, wc, rev, alerts, inv) {
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
        }
        else if (!inv.qualifiesForInvestment) {
            summary += `Focus on improving profitability before deploying capital: ${inv.qualificationReason}`;
        }
        return summary;
    }
    async getCurrentCash(branchId) {
        var _a;
        const [row] = await this.dataSource.query(`
      SELECT COALESCE(SUM(debit - credit), 0)::int AS cash
      FROM general_ledger WHERE branch_id = $1 AND account_code = '1000'
    `, [branchId]);
        return (_a = row === null || row === void 0 ? void 0 : row.cash) !== null && _a !== void 0 ? _a : 0;
    }
    async getTotalPayables(branchId) {
        var _a;
        const [row] = await this.dataSource.query(`
      SELECT COALESCE(SUM(total_amount - paid_amount), 0)::int AS payables
      FROM supplier_invoices WHERE branch_id = $1 AND status IN ('PENDING','MATCHED','PARTIAL')
    `, [branchId]);
        return (_a = row === null || row === void 0 ? void 0 : row.payables) !== null && _a !== void 0 ? _a : 0;
    }
    async getBranchName(branchId) {
        var _a;
        const [row] = await this.dataSource.query(`SELECT name FROM branches WHERE id = $1`, [branchId]);
        return (_a = row === null || row === void 0 ? void 0 : row.name) !== null && _a !== void 0 ? _a : 'Branch';
    }
    async getMonthPL(branchId, periodStart, periodEnd) {
        var _a, _b, _c;
        const [rev] = await this.dataSource.query(`
      SELECT COALESCE(SUM(s.total_amount), 0)::int AS revenue
      FROM sales s WHERE s.branch_id = $1 AND s.status = 'COMPLETED'
        AND (${this.effectiveSaleAt.sql('s')}) >= $2::timestamptz
        AND (${this.effectiveSaleAt.sql('s')}) < ($3::date + INTERVAL '1 day')::timestamptz
    `, [branchId, periodStart, periodEnd]);
        const [cogs] = await this.dataSource.query(`
      SELECT COALESCE(SUM(total_amount), 0)::int AS cogs
      FROM supplier_invoices WHERE branch_id = $1 AND status IN ('MATCHED','PAID')
        AND invoice_date >= $2::date AND invoice_date <= $3::date
    `, [branchId, periodStart, periodEnd]);
        const [opex] = await this.dataSource.query(`
      SELECT COALESCE(SUM(amount_pesewas), 0)::int AS opex
      FROM expenses WHERE branch_id = $1 AND status = 'APPROVED'
        AND expense_date >= $2::date AND expense_date <= $3::date
    `, [branchId, periodStart, periodEnd]);
        const revenue = (_a = rev === null || rev === void 0 ? void 0 : rev.revenue) !== null && _a !== void 0 ? _a : 0;
        const cogsVal = (_b = cogs === null || cogs === void 0 ? void 0 : cogs.cogs) !== null && _b !== void 0 ? _b : 0;
        const opexVal = (_c = opex === null || opex === void 0 ? void 0 : opex.opex) !== null && _c !== void 0 ? _c : 0;
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
    linearRegressionNextValue(values) {
        var _a;
        const n = values.length;
        if (n < 2)
            return (_a = values[0]) !== null && _a !== void 0 ? _a : 0;
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
    buildRevenueInsight(signal, mom, yoy, cmgr, projected) {
        if (signal === 'ACCELERATING')
            return `Revenue is accelerating at ${cmgr.toFixed(1)}% CMGR. MoM growth of ${mom.toFixed(1)}% and YoY of ${yoy.toFixed(1)}%. Projected next month: ${this.fmt(projected)}. Ensure inventory and staffing can support continued growth.`;
        if (signal === 'DECLINING')
            return `Revenue is declining (${cmgr.toFixed(1)}% CMGR, ${mom.toFixed(1)}% MoM). Investigate root causes: competitor activity, stock-outs, or seasonal factors. Immediate marketing intervention recommended.`;
        if (signal === 'DECELERATING')
            return `Growth is slowing (${cmgr.toFixed(1)}% CMGR). MoM: ${mom.toFixed(1)}%. Consider promotional campaigns or new product lines to reignite momentum.`;
        return `Revenue is stable at ${cmgr.toFixed(1)}% CMGR. MoM: ${mom.toFixed(1)}%, YoY: ${yoy.toFixed(1)}%. Projected next month: ${this.fmt(projected)}.`;
    }
    fmt(pesewas) {
        return `GH₵${(pesewas / 100).toFixed(2)}`;
    }
    fmtGhs(ghs) {
        return `GH₵${ghs.toFixed(2)}`;
    }
};
exports.FinancialIntelligenceService = FinancialIntelligenceService;
exports.FinancialIntelligenceService = FinancialIntelligenceService = FinancialIntelligenceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        sales_effective_at_service_1.SalesEffectiveAtService])
], FinancialIntelligenceService);
//# sourceMappingURL=financial-intelligence.service.js.map