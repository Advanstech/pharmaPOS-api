import { ObjectType, Field, ID, Int, Float, InputType } from '@nestjs/graphql';
import { IsDateString, IsOptional, IsString, IsInt, Min } from 'class-validator';

// ─────────────────────────────────────────────────────────────────────────────
// INPUTS
// ─────────────────────────────────────────────────────────────────────────────

@InputType()
export class FinancialPeriodInput {
  @Field({ description: 'ISO 8601 date. Example: "2026-01-01"' })
  @IsDateString()
  periodStart!: string;

  @Field({ description: 'ISO 8601 date. Example: "2026-03-31"' })
  @IsDateString()
  periodEnd!: string;
}

@InputType()
export class ForecastInput {
  @Field(() => Int, { description: 'Number of days to forecast ahead (7–365)', nullable: true })
  @IsOptional()
  @IsInt()
  @Min(7)
  horizonDays?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKING CAPITAL
// ─────────────────────────────────────────────────────────────────────────────

@ObjectType({ description: 'Working capital health — the lifeblood of a pharmacy' })
export class WorkingCapitalReport {
  @Field(() => Int) currentAssetsPesewas!: number;
  @Field() currentAssetsFormatted!: string;

  @Field(() => Int) currentLiabilitiesPesewas!: number;
  @Field() currentLiabilitiesFormatted!: string;

  @Field(() => Int, { description: 'Working capital = current assets - current liabilities' })
  workingCapitalPesewas!: number;
  @Field() workingCapitalFormatted!: string;

  @Field(() => Float, { description: 'Current ratio = assets / liabilities. Healthy: ≥ 1.5' })
  currentRatio!: number;

  @Field(() => Float, { description: 'Quick ratio = (cash + receivables) / liabilities. Healthy: ≥ 1.0' })
  quickRatio!: number;

  @Field(() => Int) cashAndEquivalentsPesewas!: number;
  @Field() cashAndEquivalentsFormatted!: string;

  @Field(() => Int) inventoryValuePesewas!: number;
  @Field() inventoryValueFormatted!: string;

  @Field(() => Int) accountsReceivablePesewas!: number;
  @Field() accountsReceivableFormatted!: string;

  @Field(() => Int) accountsPayablePesewas!: number;
  @Field() accountsPayableFormatted!: string;

  @Field({ description: 'HEALTHY | WATCH | CRITICAL' })
  healthStatus!: string;

  @Field({ description: 'CFO-level narrative explaining the working capital position' })
  narrative!: string;

  @Field(() => Int, { description: 'Estimated cash runway in days based on approved 30-day expenses.' })
  cashRunwayDays!: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY FINANCIAL ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

@ObjectType({ description: 'Inventory financial efficiency metrics' })
export class InventoryFinancialMetrics {
  @Field(() => Float, {
    description:
      'Inventory turnover ratio = COGS / avg inventory value. ' +
      'Pharmacy benchmark: 8–12x/year. Below 6 = slow-moving stock.',
  })
  inventoryTurnoverRatio!: number;

  @Field(() => Float, { description: 'Days inventory outstanding (DIO) = 365 / turnover. Target: 30–45 days' })
  daysInventoryOutstanding!: number;

  @Field(() => Int, { description: 'Total inventory value at cost price (pesewas)' })
  inventoryValueAtCostPesewas!: number;
  @Field() inventoryValueAtCostFormatted!: string;

  @Field(() => Int, { description: 'Total inventory value at selling price (pesewas)' })
  inventoryValueAtSellingPricePesewas!: number;
  @Field() inventoryValueAtSellingPriceFormatted!: string;

  @Field(() => Float, { description: 'Potential gross margin locked in inventory (%)' })
  potentialMarginPct!: number;

  @Field(() => Int, { description: 'Value of slow-moving stock (no sales in 60+ days)' })
  slowMovingStockValuePesewas!: number;
  @Field() slowMovingStockValueFormatted!: string;

  @Field(() => Int, { description: 'Value of near-expiry stock (expiring within 90 days)' })
  nearExpiryValuePesewas!: number;
  @Field() nearExpiryValueFormatted!: string;

  @Field(() => Float, { description: 'Shrinkage rate % (write-offs / total received)' })
  shrinkageRatePct!: number;

  @Field({ description: 'Recommendation from the financial intelligence engine' })
  recommendation!: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPPLIER PERFORMANCE SCORECARD
// ─────────────────────────────────────────────────────────────────────────────

@ObjectType({ description: 'Financial scorecard for a single supplier' })
export class SupplierScorecard {
  @Field(() => ID) supplierId!: string;
  @Field() supplierName!: string;

  @Field(() => Int, { description: 'Total purchased from this supplier (pesewas, last 12 months)' })
  totalPurchasedPesewas!: number;
  @Field() totalPurchasedFormatted!: string;

  @Field(() => Float, { description: 'Share of total COGS this supplier represents (%)' })
  cogsSharePct!: number;

  @Field(() => Float, { description: 'Average gross margin on products from this supplier (%)' })
  avgGrossMarginPct!: number;

  @Field(() => Float, { description: 'Average days to pay this supplier (DPO)' })
  avgDaysToPayDpo!: number;

  @Field(() => Int, { description: 'Outstanding balance owed (pesewas)' })
  outstandingPesewas!: number;
  @Field() outstandingFormatted!: string;

  @Field(() => Int, { description: 'Overdue amount (pesewas)' })
  overduePesewas!: number;

  @Field(() => Float, { description: 'On-time delivery rate (%)' })
  onTimeDeliveryRatePct!: number;

  @Field({ description: 'A | B | C — ABC analysis tier based on revenue contribution' })
  abcTier!: string;

  @Field({ description: 'STRATEGIC | PREFERRED | STANDARD | REVIEW — relationship recommendation' })
  relationshipRecommendation!: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT PROFITABILITY
// ─────────────────────────────────────────────────────────────────────────────

@ObjectType({ description: 'Profitability analysis for a single product' })
export class ProductProfitability {
  @Field(() => ID) productId!: string;
  @Field() productName!: string;
  @Field() classification!: string; // OTC | POM | CONTROLLED
  @Field() supplierName!: string;

  @Field(() => Int) unitsSold!: number;
  @Field(() => Int) revenuePesewas!: number;
  @Field() revenueFormatted!: string;

  @Field(() => Int) cogsPesewas!: number;
  @Field(() => Int) grossProfitPesewas!: number;
  @Field() grossProfitFormatted!: string;

  @Field(() => Float, { description: 'Gross margin % for this product' })
  grossMarginPct!: number;

  @Field(() => Float, { description: 'Revenue contribution % of total branch revenue' })
  revenueContributionPct!: number;

  @Field({ description: 'A | B | C — ABC analysis tier' })
  abcTier!: string;

  @Field({ description: 'STAR | CASH_COW | QUESTION_MARK | DOG — BCG matrix classification' })
  bcgClassification!: string;

  @Field({ description: 'Action recommendation: PROMOTE | MAINTAIN | REVIEW_PRICE | DISCONTINUE' })
  action!: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// REVENUE INTELLIGENCE
// ─────────────────────────────────────────────────────────────────────────────

@ObjectType({ description: 'A single data point in a revenue trend series' })
export class RevenueTrendPoint {
  @Field() period!: string; // e.g. "2026-03" or "2026-W12"
  @Field(() => Int) revenuePesewas!: number;
  @Field() revenueFormatted!: string;
  @Field(() => Int) transactionCount!: number;
  @Field(() => Float) avgTransactionGhs!: number;
  @Field(() => Float, { nullable: true }) growthPct?: number; // vs prior period
}

@ObjectType({ description: 'Payment method share in revenue' })
export class PaymentMethodShare {
  @Field() method!: string;
  @Field() label!: string;
  @Field(() => Int) totalPesewas!: number;
  @Field() totalFormatted!: string;
  @Field(() => Float) sharePct!: number;
}

@ObjectType({ description: 'Revenue intelligence — trends, seasonality, anomalies' })
export class RevenueIntelligence {
  @Field(() => [RevenueTrendPoint], { description: 'Monthly revenue trend (last 12 months)' })
  monthlyTrend!: RevenueTrendPoint[];

  @Field(() => Float, { description: 'Month-over-month growth rate (%)' })
  momGrowthPct!: number;

  @Field(() => Float, { description: 'Year-over-year growth rate (%)' })
  yoyGrowthPct!: number;

  @Field(() => Float, { description: 'Compound monthly growth rate (CMGR) over 6 months (%)' })
  cmgr6MonthPct!: number;

  @Field(() => Int, { description: 'Projected revenue next month (pesewas) — linear regression' })
  projectedNextMonthPesewas!: number;
  @Field() projectedNextMonthFormatted!: string;

  @Field({ description: 'Best performing day of week (e.g. "Monday")' })
  bestDayOfWeek!: string;

  @Field({ description: 'Best performing hour of day (e.g. "10:00–11:00")' })
  peakHour!: string;

  @Field(() => Float, { description: 'Revenue per prescription dispensed (GHS)' })
  revenuePerRxGhs!: number;

  @Field({ description: 'Trend signal: ACCELERATING | STABLE | DECELERATING | DECLINING' })
  trendSignal!: string;

  @Field({ description: 'Narrative insight from the intelligence engine' })
  insight!: string;

  @Field(() => [PaymentMethodShare], { description: 'Revenue breakdown by payment method (Cash, MoMo, Card)' })
  paymentMix!: PaymentMethodShare[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYROLL ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

@ObjectType({ description: 'Payroll efficiency metrics — staff cost vs revenue' })
export class PayrollAnalytics {
  @Field(() => Int) totalPayrollPesewas!: number;
  @Field() totalPayrollFormatted!: string;

  @Field(() => Float, {
    description:
      'Payroll ratio = payroll / revenue. ' +
      'Pharmacy benchmark: 15–25%. Above 30% = overstaffed or underperforming.',
  })
  payrollRatioPct!: number;

  @Field(() => Float, { description: 'Revenue per staff member (GHS)' })
  revenuePerStaffGhs!: number;

  @Field(() => Float, { description: 'Gross profit per staff member (GHS)' })
  grossProfitPerStaffGhs!: number;

  @Field(() => Int) activeStaffCount!: number;

  @Field({ description: 'EFFICIENT | WATCH | OVERSTAFFED' })
  efficiencyRating!: string;

  @Field({ description: 'Recommendation from the intelligence engine' })
  recommendation!: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// VAT & TAX COMPLIANCE
// ─────────────────────────────────────────────────────────────────────────────

@ObjectType({ description: 'Ghana GRA VAT compliance report — monthly return data' })
export class VatComplianceReport {
  @Field() period!: string; // e.g. "2026-03"
  @Field() returnDueDate!: string; // 30th of following month

  @Field(() => Int, { description: 'Total taxable sales (non-exempt) in pesewas' })
  taxableSalesPesewas!: number;
  @Field() taxableSalesFormatted!: string;

  @Field(() => Int, { description: 'VAT-exempt sales (Rx medicines) in pesewas' })
  exemptSalesPesewas!: number;
  @Field() exemptSalesFormatted!: string;

  @Field(() => Int, { description: 'VAT collected (12.5%) in pesewas' })
  vatCollectedPesewas!: number;
  @Field() vatCollectedFormatted!: string;

  @Field(() => Int, { description: 'NHIL collected (2.5%) in pesewas' })
  nhilCollectedPesewas!: number;
  @Field() nhilCollectedFormatted!: string;

  @Field(() => Int, { description: 'Total tax liability (VAT + NHIL) in pesewas' })
  totalTaxLiabilityPesewas!: number;
  @Field() totalTaxLiabilityFormatted!: string;

  @Field(() => Int, { description: 'Input VAT on supplier invoices (claimable)' })
  inputVatPesewas!: number;
  @Field() inputVatFormatted!: string;

  @Field(() => Int, { description: 'Net VAT payable to GRA = output - input' })
  netVatPayablePesewas!: number;
  @Field() netVatPayableFormatted!: string;

  @Field({ description: 'FILED | PENDING | OVERDUE' })
  filingStatus!: string;

  @Field({ description: 'Reminder message for the owner' })
  reminder!: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// INVESTMENT INTELLIGENCE
// ─────────────────────────────────────────────────────────────────────────────

@ObjectType({ description: 'A single investment recommendation' })
export class InvestmentRecommendation {
  @Field({ description: 'EXPAND_INVENTORY | OPEN_BRANCH | HIRE_STAFF | EQUIPMENT | MARKETING | TREASURY | HOLD_CASH' })
  type!: string;

  @Field({ description: 'Short title of the recommendation' })
  title!: string;

  @Field({ description: 'Detailed rationale based on actual financial data' })
  rationale!: string;

  @Field(() => Int, { description: 'Estimated investment required (pesewas)' })
  estimatedInvestmentPesewas!: number;
  @Field() estimatedInvestmentFormatted!: string;

  @Field(() => Float, { description: 'Estimated ROI % within 12 months' })
  estimatedRoi12MonthPct!: number;

  @Field(() => Float, { description: 'Estimated payback period in months' })
  paybackMonths!: number;

  @Field({ description: 'HIGH | MEDIUM | LOW — confidence in this recommendation' })
  confidence!: string;

  @Field({ description: 'HIGH | MEDIUM | LOW — risk level' })
  riskLevel!: string;

  @Field({ description: 'IMMEDIATE | WITHIN_3_MONTHS | WITHIN_6_MONTHS | MONITOR' })
  urgency!: string;
}

@ObjectType({ description: 'Full investment intelligence report — only generated when business is profitable' })
export class InvestmentIntelligenceReport {
  @Field({ description: 'Whether the business qualifies for investment recommendations (profitable + healthy cash)' })
  qualifiesForInvestment!: boolean;

  @Field({ description: 'Reason why or why not the business qualifies' })
  qualificationReason!: string;

  @Field(() => Float, { description: 'Net profit margin % (must be > 10% to qualify)' })
  netProfitMarginPct!: number;

  @Field(() => Float, { description: 'Cash runway in days' })
  cashRunwayDays!: number;

  @Field(() => [InvestmentRecommendation], { description: 'Ranked investment recommendations (best ROI first)' })
  recommendations!: InvestmentRecommendation[];

  @Field({ description: 'Executive summary from the CFO intelligence engine' })
  executiveSummary!: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTIVE DASHBOARD — THE FULL CFO BRIEFING
// ─────────────────────────────────────────────────────────────────────────────

@ObjectType({ description: 'A single alert or action item for the owner' })
export class FinancialAlert {
  @Field({ description: 'CRITICAL | WARNING | INFO | OPPORTUNITY' })
  severity!: string;

  @Field({ description: 'Alert category: CASH | PAYABLES | INVENTORY | TAX | STAFF | GROWTH' })
  category!: string;

  @Field() title!: string;
  @Field() message!: string;

  @Field({ nullable: true, description: 'Suggested action to resolve the alert' })
  action?: string;

  @Field(() => Int, { nullable: true, description: 'Financial impact in pesewas (if quantifiable)' })
  impactPesewas?: number;
  @Field({ nullable: true }) impactFormatted?: string;
}

@ObjectType({ description: 'Key financial ratio benchmarked against pharmacy industry standards' })
export class FinancialRatio {
  @Field() name!: string;
  @Field() value!: string;
  @Field() benchmark!: string;
  @Field({ description: 'ABOVE_BENCHMARK | AT_BENCHMARK | BELOW_BENCHMARK' })
  status!: string;
  @Field() interpretation!: string;
}

@ObjectType({
  description:
    'The complete CFO briefing — everything a hired accountant would present to the pharmacy owner. ' +
    'Covers working capital, inventory efficiency, supplier performance, revenue trends, ' +
    'payroll analytics, VAT compliance, and investment intelligence.',
})
export class CfoBriefing {
  @Field() generatedAt!: Date;
  @Field() branchName!: string;
  @Field() periodCovered!: string;

  // ── Headline numbers ──────────────────────────────────────────────────────
  @Field(() => Int) monthRevenuePesewas!: number;
  @Field() monthRevenueFormatted!: string;
  @Field(() => Int) monthNetProfitPesewas!: number;
  @Field() monthNetProfitFormatted!: string;
  @Field(() => Float) monthNetMarginPct!: number;
  @Field(() => Int) cashOnHandPesewas!: number;
  @Field() cashOnHandFormatted!: string;
  @Field(() => Int) totalPayablesPesewas!: number;
  @Field() totalPayablesFormatted!: string;

  // ── Sections ──────────────────────────────────────────────────────────────
  @Field(() => WorkingCapitalReport) workingCapital!: WorkingCapitalReport;
  @Field(() => InventoryFinancialMetrics) inventoryMetrics!: InventoryFinancialMetrics;
  @Field(() => RevenueIntelligence) revenueIntelligence!: RevenueIntelligence;
  @Field(() => PayrollAnalytics) payrollAnalytics!: PayrollAnalytics;
  @Field(() => VatComplianceReport) vatCompliance!: VatComplianceReport;
  @Field(() => InvestmentIntelligenceReport) investmentIntelligence!: InvestmentIntelligenceReport;

  // ── Alerts & ratios ───────────────────────────────────────────────────────
  @Field(() => [FinancialAlert], { description: 'Prioritised alerts requiring owner attention' })
  alerts!: FinancialAlert[];

  @Field(() => [FinancialRatio], { description: 'Key ratios benchmarked against pharmacy industry' })
  keyRatios!: FinancialRatio[];

  @Field(() => [SupplierScorecard], { description: 'Top 5 suppliers by spend with performance scores' })
  topSuppliers!: SupplierScorecard[];

  @Field(() => [ProductProfitability], { description: 'Top 10 products by gross profit contribution' })
  topProducts!: ProductProfitability[];

  // ── CFO narrative ─────────────────────────────────────────────────────────
  @Field({ description: 'Plain-English executive summary written by the CFO intelligence engine' })
  executiveSummary!: string;

  @Field({ description: 'EXCELLENT | GOOD | FAIR | POOR — overall financial health score' })
  overallHealthScore!: string;

  @Field(() => Int, { description: 'Numeric health score 0–100' })
  healthScoreNumeric!: number;
}
