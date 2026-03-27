export declare class FinancialPeriodInput {
    periodStart: string;
    periodEnd: string;
}
export declare class ForecastInput {
    horizonDays?: number;
}
export declare class WorkingCapitalReport {
    currentAssetsPesewas: number;
    currentAssetsFormatted: string;
    currentLiabilitiesPesewas: number;
    currentLiabilitiesFormatted: string;
    workingCapitalPesewas: number;
    workingCapitalFormatted: string;
    currentRatio: number;
    quickRatio: number;
    cashAndEquivalentsPesewas: number;
    cashAndEquivalentsFormatted: string;
    inventoryValuePesewas: number;
    inventoryValueFormatted: string;
    accountsReceivablePesewas: number;
    accountsReceivableFormatted: string;
    accountsPayablePesewas: number;
    accountsPayableFormatted: string;
    healthStatus: string;
    narrative: string;
    cashRunwayDays: number;
}
export declare class InventoryFinancialMetrics {
    inventoryTurnoverRatio: number;
    daysInventoryOutstanding: number;
    inventoryValueAtCostPesewas: number;
    inventoryValueAtCostFormatted: string;
    inventoryValueAtSellingPricePesewas: number;
    inventoryValueAtSellingPriceFormatted: string;
    potentialMarginPct: number;
    slowMovingStockValuePesewas: number;
    slowMovingStockValueFormatted: string;
    nearExpiryValuePesewas: number;
    nearExpiryValueFormatted: string;
    shrinkageRatePct: number;
    recommendation: string;
}
export declare class SupplierScorecard {
    supplierId: string;
    supplierName: string;
    totalPurchasedPesewas: number;
    totalPurchasedFormatted: string;
    cogsSharePct: number;
    avgGrossMarginPct: number;
    avgDaysToPayDpo: number;
    outstandingPesewas: number;
    outstandingFormatted: string;
    overduePesewas: number;
    onTimeDeliveryRatePct: number;
    abcTier: string;
    relationshipRecommendation: string;
}
export declare class ProductProfitability {
    productId: string;
    productName: string;
    classification: string;
    supplierName: string;
    unitsSold: number;
    revenuePesewas: number;
    revenueFormatted: string;
    cogsPesewas: number;
    grossProfitPesewas: number;
    grossProfitFormatted: string;
    grossMarginPct: number;
    revenueContributionPct: number;
    abcTier: string;
    bcgClassification: string;
    action: string;
}
export declare class RevenueTrendPoint {
    period: string;
    revenuePesewas: number;
    revenueFormatted: string;
    transactionCount: number;
    avgTransactionGhs: number;
    growthPct?: number;
}
export declare class RevenueIntelligence {
    monthlyTrend: RevenueTrendPoint[];
    momGrowthPct: number;
    yoyGrowthPct: number;
    cmgr6MonthPct: number;
    projectedNextMonthPesewas: number;
    projectedNextMonthFormatted: string;
    bestDayOfWeek: string;
    peakHour: string;
    revenuePerRxGhs: number;
    trendSignal: string;
    insight: string;
}
export declare class PayrollAnalytics {
    totalPayrollPesewas: number;
    totalPayrollFormatted: string;
    payrollRatioPct: number;
    revenuePerStaffGhs: number;
    grossProfitPerStaffGhs: number;
    activeStaffCount: number;
    efficiencyRating: string;
    recommendation: string;
}
export declare class VatComplianceReport {
    period: string;
    returnDueDate: string;
    taxableSalesPesewas: number;
    taxableSalesFormatted: string;
    exemptSalesPesewas: number;
    exemptSalesFormatted: string;
    vatCollectedPesewas: number;
    vatCollectedFormatted: string;
    nhilCollectedPesewas: number;
    nhilCollectedFormatted: string;
    totalTaxLiabilityPesewas: number;
    totalTaxLiabilityFormatted: string;
    inputVatPesewas: number;
    inputVatFormatted: string;
    netVatPayablePesewas: number;
    netVatPayableFormatted: string;
    filingStatus: string;
    reminder: string;
}
export declare class InvestmentRecommendation {
    type: string;
    title: string;
    rationale: string;
    estimatedInvestmentPesewas: number;
    estimatedInvestmentFormatted: string;
    estimatedRoi12MonthPct: number;
    paybackMonths: number;
    confidence: string;
    riskLevel: string;
    urgency: string;
}
export declare class InvestmentIntelligenceReport {
    qualifiesForInvestment: boolean;
    qualificationReason: string;
    netProfitMarginPct: number;
    cashRunwayDays: number;
    recommendations: InvestmentRecommendation[];
    executiveSummary: string;
}
export declare class FinancialAlert {
    severity: string;
    category: string;
    title: string;
    message: string;
    action?: string;
    impactPesewas?: number;
    impactFormatted?: string;
}
export declare class FinancialRatio {
    name: string;
    value: string;
    benchmark: string;
    status: string;
    interpretation: string;
}
export declare class CfoBriefing {
    generatedAt: Date;
    branchName: string;
    periodCovered: string;
    monthRevenuePesewas: number;
    monthRevenueFormatted: string;
    monthNetProfitPesewas: number;
    monthNetProfitFormatted: string;
    monthNetMarginPct: number;
    cashOnHandPesewas: number;
    cashOnHandFormatted: string;
    totalPayablesPesewas: number;
    totalPayablesFormatted: string;
    workingCapital: WorkingCapitalReport;
    inventoryMetrics: InventoryFinancialMetrics;
    revenueIntelligence: RevenueIntelligence;
    payrollAnalytics: PayrollAnalytics;
    vatCompliance: VatComplianceReport;
    investmentIntelligence: InvestmentIntelligenceReport;
    alerts: FinancialAlert[];
    keyRatios: FinancialRatio[];
    topSuppliers: SupplierScorecard[];
    topProducts: ProductProfitability[];
    executiveSummary: string;
    overallHealthScore: string;
    healthScoreNumeric: number;
}
