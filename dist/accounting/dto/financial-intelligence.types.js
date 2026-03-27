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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CfoBriefing = exports.FinancialRatio = exports.FinancialAlert = exports.InvestmentIntelligenceReport = exports.InvestmentRecommendation = exports.VatComplianceReport = exports.PayrollAnalytics = exports.RevenueIntelligence = exports.RevenueTrendPoint = exports.ProductProfitability = exports.SupplierScorecard = exports.InventoryFinancialMetrics = exports.WorkingCapitalReport = exports.ForecastInput = exports.FinancialPeriodInput = void 0;
const graphql_1 = require("@nestjs/graphql");
const class_validator_1 = require("class-validator");
let FinancialPeriodInput = class FinancialPeriodInput {
};
exports.FinancialPeriodInput = FinancialPeriodInput;
__decorate([
    (0, graphql_1.Field)({ description: 'ISO 8601 date. Example: "2026-01-01"' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], FinancialPeriodInput.prototype, "periodStart", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'ISO 8601 date. Example: "2026-03-31"' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], FinancialPeriodInput.prototype, "periodEnd", void 0);
exports.FinancialPeriodInput = FinancialPeriodInput = __decorate([
    (0, graphql_1.InputType)()
], FinancialPeriodInput);
let ForecastInput = class ForecastInput {
};
exports.ForecastInput = ForecastInput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Number of days to forecast ahead (7–365)', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(7),
    __metadata("design:type", Number)
], ForecastInput.prototype, "horizonDays", void 0);
exports.ForecastInput = ForecastInput = __decorate([
    (0, graphql_1.InputType)()
], ForecastInput);
let WorkingCapitalReport = class WorkingCapitalReport {
};
exports.WorkingCapitalReport = WorkingCapitalReport;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], WorkingCapitalReport.prototype, "currentAssetsPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], WorkingCapitalReport.prototype, "currentAssetsFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], WorkingCapitalReport.prototype, "currentLiabilitiesPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], WorkingCapitalReport.prototype, "currentLiabilitiesFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Working capital = current assets - current liabilities' }),
    __metadata("design:type", Number)
], WorkingCapitalReport.prototype, "workingCapitalPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], WorkingCapitalReport.prototype, "workingCapitalFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Current ratio = assets / liabilities. Healthy: ≥ 1.5' }),
    __metadata("design:type", Number)
], WorkingCapitalReport.prototype, "currentRatio", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Quick ratio = (cash + receivables) / liabilities. Healthy: ≥ 1.0' }),
    __metadata("design:type", Number)
], WorkingCapitalReport.prototype, "quickRatio", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], WorkingCapitalReport.prototype, "cashAndEquivalentsPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], WorkingCapitalReport.prototype, "cashAndEquivalentsFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], WorkingCapitalReport.prototype, "inventoryValuePesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], WorkingCapitalReport.prototype, "inventoryValueFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], WorkingCapitalReport.prototype, "accountsReceivablePesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], WorkingCapitalReport.prototype, "accountsReceivableFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], WorkingCapitalReport.prototype, "accountsPayablePesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], WorkingCapitalReport.prototype, "accountsPayableFormatted", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'HEALTHY | WATCH | CRITICAL' }),
    __metadata("design:type", String)
], WorkingCapitalReport.prototype, "healthStatus", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'CFO-level narrative explaining the working capital position' }),
    __metadata("design:type", String)
], WorkingCapitalReport.prototype, "narrative", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Estimated cash runway in days based on approved 30-day expenses.' }),
    __metadata("design:type", Number)
], WorkingCapitalReport.prototype, "cashRunwayDays", void 0);
exports.WorkingCapitalReport = WorkingCapitalReport = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Working capital health — the lifeblood of a pharmacy' })
], WorkingCapitalReport);
let InventoryFinancialMetrics = class InventoryFinancialMetrics {
};
exports.InventoryFinancialMetrics = InventoryFinancialMetrics;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, {
        description: 'Inventory turnover ratio = COGS / avg inventory value. ' +
            'Pharmacy benchmark: 8–12x/year. Below 6 = slow-moving stock.',
    }),
    __metadata("design:type", Number)
], InventoryFinancialMetrics.prototype, "inventoryTurnoverRatio", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Days inventory outstanding (DIO) = 365 / turnover. Target: 30–45 days' }),
    __metadata("design:type", Number)
], InventoryFinancialMetrics.prototype, "daysInventoryOutstanding", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Total inventory value at cost price (pesewas)' }),
    __metadata("design:type", Number)
], InventoryFinancialMetrics.prototype, "inventoryValueAtCostPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], InventoryFinancialMetrics.prototype, "inventoryValueAtCostFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Total inventory value at selling price (pesewas)' }),
    __metadata("design:type", Number)
], InventoryFinancialMetrics.prototype, "inventoryValueAtSellingPricePesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], InventoryFinancialMetrics.prototype, "inventoryValueAtSellingPriceFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Potential gross margin locked in inventory (%)' }),
    __metadata("design:type", Number)
], InventoryFinancialMetrics.prototype, "potentialMarginPct", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Value of slow-moving stock (no sales in 60+ days)' }),
    __metadata("design:type", Number)
], InventoryFinancialMetrics.prototype, "slowMovingStockValuePesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], InventoryFinancialMetrics.prototype, "slowMovingStockValueFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Value of near-expiry stock (expiring within 90 days)' }),
    __metadata("design:type", Number)
], InventoryFinancialMetrics.prototype, "nearExpiryValuePesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], InventoryFinancialMetrics.prototype, "nearExpiryValueFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Shrinkage rate % (write-offs / total received)' }),
    __metadata("design:type", Number)
], InventoryFinancialMetrics.prototype, "shrinkageRatePct", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Recommendation from the financial intelligence engine' }),
    __metadata("design:type", String)
], InventoryFinancialMetrics.prototype, "recommendation", void 0);
exports.InventoryFinancialMetrics = InventoryFinancialMetrics = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Inventory financial efficiency metrics' })
], InventoryFinancialMetrics);
let SupplierScorecard = class SupplierScorecard {
};
exports.SupplierScorecard = SupplierScorecard;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], SupplierScorecard.prototype, "supplierId", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], SupplierScorecard.prototype, "supplierName", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Total purchased from this supplier (pesewas, last 12 months)' }),
    __metadata("design:type", Number)
], SupplierScorecard.prototype, "totalPurchasedPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], SupplierScorecard.prototype, "totalPurchasedFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Share of total COGS this supplier represents (%)' }),
    __metadata("design:type", Number)
], SupplierScorecard.prototype, "cogsSharePct", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Average gross margin on products from this supplier (%)' }),
    __metadata("design:type", Number)
], SupplierScorecard.prototype, "avgGrossMarginPct", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Average days to pay this supplier (DPO)' }),
    __metadata("design:type", Number)
], SupplierScorecard.prototype, "avgDaysToPayDpo", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Outstanding balance owed (pesewas)' }),
    __metadata("design:type", Number)
], SupplierScorecard.prototype, "outstandingPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], SupplierScorecard.prototype, "outstandingFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Overdue amount (pesewas)' }),
    __metadata("design:type", Number)
], SupplierScorecard.prototype, "overduePesewas", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'On-time delivery rate (%)' }),
    __metadata("design:type", Number)
], SupplierScorecard.prototype, "onTimeDeliveryRatePct", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'A | B | C — ABC analysis tier based on revenue contribution' }),
    __metadata("design:type", String)
], SupplierScorecard.prototype, "abcTier", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'STRATEGIC | PREFERRED | STANDARD | REVIEW — relationship recommendation' }),
    __metadata("design:type", String)
], SupplierScorecard.prototype, "relationshipRecommendation", void 0);
exports.SupplierScorecard = SupplierScorecard = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Financial scorecard for a single supplier' })
], SupplierScorecard);
let ProductProfitability = class ProductProfitability {
};
exports.ProductProfitability = ProductProfitability;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], ProductProfitability.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], ProductProfitability.prototype, "productName", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], ProductProfitability.prototype, "classification", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], ProductProfitability.prototype, "supplierName", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], ProductProfitability.prototype, "unitsSold", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], ProductProfitability.prototype, "revenuePesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], ProductProfitability.prototype, "revenueFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], ProductProfitability.prototype, "cogsPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], ProductProfitability.prototype, "grossProfitPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], ProductProfitability.prototype, "grossProfitFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Gross margin % for this product' }),
    __metadata("design:type", Number)
], ProductProfitability.prototype, "grossMarginPct", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Revenue contribution % of total branch revenue' }),
    __metadata("design:type", Number)
], ProductProfitability.prototype, "revenueContributionPct", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'A | B | C — ABC analysis tier' }),
    __metadata("design:type", String)
], ProductProfitability.prototype, "abcTier", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'STAR | CASH_COW | QUESTION_MARK | DOG — BCG matrix classification' }),
    __metadata("design:type", String)
], ProductProfitability.prototype, "bcgClassification", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Action recommendation: PROMOTE | MAINTAIN | REVIEW_PRICE | DISCONTINUE' }),
    __metadata("design:type", String)
], ProductProfitability.prototype, "action", void 0);
exports.ProductProfitability = ProductProfitability = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Profitability analysis for a single product' })
], ProductProfitability);
let RevenueTrendPoint = class RevenueTrendPoint {
};
exports.RevenueTrendPoint = RevenueTrendPoint;
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], RevenueTrendPoint.prototype, "period", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], RevenueTrendPoint.prototype, "revenuePesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], RevenueTrendPoint.prototype, "revenueFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], RevenueTrendPoint.prototype, "transactionCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float),
    __metadata("design:type", Number)
], RevenueTrendPoint.prototype, "avgTransactionGhs", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { nullable: true }),
    __metadata("design:type", Number)
], RevenueTrendPoint.prototype, "growthPct", void 0);
exports.RevenueTrendPoint = RevenueTrendPoint = __decorate([
    (0, graphql_1.ObjectType)({ description: 'A single data point in a revenue trend series' })
], RevenueTrendPoint);
let RevenueIntelligence = class RevenueIntelligence {
};
exports.RevenueIntelligence = RevenueIntelligence;
__decorate([
    (0, graphql_1.Field)(() => [RevenueTrendPoint], { description: 'Monthly revenue trend (last 12 months)' }),
    __metadata("design:type", Array)
], RevenueIntelligence.prototype, "monthlyTrend", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Month-over-month growth rate (%)' }),
    __metadata("design:type", Number)
], RevenueIntelligence.prototype, "momGrowthPct", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Year-over-year growth rate (%)' }),
    __metadata("design:type", Number)
], RevenueIntelligence.prototype, "yoyGrowthPct", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Compound monthly growth rate (CMGR) over 6 months (%)' }),
    __metadata("design:type", Number)
], RevenueIntelligence.prototype, "cmgr6MonthPct", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Projected revenue next month (pesewas) — linear regression' }),
    __metadata("design:type", Number)
], RevenueIntelligence.prototype, "projectedNextMonthPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], RevenueIntelligence.prototype, "projectedNextMonthFormatted", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Best performing day of week (e.g. "Monday")' }),
    __metadata("design:type", String)
], RevenueIntelligence.prototype, "bestDayOfWeek", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Best performing hour of day (e.g. "10:00–11:00")' }),
    __metadata("design:type", String)
], RevenueIntelligence.prototype, "peakHour", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Revenue per prescription dispensed (GHS)' }),
    __metadata("design:type", Number)
], RevenueIntelligence.prototype, "revenuePerRxGhs", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Trend signal: ACCELERATING | STABLE | DECELERATING | DECLINING' }),
    __metadata("design:type", String)
], RevenueIntelligence.prototype, "trendSignal", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Narrative insight from the intelligence engine' }),
    __metadata("design:type", String)
], RevenueIntelligence.prototype, "insight", void 0);
exports.RevenueIntelligence = RevenueIntelligence = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Revenue intelligence — trends, seasonality, anomalies' })
], RevenueIntelligence);
let PayrollAnalytics = class PayrollAnalytics {
};
exports.PayrollAnalytics = PayrollAnalytics;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], PayrollAnalytics.prototype, "totalPayrollPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], PayrollAnalytics.prototype, "totalPayrollFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, {
        description: 'Payroll ratio = payroll / revenue. ' +
            'Pharmacy benchmark: 15–25%. Above 30% = overstaffed or underperforming.',
    }),
    __metadata("design:type", Number)
], PayrollAnalytics.prototype, "payrollRatioPct", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Revenue per staff member (GHS)' }),
    __metadata("design:type", Number)
], PayrollAnalytics.prototype, "revenuePerStaffGhs", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Gross profit per staff member (GHS)' }),
    __metadata("design:type", Number)
], PayrollAnalytics.prototype, "grossProfitPerStaffGhs", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], PayrollAnalytics.prototype, "activeStaffCount", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'EFFICIENT | WATCH | OVERSTAFFED' }),
    __metadata("design:type", String)
], PayrollAnalytics.prototype, "efficiencyRating", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Recommendation from the intelligence engine' }),
    __metadata("design:type", String)
], PayrollAnalytics.prototype, "recommendation", void 0);
exports.PayrollAnalytics = PayrollAnalytics = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Payroll efficiency metrics — staff cost vs revenue' })
], PayrollAnalytics);
let VatComplianceReport = class VatComplianceReport {
};
exports.VatComplianceReport = VatComplianceReport;
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], VatComplianceReport.prototype, "period", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], VatComplianceReport.prototype, "returnDueDate", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Total taxable sales (non-exempt) in pesewas' }),
    __metadata("design:type", Number)
], VatComplianceReport.prototype, "taxableSalesPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], VatComplianceReport.prototype, "taxableSalesFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'VAT-exempt sales (Rx medicines) in pesewas' }),
    __metadata("design:type", Number)
], VatComplianceReport.prototype, "exemptSalesPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], VatComplianceReport.prototype, "exemptSalesFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'VAT collected (12.5%) in pesewas' }),
    __metadata("design:type", Number)
], VatComplianceReport.prototype, "vatCollectedPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], VatComplianceReport.prototype, "vatCollectedFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'NHIL collected (2.5%) in pesewas' }),
    __metadata("design:type", Number)
], VatComplianceReport.prototype, "nhilCollectedPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], VatComplianceReport.prototype, "nhilCollectedFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Total tax liability (VAT + NHIL) in pesewas' }),
    __metadata("design:type", Number)
], VatComplianceReport.prototype, "totalTaxLiabilityPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], VatComplianceReport.prototype, "totalTaxLiabilityFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Input VAT on supplier invoices (claimable)' }),
    __metadata("design:type", Number)
], VatComplianceReport.prototype, "inputVatPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], VatComplianceReport.prototype, "inputVatFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Net VAT payable to GRA = output - input' }),
    __metadata("design:type", Number)
], VatComplianceReport.prototype, "netVatPayablePesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], VatComplianceReport.prototype, "netVatPayableFormatted", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'FILED | PENDING | OVERDUE' }),
    __metadata("design:type", String)
], VatComplianceReport.prototype, "filingStatus", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Reminder message for the owner' }),
    __metadata("design:type", String)
], VatComplianceReport.prototype, "reminder", void 0);
exports.VatComplianceReport = VatComplianceReport = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Ghana GRA VAT compliance report — monthly return data' })
], VatComplianceReport);
let InvestmentRecommendation = class InvestmentRecommendation {
};
exports.InvestmentRecommendation = InvestmentRecommendation;
__decorate([
    (0, graphql_1.Field)({ description: 'EXPAND_INVENTORY | OPEN_BRANCH | HIRE_STAFF | EQUIPMENT | MARKETING | TREASURY | HOLD_CASH' }),
    __metadata("design:type", String)
], InvestmentRecommendation.prototype, "type", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Short title of the recommendation' }),
    __metadata("design:type", String)
], InvestmentRecommendation.prototype, "title", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Detailed rationale based on actual financial data' }),
    __metadata("design:type", String)
], InvestmentRecommendation.prototype, "rationale", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Estimated investment required (pesewas)' }),
    __metadata("design:type", Number)
], InvestmentRecommendation.prototype, "estimatedInvestmentPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], InvestmentRecommendation.prototype, "estimatedInvestmentFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Estimated ROI % within 12 months' }),
    __metadata("design:type", Number)
], InvestmentRecommendation.prototype, "estimatedRoi12MonthPct", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Estimated payback period in months' }),
    __metadata("design:type", Number)
], InvestmentRecommendation.prototype, "paybackMonths", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'HIGH | MEDIUM | LOW — confidence in this recommendation' }),
    __metadata("design:type", String)
], InvestmentRecommendation.prototype, "confidence", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'HIGH | MEDIUM | LOW — risk level' }),
    __metadata("design:type", String)
], InvestmentRecommendation.prototype, "riskLevel", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'IMMEDIATE | WITHIN_3_MONTHS | WITHIN_6_MONTHS | MONITOR' }),
    __metadata("design:type", String)
], InvestmentRecommendation.prototype, "urgency", void 0);
exports.InvestmentRecommendation = InvestmentRecommendation = __decorate([
    (0, graphql_1.ObjectType)({ description: 'A single investment recommendation' })
], InvestmentRecommendation);
let InvestmentIntelligenceReport = class InvestmentIntelligenceReport {
};
exports.InvestmentIntelligenceReport = InvestmentIntelligenceReport;
__decorate([
    (0, graphql_1.Field)({ description: 'Whether the business qualifies for investment recommendations (profitable + healthy cash)' }),
    __metadata("design:type", Boolean)
], InvestmentIntelligenceReport.prototype, "qualifiesForInvestment", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Reason why or why not the business qualifies' }),
    __metadata("design:type", String)
], InvestmentIntelligenceReport.prototype, "qualificationReason", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Net profit margin % (must be > 10% to qualify)' }),
    __metadata("design:type", Number)
], InvestmentIntelligenceReport.prototype, "netProfitMarginPct", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Cash runway in days' }),
    __metadata("design:type", Number)
], InvestmentIntelligenceReport.prototype, "cashRunwayDays", void 0);
__decorate([
    (0, graphql_1.Field)(() => [InvestmentRecommendation], { description: 'Ranked investment recommendations (best ROI first)' }),
    __metadata("design:type", Array)
], InvestmentIntelligenceReport.prototype, "recommendations", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Executive summary from the CFO intelligence engine' }),
    __metadata("design:type", String)
], InvestmentIntelligenceReport.prototype, "executiveSummary", void 0);
exports.InvestmentIntelligenceReport = InvestmentIntelligenceReport = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Full investment intelligence report — only generated when business is profitable' })
], InvestmentIntelligenceReport);
let FinancialAlert = class FinancialAlert {
};
exports.FinancialAlert = FinancialAlert;
__decorate([
    (0, graphql_1.Field)({ description: 'CRITICAL | WARNING | INFO | OPPORTUNITY' }),
    __metadata("design:type", String)
], FinancialAlert.prototype, "severity", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Alert category: CASH | PAYABLES | INVENTORY | TAX | STAFF | GROWTH' }),
    __metadata("design:type", String)
], FinancialAlert.prototype, "category", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], FinancialAlert.prototype, "title", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], FinancialAlert.prototype, "message", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Suggested action to resolve the alert' }),
    __metadata("design:type", String)
], FinancialAlert.prototype, "action", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { nullable: true, description: 'Financial impact in pesewas (if quantifiable)' }),
    __metadata("design:type", Number)
], FinancialAlert.prototype, "impactPesewas", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], FinancialAlert.prototype, "impactFormatted", void 0);
exports.FinancialAlert = FinancialAlert = __decorate([
    (0, graphql_1.ObjectType)({ description: 'A single alert or action item for the owner' })
], FinancialAlert);
let FinancialRatio = class FinancialRatio {
};
exports.FinancialRatio = FinancialRatio;
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], FinancialRatio.prototype, "name", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], FinancialRatio.prototype, "value", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], FinancialRatio.prototype, "benchmark", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'ABOVE_BENCHMARK | AT_BENCHMARK | BELOW_BENCHMARK' }),
    __metadata("design:type", String)
], FinancialRatio.prototype, "status", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], FinancialRatio.prototype, "interpretation", void 0);
exports.FinancialRatio = FinancialRatio = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Key financial ratio benchmarked against pharmacy industry standards' })
], FinancialRatio);
let CfoBriefing = class CfoBriefing {
};
exports.CfoBriefing = CfoBriefing;
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Date)
], CfoBriefing.prototype, "generatedAt", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], CfoBriefing.prototype, "branchName", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], CfoBriefing.prototype, "periodCovered", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], CfoBriefing.prototype, "monthRevenuePesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], CfoBriefing.prototype, "monthRevenueFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], CfoBriefing.prototype, "monthNetProfitPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], CfoBriefing.prototype, "monthNetProfitFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float),
    __metadata("design:type", Number)
], CfoBriefing.prototype, "monthNetMarginPct", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], CfoBriefing.prototype, "cashOnHandPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], CfoBriefing.prototype, "cashOnHandFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], CfoBriefing.prototype, "totalPayablesPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], CfoBriefing.prototype, "totalPayablesFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => WorkingCapitalReport),
    __metadata("design:type", WorkingCapitalReport)
], CfoBriefing.prototype, "workingCapital", void 0);
__decorate([
    (0, graphql_1.Field)(() => InventoryFinancialMetrics),
    __metadata("design:type", InventoryFinancialMetrics)
], CfoBriefing.prototype, "inventoryMetrics", void 0);
__decorate([
    (0, graphql_1.Field)(() => RevenueIntelligence),
    __metadata("design:type", RevenueIntelligence)
], CfoBriefing.prototype, "revenueIntelligence", void 0);
__decorate([
    (0, graphql_1.Field)(() => PayrollAnalytics),
    __metadata("design:type", PayrollAnalytics)
], CfoBriefing.prototype, "payrollAnalytics", void 0);
__decorate([
    (0, graphql_1.Field)(() => VatComplianceReport),
    __metadata("design:type", VatComplianceReport)
], CfoBriefing.prototype, "vatCompliance", void 0);
__decorate([
    (0, graphql_1.Field)(() => InvestmentIntelligenceReport),
    __metadata("design:type", InvestmentIntelligenceReport)
], CfoBriefing.prototype, "investmentIntelligence", void 0);
__decorate([
    (0, graphql_1.Field)(() => [FinancialAlert], { description: 'Prioritised alerts requiring owner attention' }),
    __metadata("design:type", Array)
], CfoBriefing.prototype, "alerts", void 0);
__decorate([
    (0, graphql_1.Field)(() => [FinancialRatio], { description: 'Key ratios benchmarked against pharmacy industry' }),
    __metadata("design:type", Array)
], CfoBriefing.prototype, "keyRatios", void 0);
__decorate([
    (0, graphql_1.Field)(() => [SupplierScorecard], { description: 'Top 5 suppliers by spend with performance scores' }),
    __metadata("design:type", Array)
], CfoBriefing.prototype, "topSuppliers", void 0);
__decorate([
    (0, graphql_1.Field)(() => [ProductProfitability], { description: 'Top 10 products by gross profit contribution' }),
    __metadata("design:type", Array)
], CfoBriefing.prototype, "topProducts", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Plain-English executive summary written by the CFO intelligence engine' }),
    __metadata("design:type", String)
], CfoBriefing.prototype, "executiveSummary", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'EXCELLENT | GOOD | FAIR | POOR — overall financial health score' }),
    __metadata("design:type", String)
], CfoBriefing.prototype, "overallHealthScore", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Numeric health score 0–100' }),
    __metadata("design:type", Number)
], CfoBriefing.prototype, "healthScoreNumeric", void 0);
exports.CfoBriefing = CfoBriefing = __decorate([
    (0, graphql_1.ObjectType)({
        description: 'The complete CFO briefing — everything a hired accountant would present to the pharmacy owner. ' +
            'Covers working capital, inventory efficiency, supplier performance, revenue trends, ' +
            'payroll analytics, VAT compliance, and investment intelligence.',
    })
], CfoBriefing);
//# sourceMappingURL=financial-intelligence.types.js.map