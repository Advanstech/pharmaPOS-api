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
exports.InternalAuditReport = exports.RiskMatrixEntry = exports.LicenceComplianceAudit = exports.TaxComplianceAudit = exports.InventoryIntegrityAudit = exports.FinancialIntegrityAudit = exports.DispensingComplianceAudit = exports.StaffBehaviourProfile = exports.StaffBehaviourAnomaly = exports.AuditFinding = exports.StaffInvestigationInput = exports.AuditPeriodInput = void 0;
const graphql_1 = require("@nestjs/graphql");
const class_validator_1 = require("class-validator");
let AuditPeriodInput = class AuditPeriodInput {
};
exports.AuditPeriodInput = AuditPeriodInput;
__decorate([
    (0, graphql_1.Field)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AuditPeriodInput.prototype, "periodStart", void 0);
__decorate([
    (0, graphql_1.Field)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AuditPeriodInput.prototype, "periodEnd", void 0);
exports.AuditPeriodInput = AuditPeriodInput = __decorate([
    (0, graphql_1.InputType)()
], AuditPeriodInput);
let StaffInvestigationInput = class StaffInvestigationInput {
};
exports.StaffInvestigationInput = StaffInvestigationInput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], StaffInvestigationInput.prototype, "userId", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], StaffInvestigationInput.prototype, "fromDate", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], StaffInvestigationInput.prototype, "toDate", void 0);
exports.StaffInvestigationInput = StaffInvestigationInput = __decorate([
    (0, graphql_1.InputType)()
], StaffInvestigationInput);
let AuditFinding = class AuditFinding {
};
exports.AuditFinding = AuditFinding;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], AuditFinding.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'CRITICAL | HIGH | MEDIUM | LOW | INFO — ' +
            'CRITICAL = regulatory violation or fraud signal, HIGH = financial risk, ' +
            'MEDIUM = process gap, LOW = best-practice deviation, INFO = observation',
    }),
    __metadata("design:type", String)
], AuditFinding.prototype, "severity", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'FRAUD | REGULATORY | FINANCIAL | OPERATIONAL | STAFF | INVENTORY | TAX | DISPENSING | DATA_INTEGRITY',
    }),
    __metadata("design:type", String)
], AuditFinding.prototype, "category", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Short title of the finding' }),
    __metadata("design:type", String)
], AuditFinding.prototype, "title", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Detailed description of what was found and why it matters' }),
    __metadata("design:type", String)
], AuditFinding.prototype, "description", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Specific Ghana law, FDA rule, or GRA regulation breached (if applicable)', nullable: true }),
    __metadata("design:type", String)
], AuditFinding.prototype, "regulatoryReference", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Concrete recommended action to remediate this finding' }),
    __metadata("design:type", String)
], AuditFinding.prototype, "recommendation", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { nullable: true, description: 'Estimated financial impact in GHS pesewas' }),
    __metadata("design:type", Number)
], AuditFinding.prototype, "financialImpactPesewas", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], AuditFinding.prototype, "financialImpactFormatted", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'User ID implicated (no name — Ghana DPA 2012)' }),
    __metadata("design:type", String)
], AuditFinding.prototype, "implicatedUserId", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Entity type involved (sale, product, prescription, etc.)' }),
    __metadata("design:type", String)
], AuditFinding.prototype, "entityType", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Entity ID involved' }),
    __metadata("design:type", String)
], AuditFinding.prototype, "entityId", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'ISO timestamp when this finding was detected' }),
    __metadata("design:type", Date)
], AuditFinding.prototype, "detectedAt", void 0);
exports.AuditFinding = AuditFinding = __decorate([
    (0, graphql_1.ObjectType)({ description: 'A single audit finding — the atomic unit of every report' })
], AuditFinding);
let StaffBehaviourAnomaly = class StaffBehaviourAnomaly {
};
exports.StaffBehaviourAnomaly = StaffBehaviourAnomaly;
__decorate([
    (0, graphql_1.Field)({ description: 'VOID_ABUSE | DISCOUNT_ABUSE | AFTER_HOURS | SPEED_ANOMALY | REFUND_PATTERN | CASH_DISCREPANCY | POM_BYPASS_ATTEMPT | IDLE_SESSION | BULK_DELETION' }),
    __metadata("design:type", String)
], StaffBehaviourAnomaly.prototype, "anomalyType", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], StaffBehaviourAnomaly.prototype, "description", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], StaffBehaviourAnomaly.prototype, "occurrenceCount", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", Date)
], StaffBehaviourAnomaly.prototype, "firstSeen", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", Date)
], StaffBehaviourAnomaly.prototype, "lastSeen", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Deviation from branch average (standard deviations)' }),
    __metadata("design:type", Number)
], StaffBehaviourAnomaly.prototype, "deviationSigma", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'LOW | MEDIUM | HIGH — risk level of this anomaly' }),
    __metadata("design:type", String)
], StaffBehaviourAnomaly.prototype, "riskLevel", void 0);
exports.StaffBehaviourAnomaly = StaffBehaviourAnomaly = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Behavioural anomaly detected for a staff member' })
], StaffBehaviourAnomaly);
let StaffBehaviourProfile = class StaffBehaviourProfile {
};
exports.StaffBehaviourProfile = StaffBehaviourProfile;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], StaffBehaviourProfile.prototype, "userId", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], StaffBehaviourProfile.prototype, "role", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], StaffBehaviourProfile.prototype, "branchName", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], StaffBehaviourProfile.prototype, "totalSalesCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], StaffBehaviourProfile.prototype, "totalRevenuePesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], StaffBehaviourProfile.prototype, "totalRevenueFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float),
    __metadata("design:type", Number)
], StaffBehaviourProfile.prototype, "avgSaleValueGhs", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], StaffBehaviourProfile.prototype, "voidCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], StaffBehaviourProfile.prototype, "refundCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], StaffBehaviourProfile.prototype, "discountCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], StaffBehaviourProfile.prototype, "pomAttemptBlockCount", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Most active hour of day (e.g. "14:00–15:00")' }),
    __metadata("design:type", String)
], StaffBehaviourProfile.prototype, "peakActivityHour", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], StaffBehaviourProfile.prototype, "afterHoursTransactionCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Avg seconds between sale items — very low = suspicious speed' }),
    __metadata("design:type", Number)
], StaffBehaviourProfile.prototype, "avgItemScanSpeedSeconds", void 0);
__decorate([
    (0, graphql_1.Field)(() => [StaffBehaviourAnomaly]),
    __metadata("design:type", Array)
], StaffBehaviourProfile.prototype, "anomalies", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'CLEAN | WATCH | INVESTIGATE | ESCALATE' }),
    __metadata("design:type", String)
], StaffBehaviourProfile.prototype, "riskRating", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Risk score 0–100' }),
    __metadata("design:type", Number)
], StaffBehaviourProfile.prototype, "riskScore", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Plain-English summary of the staff member\'s risk profile' }),
    __metadata("design:type", String)
], StaffBehaviourProfile.prototype, "summary", void 0);
exports.StaffBehaviourProfile = StaffBehaviourProfile = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Full behavioural profile of a staff member — the internal spy report' })
], StaffBehaviourProfile);
let DispensingComplianceAudit = class DispensingComplianceAudit {
};
exports.DispensingComplianceAudit = DispensingComplianceAudit;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], DispensingComplianceAudit.prototype, "pomSalesWithoutRxCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], DispensingComplianceAudit.prototype, "pomSalesWithoutRxValuePesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], DispensingComplianceAudit.prototype, "pomSalesWithoutRxFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], DispensingComplianceAudit.prototype, "expiredRxDispensedCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], DispensingComplianceAudit.prototype, "controlledDrugSingleSignoffCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], DispensingComplianceAudit.prototype, "chemicalShopPomAttemptCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], DispensingComplianceAudit.prototype, "rxWithoutGmdcValidationCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], DispensingComplianceAudit.prototype, "rxWithExpiredGmdcLicenceCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], DispensingComplianceAudit.prototype, "rxMissingPdfCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float),
    __metadata("design:type", Number)
], DispensingComplianceAudit.prototype, "rxPdfCompliancePct", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], DispensingComplianceAudit.prototype, "majorInteractionOverrideCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], DispensingComplianceAudit.prototype, "contraindicatedAttemptCount", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'COMPLIANT | MINOR_GAPS | MAJOR_VIOLATIONS | CRITICAL_VIOLATIONS' }),
    __metadata("design:type", String)
], DispensingComplianceAudit.prototype, "overallStatus", void 0);
__decorate([
    (0, graphql_1.Field)(() => [AuditFinding]),
    __metadata("design:type", Array)
], DispensingComplianceAudit.prototype, "findings", void 0);
exports.DispensingComplianceAudit = DispensingComplianceAudit = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Ghana FDA dispensing compliance audit result' })
], DispensingComplianceAudit);
let FinancialIntegrityAudit = class FinancialIntegrityAudit {
};
exports.FinancialIntegrityAudit = FinancialIntegrityAudit;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], FinancialIntegrityAudit.prototype, "expectedRevenuePesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], FinancialIntegrityAudit.prototype, "expectedRevenueFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], FinancialIntegrityAudit.prototype, "recordedRevenuePesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], FinancialIntegrityAudit.prototype, "recordedRevenueFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], FinancialIntegrityAudit.prototype, "revenueDiscrepancyPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], FinancialIntegrityAudit.prototype, "revenueDiscrepancyFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], FinancialIntegrityAudit.prototype, "totalVoidsPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], FinancialIntegrityAudit.prototype, "totalVoidsFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float),
    __metadata("design:type", Number)
], FinancialIntegrityAudit.prototype, "voidRatePct", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Benchmark: < 2%. Above 5% = investigate' }),
    __metadata("design:type", String)
], FinancialIntegrityAudit.prototype, "voidBenchmarkStatus", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], FinancialIntegrityAudit.prototype, "totalRefundsPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], FinancialIntegrityAudit.prototype, "totalRefundsFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float),
    __metadata("design:type", Number)
], FinancialIntegrityAudit.prototype, "refundRatePct", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], FinancialIntegrityAudit.prototype, "cashSalesPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], FinancialIntegrityAudit.prototype, "momoSalesPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float),
    __metadata("design:type", Number)
], FinancialIntegrityAudit.prototype, "cashToMomoRatio", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Unusual cash dominance may indicate MoMo fee avoidance or under-reporting' }),
    __metadata("design:type", Boolean)
], FinancialIntegrityAudit.prototype, "cashDominanceFlag", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], FinancialIntegrityAudit.prototype, "unmatchedInvoiceCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], FinancialIntegrityAudit.prototype, "unmatchedInvoiceValuePesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], FinancialIntegrityAudit.prototype, "unmatchedInvoiceFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], FinancialIntegrityAudit.prototype, "duplicateInvoiceCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], FinancialIntegrityAudit.prototype, "invoicesWithoutGrnCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], FinancialIntegrityAudit.prototype, "expensesWithoutReceiptCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], FinancialIntegrityAudit.prototype, "expensesWithoutReceiptValuePesewas", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], FinancialIntegrityAudit.prototype, "roundNumberExpenseCount", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Round-number expenses (e.g. exactly GH₵500) are a fraud signal' }),
    __metadata("design:type", Boolean)
], FinancialIntegrityAudit.prototype, "roundNumberExpenseFlag", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], FinancialIntegrityAudit.prototype, "unbalancedGlEntriesCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], FinancialIntegrityAudit.prototype, "glEntriesWithoutReferenceCount", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'CLEAN | ANOMALIES_DETECTED | FRAUD_SIGNALS | CRITICAL_BREACH' }),
    __metadata("design:type", String)
], FinancialIntegrityAudit.prototype, "integrityStatus", void 0);
__decorate([
    (0, graphql_1.Field)(() => [AuditFinding]),
    __metadata("design:type", Array)
], FinancialIntegrityAudit.prototype, "findings", void 0);
exports.FinancialIntegrityAudit = FinancialIntegrityAudit = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Financial integrity audit — detects fraud, leakage, and irregularities' })
], FinancialIntegrityAudit);
let InventoryIntegrityAudit = class InventoryIntegrityAudit {
};
exports.InventoryIntegrityAudit = InventoryIntegrityAudit;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], InventoryIntegrityAudit.prototype, "totalAdjustmentCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], InventoryIntegrityAudit.prototype, "negativeAdjustmentCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], InventoryIntegrityAudit.prototype, "negativeAdjustmentValuePesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], InventoryIntegrityAudit.prototype, "negativeAdjustmentFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Shrinkage rate % — benchmark < 1% for pharmacy' }),
    __metadata("design:type", Number)
], InventoryIntegrityAudit.prototype, "shrinkageRatePct", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'ACCEPTABLE | ELEVATED | CRITICAL' }),
    __metadata("design:type", String)
], InventoryIntegrityAudit.prototype, "shrinkageStatus", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], InventoryIntegrityAudit.prototype, "phantomStockSalesCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], InventoryIntegrityAudit.prototype, "phantomStockValuePesewas", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], InventoryIntegrityAudit.prototype, "expiredStockDispensedCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], InventoryIntegrityAudit.prototype, "nearExpiryNotFlaggedCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], InventoryIntegrityAudit.prototype, "grnWithoutInvoiceCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], InventoryIntegrityAudit.prototype, "stockReceivedNotInGrnCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], InventoryIntegrityAudit.prototype, "highValueAdjustmentByOneUserCount", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'CLEAN | WATCH | INVESTIGATE | CRITICAL' }),
    __metadata("design:type", String)
], InventoryIntegrityAudit.prototype, "integrityStatus", void 0);
__decorate([
    (0, graphql_1.Field)(() => [AuditFinding]),
    __metadata("design:type", Array)
], InventoryIntegrityAudit.prototype, "findings", void 0);
exports.InventoryIntegrityAudit = InventoryIntegrityAudit = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Inventory integrity audit — detects theft, shrinkage, and stock manipulation' })
], InventoryIntegrityAudit);
let TaxComplianceAudit = class TaxComplianceAudit {
};
exports.TaxComplianceAudit = TaxComplianceAudit;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], TaxComplianceAudit.prototype, "vatCollectedPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], TaxComplianceAudit.prototype, "vatCollectedFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], TaxComplianceAudit.prototype, "vatRemittedPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], TaxComplianceAudit.prototype, "vatRemittedFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], TaxComplianceAudit.prototype, "vatGapPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], TaxComplianceAudit.prototype, "vatGapFormatted", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'FILED | PENDING | OVERDUE | NEVER_FILED' }),
    __metadata("design:type", String)
], TaxComplianceAudit.prototype, "vatFilingStatus", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], TaxComplianceAudit.prototype, "exemptSalesWithoutRxCount", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Claiming VAT exemption on non-Rx sales is a GRA violation' }),
    __metadata("design:type", Boolean)
], TaxComplianceAudit.prototype, "exemptionAbuseFlag", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], TaxComplianceAudit.prototype, "staffOnPayrollCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], TaxComplianceAudit.prototype, "staffWithPayeDeductionCount", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Staff paid without PAYE deduction is a GRA violation' }),
    __metadata("design:type", Boolean)
], TaxComplianceAudit.prototype, "payeComplianceFlag", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], TaxComplianceAudit.prototype, "supplierPaymentsAboveThresholdCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], TaxComplianceAudit.prototype, "supplierPaymentsWithoutWhtCount", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'COMPLIANT | MINOR_GAPS | MAJOR_VIOLATIONS | CRITICAL' }),
    __metadata("design:type", String)
], TaxComplianceAudit.prototype, "overallTaxStatus", void 0);
__decorate([
    (0, graphql_1.Field)(() => [AuditFinding]),
    __metadata("design:type", Array)
], TaxComplianceAudit.prototype, "findings", void 0);
exports.TaxComplianceAudit = TaxComplianceAudit = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Ghana GRA tax compliance audit — VAT, PAYE, withholding tax' })
], TaxComplianceAudit);
let LicenceComplianceAudit = class LicenceComplianceAudit {
};
exports.LicenceComplianceAudit = LicenceComplianceAudit;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], LicenceComplianceAudit.prototype, "pharmacistsWithExpiredLicenceCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], LicenceComplianceAudit.prototype, "pharmacistsWithNoLicenceCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], LicenceComplianceAudit.prototype, "licencesExpiringIn30DaysCount", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Whether the branch has a valid HeFRA operating licence on file' }),
    __metadata("design:type", Boolean)
], LicenceComplianceAudit.prototype, "branchLicenceOnFile", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], LicenceComplianceAudit.prototype, "branchLicenceExpiryDate", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'VALID | EXPIRING_SOON | EXPIRED | NOT_ON_FILE' }),
    __metadata("design:type", String)
], LicenceComplianceAudit.prototype, "branchLicenceStatus", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Ghana FDA requires a physical controlled drug register' }),
    __metadata("design:type", Boolean)
], LicenceComplianceAudit.prototype, "controlledDrugRegisterCompliant", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], LicenceComplianceAudit.prototype, "controlledDrugDispensedWithoutDoubleSignoffCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], LicenceComplianceAudit.prototype, "coldChainProductsWithoutTempLogCount", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'COMPLIANT | MINOR_GAPS | MAJOR_VIOLATIONS | CRITICAL' }),
    __metadata("design:type", String)
], LicenceComplianceAudit.prototype, "overallStatus", void 0);
__decorate([
    (0, graphql_1.Field)(() => [AuditFinding]),
    __metadata("design:type", Array)
], LicenceComplianceAudit.prototype, "findings", void 0);
exports.LicenceComplianceAudit = LicenceComplianceAudit = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Licence and regulatory compliance status — Ghana FDA, HeFRA, Pharmacy Council' })
], LicenceComplianceAudit);
let RiskMatrixEntry = class RiskMatrixEntry {
};
exports.RiskMatrixEntry = RiskMatrixEntry;
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], RiskMatrixEntry.prototype, "riskTitle", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'FRAUD | REGULATORY | FINANCIAL | OPERATIONAL | REPUTATIONAL' }),
    __metadata("design:type", String)
], RiskMatrixEntry.prototype, "riskType", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'LOW | MEDIUM | HIGH | CRITICAL' }),
    __metadata("design:type", String)
], RiskMatrixEntry.prototype, "likelihood", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'LOW | MEDIUM | HIGH | CRITICAL' }),
    __metadata("design:type", String)
], RiskMatrixEntry.prototype, "impact", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'LOW | MEDIUM | HIGH | CRITICAL — combined risk rating' }),
    __metadata("design:type", String)
], RiskMatrixEntry.prototype, "inherentRisk", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], RiskMatrixEntry.prototype, "mitigationStatus", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], RiskMatrixEntry.prototype, "recommendedControl", void 0);
exports.RiskMatrixEntry = RiskMatrixEntry = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Risk matrix entry — probability vs impact' })
], RiskMatrixEntry);
let InternalAuditReport = class InternalAuditReport {
};
exports.InternalAuditReport = InternalAuditReport;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], InternalAuditReport.prototype, "reportId", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Date)
], InternalAuditReport.prototype, "generatedAt", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], InternalAuditReport.prototype, "branchName", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], InternalAuditReport.prototype, "auditPeriod", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], InternalAuditReport.prototype, "auditedBy", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Overall risk score 0–100 (100 = maximum risk)' }),
    __metadata("design:type", Number)
], InternalAuditReport.prototype, "overallRiskScore", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'LOW | MEDIUM | HIGH | CRITICAL' }),
    __metadata("design:type", String)
], InternalAuditReport.prototype, "overallRiskRating", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], InternalAuditReport.prototype, "criticalFindingsCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], InternalAuditReport.prototype, "highFindingsCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], InternalAuditReport.prototype, "totalFindingsCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Total estimated financial exposure in pesewas' }),
    __metadata("design:type", Number)
], InternalAuditReport.prototype, "totalFinancialExposurePesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], InternalAuditReport.prototype, "totalFinancialExposureFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => DispensingComplianceAudit),
    __metadata("design:type", DispensingComplianceAudit)
], InternalAuditReport.prototype, "dispensingCompliance", void 0);
__decorate([
    (0, graphql_1.Field)(() => FinancialIntegrityAudit),
    __metadata("design:type", FinancialIntegrityAudit)
], InternalAuditReport.prototype, "financialIntegrity", void 0);
__decorate([
    (0, graphql_1.Field)(() => InventoryIntegrityAudit),
    __metadata("design:type", InventoryIntegrityAudit)
], InternalAuditReport.prototype, "inventoryIntegrity", void 0);
__decorate([
    (0, graphql_1.Field)(() => TaxComplianceAudit),
    __metadata("design:type", TaxComplianceAudit)
], InternalAuditReport.prototype, "taxCompliance", void 0);
__decorate([
    (0, graphql_1.Field)(() => LicenceComplianceAudit),
    __metadata("design:type", LicenceComplianceAudit)
], InternalAuditReport.prototype, "licenceCompliance", void 0);
__decorate([
    (0, graphql_1.Field)(() => [StaffBehaviourProfile], { description: 'Behavioural profiles for all active staff — ranked by risk score' }),
    __metadata("design:type", Array)
], InternalAuditReport.prototype, "staffProfiles", void 0);
__decorate([
    (0, graphql_1.Field)(() => [RiskMatrixEntry]),
    __metadata("design:type", Array)
], InternalAuditReport.prototype, "riskMatrix", void 0);
__decorate([
    (0, graphql_1.Field)(() => [AuditFinding], { description: 'All findings across all sections, sorted by severity' }),
    __metadata("design:type", Array)
], InternalAuditReport.prototype, "allFindings", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'UNQUALIFIED | QUALIFIED | ADVERSE | DISCLAIMER — auditor\'s opinion on the period' }),
    __metadata("design:type", String)
], InternalAuditReport.prototype, "auditorOpinion", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Plain-English audit opinion narrative' }),
    __metadata("design:type", String)
], InternalAuditReport.prototype, "opinionNarrative", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Prioritised action plan — what the owner must do this week' }),
    __metadata("design:type", String)
], InternalAuditReport.prototype, "immediateActionPlan", void 0);
exports.InternalAuditReport = InternalAuditReport = __decorate([
    (0, graphql_1.ObjectType)({
        description: 'The complete internal audit report — financial police, compliance watchdog, and staff monitor. ' +
            'Covers Ghana FDA dispensing compliance, GRA tax compliance, financial integrity, ' +
            'inventory integrity, licence compliance, staff behaviour profiling, and risk matrix.',
    })
], InternalAuditReport);
//# sourceMappingURL=audit.types.js.map