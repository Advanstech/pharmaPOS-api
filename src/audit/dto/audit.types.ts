import { ObjectType, Field, ID, Int, Float, InputType } from '@nestjs/graphql';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

// ─────────────────────────────────────────────────────────────────────────────
// INPUTS
// ─────────────────────────────────────────────────────────────────────────────

@InputType()
export class AuditPeriodInput {
  @Field() @IsDateString() periodStart!: string;
  @Field() @IsDateString() periodEnd!: string;
}

@InputType()
export class StaffInvestigationInput {
  @Field(() => ID) @IsUUID() userId!: string;
  @Field({ nullable: true }) @IsOptional() @IsDateString() fromDate?: string;
  @Field({ nullable: true }) @IsOptional() @IsDateString() toDate?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// FINDING — the atomic unit of every audit report
// ─────────────────────────────────────────────────────────────────────────────

@ObjectType({ description: 'A single audit finding — the atomic unit of every report' })
export class AuditFinding {
  @Field(() => ID) id!: string;

  @Field({
    description:
      'CRITICAL | HIGH | MEDIUM | LOW | INFO — ' +
      'CRITICAL = regulatory violation or fraud signal, HIGH = financial risk, ' +
      'MEDIUM = process gap, LOW = best-practice deviation, INFO = observation',
  })
  severity!: string;

  @Field({
    description:
      'FRAUD | REGULATORY | FINANCIAL | OPERATIONAL | STAFF | INVENTORY | TAX | DISPENSING | DATA_INTEGRITY',
  })
  category!: string;

  @Field({ description: 'Short title of the finding' })
  title!: string;

  @Field({ description: 'Detailed description of what was found and why it matters' })
  description!: string;

  @Field({ description: 'Specific Ghana law, FDA rule, or GRA regulation breached (if applicable)', nullable: true })
  regulatoryReference?: string;

  @Field({ description: 'Concrete recommended action to remediate this finding' })
  recommendation!: string;

  @Field(() => Int, { nullable: true, description: 'Estimated financial impact in GHS pesewas' })
  financialImpactPesewas?: number;

  @Field({ nullable: true }) financialImpactFormatted?: string;

  @Field({ nullable: true, description: 'User ID implicated (no name — Ghana DPA 2012)' })
  implicatedUserId?: string;

  @Field({ nullable: true, description: 'Entity type involved (sale, product, prescription, etc.)' })
  entityType?: string;

  @Field({ nullable: true, description: 'Entity ID involved' })
  entityId?: string;

  @Field({ description: 'ISO timestamp when this finding was detected' })
  detectedAt!: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// STAFF BEHAVIOUR PROFILE — the "spy" report
// ─────────────────────────────────────────────────────────────────────────────

@ObjectType({ description: 'Behavioural anomaly detected for a staff member' })
export class StaffBehaviourAnomaly {
  @Field({ description: 'VOID_ABUSE | DISCOUNT_ABUSE | AFTER_HOURS | SPEED_ANOMALY | REFUND_PATTERN | CASH_DISCREPANCY | POM_BYPASS_ATTEMPT | IDLE_SESSION | BULK_DELETION' })
  anomalyType!: string;

  @Field() description!: string;
  @Field(() => Int) occurrenceCount!: number;
  @Field({ nullable: true }) firstSeen?: Date;
  @Field({ nullable: true }) lastSeen?: Date;
  @Field(() => Float, { description: 'Deviation from branch average (standard deviations)' })
  deviationSigma!: number;
  @Field({ description: 'LOW | MEDIUM | HIGH — risk level of this anomaly' })
  riskLevel!: string;
}

@ObjectType({ description: 'Full behavioural profile of a staff member — the internal spy report' })
export class StaffBehaviourProfile {
  @Field(() => ID) userId!: string;
  @Field() role!: string;
  @Field() branchName!: string;

  // Performance metrics
  @Field(() => Int) totalSalesCount!: number;
  @Field(() => Int) totalRevenuePesewas!: number;
  @Field() totalRevenueFormatted!: string;
  @Field(() => Float) avgSaleValueGhs!: number;
  @Field(() => Int) voidCount!: number;
  @Field(() => Int) refundCount!: number;
  @Field(() => Int) discountCount!: number;
  @Field(() => Int) pomAttemptBlockCount!: number;

  // Time patterns
  @Field({ description: 'Most active hour of day (e.g. "14:00–15:00")' })
  peakActivityHour!: string;
  @Field(() => Int) afterHoursTransactionCount!: number;
  @Field(() => Float, { description: 'Avg seconds between sale items — very low = suspicious speed' })
  avgItemScanSpeedSeconds!: number;

  // Risk signals
  @Field(() => [StaffBehaviourAnomaly]) anomalies!: StaffBehaviourAnomaly[];
  @Field({ description: 'CLEAN | WATCH | INVESTIGATE | ESCALATE' }) riskRating!: string;
  @Field(() => Int, { description: 'Risk score 0–100' }) riskScore!: number;
  @Field({ description: 'Plain-English summary of the staff member\'s risk profile' }) summary!: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPENSING COMPLIANCE AUDIT
// ─────────────────────────────────────────────────────────────────────────────

@ObjectType({ description: 'Ghana FDA dispensing compliance audit result' })
export class DispensingComplianceAudit {
  // Ghana FDA Rule 1: POM without Rx
  @Field(() => Int) pomSalesWithoutRxCount!: number;
  @Field(() => Int) pomSalesWithoutRxValuePesewas!: number;
  @Field() pomSalesWithoutRxFormatted!: string;

  // Ghana FDA Rule 4: Expired Rx dispensed
  @Field(() => Int) expiredRxDispensedCount!: number;

  // Ghana FDA Rule 5: Controlled drugs — single sign-off
  @Field(() => Int) controlledDrugSingleSignoffCount!: number;

  // Ghana FDA Rule 6: Chemical shop POM
  @Field(() => Int) chemicalShopPomAttemptCount!: number;

  // GMDC licence validation gaps
  @Field(() => Int) rxWithoutGmdcValidationCount!: number;
  @Field(() => Int) rxWithExpiredGmdcLicenceCount!: number;

  // Rx PDF upload compliance (5-year retention rule)
  @Field(() => Int) rxMissingPdfCount!: number;
  @Field(() => Float) rxPdfCompliancePct!: number;

  // Drug interaction overrides
  @Field(() => Int) majorInteractionOverrideCount!: number;
  @Field(() => Int) contraindicatedAttemptCount!: number;

  @Field({ description: 'COMPLIANT | MINOR_GAPS | MAJOR_VIOLATIONS | CRITICAL_VIOLATIONS' })
  overallStatus!: string;

  @Field(() => [AuditFinding]) findings!: AuditFinding[];
}

// ─────────────────────────────────────────────────────────────────────────────
// FINANCIAL INTEGRITY AUDIT
// ─────────────────────────────────────────────────────────────────────────────

@ObjectType({ description: 'Financial integrity audit — detects fraud, leakage, and irregularities' })
export class FinancialIntegrityAudit {
  // Revenue reconciliation
  @Field(() => Int) expectedRevenuePesewas!: number;
  @Field() expectedRevenueFormatted!: string;
  @Field(() => Int) recordedRevenuePesewas!: number;
  @Field() recordedRevenueFormatted!: string;
  @Field(() => Int) revenueDiscrepancyPesewas!: number;
  @Field() revenueDiscrepancyFormatted!: string;

  // Void & refund analysis
  @Field(() => Int) totalVoidsPesewas!: number;
  @Field() totalVoidsFormatted!: string;
  @Field(() => Float) voidRatePct!: number;
  @Field({ description: 'Benchmark: < 2%. Above 5% = investigate' }) voidBenchmarkStatus!: string;

  @Field(() => Int) totalRefundsPesewas!: number;
  @Field() totalRefundsFormatted!: string;
  @Field(() => Float) refundRatePct!: number;

  // Cash handling
  @Field(() => Int) cashSalesPesewas!: number;
  @Field(() => Int) momoSalesPesewas!: number;
  @Field(() => Float) cashToMomoRatio!: number;
  @Field({ description: 'Unusual cash dominance may indicate MoMo fee avoidance or under-reporting' })
  cashDominanceFlag!: boolean;

  // Supplier invoice integrity
  @Field(() => Int) unmatchedInvoiceCount!: number;
  @Field(() => Int) unmatchedInvoiceValuePesewas!: number;
  @Field() unmatchedInvoiceFormatted!: string;
  @Field(() => Int) duplicateInvoiceCount!: number;
  @Field(() => Int) invoicesWithoutGrnCount!: number;

  // Expense integrity
  @Field(() => Int) expensesWithoutReceiptCount!: number;
  @Field(() => Int) expensesWithoutReceiptValuePesewas!: number;
  @Field(() => Int) roundNumberExpenseCount!: number;
  @Field({ description: 'Round-number expenses (e.g. exactly GH₵500) are a fraud signal' })
  roundNumberExpenseFlag!: boolean;

  // GL integrity
  @Field(() => Int) unbalancedGlEntriesCount!: number;
  @Field(() => Int) glEntriesWithoutReferenceCount!: number;

  @Field({ description: 'CLEAN | ANOMALIES_DETECTED | FRAUD_SIGNALS | CRITICAL_BREACH' })
  integrityStatus!: string;

  @Field(() => [AuditFinding]) findings!: AuditFinding[];
}

// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY INTEGRITY AUDIT
// ─────────────────────────────────────────────────────────────────────────────

@ObjectType({ description: 'Inventory integrity audit — detects theft, shrinkage, and stock manipulation' })
export class InventoryIntegrityAudit {
  @Field(() => Int) totalAdjustmentCount!: number;
  @Field(() => Int) negativeAdjustmentCount!: number;
  @Field(() => Int) negativeAdjustmentValuePesewas!: number;
  @Field() negativeAdjustmentFormatted!: string;

  @Field(() => Float, { description: 'Shrinkage rate % — benchmark < 1% for pharmacy' })
  shrinkageRatePct!: number;
  @Field({ description: 'ACCEPTABLE | ELEVATED | CRITICAL' }) shrinkageStatus!: string;

  // Phantom stock — items sold but not in inventory
  @Field(() => Int) phantomStockSalesCount!: number;
  @Field(() => Int) phantomStockValuePesewas!: number;

  // Expiry management
  @Field(() => Int) expiredStockDispensedCount!: number;
  @Field(() => Int) nearExpiryNotFlaggedCount!: number;

  // GRN integrity
  @Field(() => Int) grnWithoutInvoiceCount!: number;
  @Field(() => Int) stockReceivedNotInGrnCount!: number;

  // High-value adjustments by single user
  @Field(() => Int) highValueAdjustmentByOneUserCount!: number;

  @Field({ description: 'CLEAN | WATCH | INVESTIGATE | CRITICAL' }) integrityStatus!: string;
  @Field(() => [AuditFinding]) findings!: AuditFinding[];
}

// ─────────────────────────────────────────────────────────────────────────────
// TAX COMPLIANCE AUDIT (Ghana GRA)
// ─────────────────────────────────────────────────────────────────────────────

@ObjectType({ description: 'Ghana GRA tax compliance audit — VAT, PAYE, withholding tax' })
export class TaxComplianceAudit {
  // VAT
  @Field(() => Int) vatCollectedPesewas!: number;
  @Field() vatCollectedFormatted!: string;
  @Field(() => Int) vatRemittedPesewas!: number;
  @Field() vatRemittedFormatted!: string;
  @Field(() => Int) vatGapPesewas!: number;
  @Field() vatGapFormatted!: string;
  @Field({ description: 'FILED | PENDING | OVERDUE | NEVER_FILED' }) vatFilingStatus!: string;

  // VAT-exempt sales integrity
  @Field(() => Int) exemptSalesWithoutRxCount!: number;
  @Field({ description: 'Claiming VAT exemption on non-Rx sales is a GRA violation' })
  exemptionAbuseFlag!: boolean;

  // PAYE (staff income tax)
  @Field(() => Int) staffOnPayrollCount!: number;
  @Field(() => Int) staffWithPayeDeductionCount!: number;
  @Field({ description: 'Staff paid without PAYE deduction is a GRA violation' })
  payeComplianceFlag!: boolean;

  // Withholding tax on supplier payments > GH₵2,000
  @Field(() => Int) supplierPaymentsAboveThresholdCount!: number;
  @Field(() => Int) supplierPaymentsWithoutWhtCount!: number;

  @Field({ description: 'COMPLIANT | MINOR_GAPS | MAJOR_VIOLATIONS | CRITICAL' })
  overallTaxStatus!: string;

  @Field(() => [AuditFinding]) findings!: AuditFinding[];
}

// ─────────────────────────────────────────────────────────────────────────────
// LICENCE & REGULATORY COMPLIANCE
// ─────────────────────────────────────────────────────────────────────────────

@ObjectType({ description: 'Licence and regulatory compliance status — Ghana FDA, HeFRA, Pharmacy Council' })
export class LicenceComplianceAudit {
  // Staff professional licences
  @Field(() => Int) pharmacistsWithExpiredLicenceCount!: number;
  @Field(() => Int) pharmacistsWithNoLicenceCount!: number;
  @Field(() => Int) licencesExpiringIn30DaysCount!: number;

  // Branch operating licence
  @Field({ description: 'Whether the branch has a valid HeFRA operating licence on file' })
  branchLicenceOnFile!: boolean;
  @Field({ nullable: true }) branchLicenceExpiryDate?: string;
  @Field({ description: 'VALID | EXPIRING_SOON | EXPIRED | NOT_ON_FILE' }) branchLicenceStatus!: string;

  // Controlled drug register
  @Field({ description: 'Ghana FDA requires a physical controlled drug register' })
  controlledDrugRegisterCompliant!: boolean;
  @Field(() => Int) controlledDrugDispensedWithoutDoubleSignoffCount!: number;

  // Cold chain compliance (vaccines, insulin, etc.)
  @Field(() => Int) coldChainProductsWithoutTempLogCount!: number;

  @Field({ description: 'COMPLIANT | MINOR_GAPS | MAJOR_VIOLATIONS | CRITICAL' })
  overallStatus!: string;

  @Field(() => [AuditFinding]) findings!: AuditFinding[];
}

// ─────────────────────────────────────────────────────────────────────────────
// THE MASTER AUDIT REPORT
// ─────────────────────────────────────────────────────────────────────────────

@ObjectType({ description: 'Risk matrix entry — probability vs impact' })
export class RiskMatrixEntry {
  @Field() riskTitle!: string;
  @Field({ description: 'FRAUD | REGULATORY | FINANCIAL | OPERATIONAL | REPUTATIONAL' }) riskType!: string;
  @Field({ description: 'LOW | MEDIUM | HIGH | CRITICAL' }) likelihood!: string;
  @Field({ description: 'LOW | MEDIUM | HIGH | CRITICAL' }) impact!: string;
  @Field({ description: 'LOW | MEDIUM | HIGH | CRITICAL — combined risk rating' }) inherentRisk!: string;
  @Field() mitigationStatus!: string;
  @Field() recommendedControl!: string;
}

@ObjectType({
  description:
    'The complete internal audit report — financial police, compliance watchdog, and staff monitor. ' +
    'Covers Ghana FDA dispensing compliance, GRA tax compliance, financial integrity, ' +
    'inventory integrity, licence compliance, staff behaviour profiling, and risk matrix.',
})
export class InternalAuditReport {
  @Field(() => ID) reportId!: string;
  @Field() generatedAt!: Date;
  @Field() branchName!: string;
  @Field() auditPeriod!: string;
  @Field() auditedBy!: string; // "PharmaPOS Internal Audit Engine v1"

  // ── Headline risk score ───────────────────────────────────────────────────
  @Field(() => Int, { description: 'Overall risk score 0–100 (100 = maximum risk)' })
  overallRiskScore!: number;
  @Field({ description: 'LOW | MEDIUM | HIGH | CRITICAL' }) overallRiskRating!: string;
  @Field(() => Int) criticalFindingsCount!: number;
  @Field(() => Int) highFindingsCount!: number;
  @Field(() => Int) totalFindingsCount!: number;
  @Field(() => Int, { description: 'Total estimated financial exposure in pesewas' })
  totalFinancialExposurePesewas!: number;
  @Field() totalFinancialExposureFormatted!: string;

  // ── Audit sections ────────────────────────────────────────────────────────
  @Field(() => DispensingComplianceAudit) dispensingCompliance!: DispensingComplianceAudit;
  @Field(() => FinancialIntegrityAudit) financialIntegrity!: FinancialIntegrityAudit;
  @Field(() => InventoryIntegrityAudit) inventoryIntegrity!: InventoryIntegrityAudit;
  @Field(() => TaxComplianceAudit) taxCompliance!: TaxComplianceAudit;
  @Field(() => LicenceComplianceAudit) licenceCompliance!: LicenceComplianceAudit;

  // ── Staff intelligence ────────────────────────────────────────────────────
  @Field(() => [StaffBehaviourProfile], { description: 'Behavioural profiles for all active staff — ranked by risk score' })
  staffProfiles!: StaffBehaviourProfile[];

  // ── Risk matrix ───────────────────────────────────────────────────────────
  @Field(() => [RiskMatrixEntry]) riskMatrix!: RiskMatrixEntry[];

  // ── All findings consolidated ─────────────────────────────────────────────
  @Field(() => [AuditFinding], { description: 'All findings across all sections, sorted by severity' })
  allFindings!: AuditFinding[];

  // ── Auditor opinion ───────────────────────────────────────────────────────
  @Field({ description: 'UNQUALIFIED | QUALIFIED | ADVERSE | DISCLAIMER — auditor\'s opinion on the period' })
  auditorOpinion!: string;

  @Field({ description: 'Plain-English audit opinion narrative' })
  opinionNarrative!: string;

  @Field({ description: 'Prioritised action plan — what the owner must do this week' })
  immediateActionPlan!: string;
}
