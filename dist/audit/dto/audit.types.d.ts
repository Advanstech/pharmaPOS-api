export declare class AuditPeriodInput {
    periodStart: string;
    periodEnd: string;
}
export declare class StaffInvestigationInput {
    userId: string;
    fromDate?: string;
    toDate?: string;
}
export declare class AuditFinding {
    id: string;
    severity: string;
    category: string;
    title: string;
    description: string;
    regulatoryReference?: string;
    recommendation: string;
    financialImpactPesewas?: number;
    financialImpactFormatted?: string;
    implicatedUserId?: string;
    entityType?: string;
    entityId?: string;
    detectedAt: Date;
}
export declare class StaffBehaviourAnomaly {
    anomalyType: string;
    description: string;
    occurrenceCount: number;
    firstSeen?: Date;
    lastSeen?: Date;
    deviationSigma: number;
    riskLevel: string;
}
export declare class StaffBehaviourProfile {
    userId: string;
    role: string;
    branchName: string;
    totalSalesCount: number;
    totalRevenuePesewas: number;
    totalRevenueFormatted: string;
    avgSaleValueGhs: number;
    voidCount: number;
    refundCount: number;
    discountCount: number;
    pomAttemptBlockCount: number;
    peakActivityHour: string;
    afterHoursTransactionCount: number;
    avgItemScanSpeedSeconds: number;
    anomalies: StaffBehaviourAnomaly[];
    riskRating: string;
    riskScore: number;
    summary: string;
}
export declare class DispensingComplianceAudit {
    pomSalesWithoutRxCount: number;
    pomSalesWithoutRxValuePesewas: number;
    pomSalesWithoutRxFormatted: string;
    expiredRxDispensedCount: number;
    controlledDrugSingleSignoffCount: number;
    chemicalShopPomAttemptCount: number;
    rxWithoutGmdcValidationCount: number;
    rxWithExpiredGmdcLicenceCount: number;
    rxMissingPdfCount: number;
    rxPdfCompliancePct: number;
    majorInteractionOverrideCount: number;
    contraindicatedAttemptCount: number;
    overallStatus: string;
    findings: AuditFinding[];
}
export declare class FinancialIntegrityAudit {
    expectedRevenuePesewas: number;
    expectedRevenueFormatted: string;
    recordedRevenuePesewas: number;
    recordedRevenueFormatted: string;
    revenueDiscrepancyPesewas: number;
    revenueDiscrepancyFormatted: string;
    totalVoidsPesewas: number;
    totalVoidsFormatted: string;
    voidRatePct: number;
    voidBenchmarkStatus: string;
    totalRefundsPesewas: number;
    totalRefundsFormatted: string;
    refundRatePct: number;
    cashSalesPesewas: number;
    momoSalesPesewas: number;
    cashToMomoRatio: number;
    cashDominanceFlag: boolean;
    unmatchedInvoiceCount: number;
    unmatchedInvoiceValuePesewas: number;
    unmatchedInvoiceFormatted: string;
    duplicateInvoiceCount: number;
    invoicesWithoutGrnCount: number;
    expensesWithoutReceiptCount: number;
    expensesWithoutReceiptValuePesewas: number;
    roundNumberExpenseCount: number;
    roundNumberExpenseFlag: boolean;
    unbalancedGlEntriesCount: number;
    glEntriesWithoutReferenceCount: number;
    integrityStatus: string;
    findings: AuditFinding[];
}
export declare class InventoryIntegrityAudit {
    totalAdjustmentCount: number;
    negativeAdjustmentCount: number;
    negativeAdjustmentValuePesewas: number;
    negativeAdjustmentFormatted: string;
    shrinkageRatePct: number;
    shrinkageStatus: string;
    phantomStockSalesCount: number;
    phantomStockValuePesewas: number;
    expiredStockDispensedCount: number;
    nearExpiryNotFlaggedCount: number;
    grnWithoutInvoiceCount: number;
    stockReceivedNotInGrnCount: number;
    highValueAdjustmentByOneUserCount: number;
    integrityStatus: string;
    findings: AuditFinding[];
}
export declare class TaxComplianceAudit {
    vatCollectedPesewas: number;
    vatCollectedFormatted: string;
    vatRemittedPesewas: number;
    vatRemittedFormatted: string;
    vatGapPesewas: number;
    vatGapFormatted: string;
    vatFilingStatus: string;
    exemptSalesWithoutRxCount: number;
    exemptionAbuseFlag: boolean;
    staffOnPayrollCount: number;
    staffWithPayeDeductionCount: number;
    payeComplianceFlag: boolean;
    supplierPaymentsAboveThresholdCount: number;
    supplierPaymentsWithoutWhtCount: number;
    overallTaxStatus: string;
    findings: AuditFinding[];
}
export declare class LicenceComplianceAudit {
    pharmacistsWithExpiredLicenceCount: number;
    pharmacistsWithNoLicenceCount: number;
    licencesExpiringIn30DaysCount: number;
    branchLicenceOnFile: boolean;
    branchLicenceExpiryDate?: string;
    branchLicenceStatus: string;
    controlledDrugRegisterCompliant: boolean;
    controlledDrugDispensedWithoutDoubleSignoffCount: number;
    coldChainProductsWithoutTempLogCount: number;
    overallStatus: string;
    findings: AuditFinding[];
}
export declare class RiskMatrixEntry {
    riskTitle: string;
    riskType: string;
    likelihood: string;
    impact: string;
    inherentRisk: string;
    mitigationStatus: string;
    recommendedControl: string;
}
export declare class InternalAuditReport {
    reportId: string;
    generatedAt: Date;
    branchName: string;
    auditPeriod: string;
    auditedBy: string;
    overallRiskScore: number;
    overallRiskRating: string;
    criticalFindingsCount: number;
    highFindingsCount: number;
    totalFindingsCount: number;
    totalFinancialExposurePesewas: number;
    totalFinancialExposureFormatted: string;
    dispensingCompliance: DispensingComplianceAudit;
    financialIntegrity: FinancialIntegrityAudit;
    inventoryIntegrity: InventoryIntegrityAudit;
    taxCompliance: TaxComplianceAudit;
    licenceCompliance: LicenceComplianceAudit;
    staffProfiles: StaffBehaviourProfile[];
    riskMatrix: RiskMatrixEntry[];
    allFindings: AuditFinding[];
    auditorOpinion: string;
    opinionNarrative: string;
    immediateActionPlan: string;
}
