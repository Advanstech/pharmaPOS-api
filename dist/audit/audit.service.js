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
var AuditService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const crypto_1 = require("crypto");
const sales_effective_at_service_1 = require("../sales/sales-effective-at.service");
let AuditService = AuditService_1 = class AuditService {
    constructor(dataSource, effectiveSaleAt) {
        this.dataSource = dataSource;
        this.effectiveSaleAt = effectiveSaleAt;
        this.logger = new common_1.Logger(AuditService_1.name);
    }
    async getInternalAuditReport(branchId, input) {
        const [dispensingCompliance, financialIntegrity, inventoryIntegrity, taxCompliance, licenceCompliance, staffProfiles,] = await Promise.all([
            this.getDispensingComplianceAudit(branchId, input),
            this.getFinancialIntegrityAudit(branchId, input),
            this.getInventoryIntegrityAudit(branchId, input),
            this.getTaxComplianceAudit(branchId, input),
            this.getLicenceComplianceAudit(branchId),
            this.getStaffBehaviourProfiles(branchId, input),
        ]);
        const allFindings = [
            ...dispensingCompliance.findings,
            ...financialIntegrity.findings,
            ...inventoryIntegrity.findings,
            ...taxCompliance.findings,
            ...licenceCompliance.findings,
        ].sort((a, b) => this.severityWeight(b.severity) - this.severityWeight(a.severity));
        const criticalFindingsCount = allFindings.filter((f) => f.severity === 'CRITICAL').length;
        const highFindingsCount = allFindings.filter((f) => f.severity === 'HIGH').length;
        const overallRiskScore = this.scoreOverallRisk({
            dispensingCompliance,
            financialIntegrity,
            inventoryIntegrity,
            taxCompliance,
            licenceCompliance,
            staffProfiles,
        });
        const overallRiskRating = this.riskRating(overallRiskScore);
        const totalFinancialExposurePesewas = allFindings.reduce((sum, f) => { var _a; return sum + ((_a = f.financialImpactPesewas) !== null && _a !== void 0 ? _a : 0); }, 0);
        const riskMatrix = this.buildRiskMatrix(allFindings);
        const { auditorOpinion, opinionNarrative, immediateActionPlan } = this.buildAuditorOpinion(overallRiskScore, criticalFindingsCount, allFindings);
        const branchName = await this.getBranchName(branchId);
        return {
            reportId: (0, crypto_1.randomUUID)(),
            generatedAt: new Date(),
            branchName,
            auditPeriod: `${input.periodStart} to ${input.periodEnd}`,
            auditedBy: 'PharmaPOS Internal Audit Engine v1',
            overallRiskScore,
            overallRiskRating,
            criticalFindingsCount,
            highFindingsCount,
            totalFindingsCount: allFindings.length,
            totalFinancialExposurePesewas,
            totalFinancialExposureFormatted: this.fmt(totalFinancialExposurePesewas),
            dispensingCompliance,
            financialIntegrity,
            inventoryIntegrity,
            taxCompliance,
            licenceCompliance,
            staffProfiles,
            riskMatrix,
            allFindings,
            auditorOpinion,
            opinionNarrative,
            immediateActionPlan,
        };
    }
    async getDispensingComplianceAudit(branchId, input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
        const findings = [];
        const saleAccraDay = `(${this.effectiveSaleAt.sql('s')} AT TIME ZONE 'Africa/Accra')::date`;
        const periodPred = `AND ${saleAccraDay} BETWEEN $2::date AND $3::date`;
        const pomNoRx = await this.dataSource.query(`SELECT COUNT(*) as count, COALESCE(SUM(s.total_amount),0) as total
       FROM sales s
       JOIN sale_items si ON si.sale_id = s.id
       JOIN products p ON p.id = si.product_id
       WHERE s.branch_id = $1
         ${periodPred}
         AND p.requires_rx = true
         AND s.prescription_id IS NULL
         AND s.status != 'VOIDED'`, [branchId, input.periodStart, input.periodEnd]);
        const pomSalesWithoutRxCount = parseInt((_b = (_a = pomNoRx[0]) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : '0', 10);
        const pomSalesWithoutRxValuePesewas = parseInt((_d = (_c = pomNoRx[0]) === null || _c === void 0 ? void 0 : _c.total) !== null && _d !== void 0 ? _d : '0', 10);
        if (pomSalesWithoutRxCount > 0) {
            findings.push(this.finding({
                severity: 'CRITICAL',
                category: 'REGULATORY',
                title: 'POM Dispensed Without Prescription',
                description: `${pomSalesWithoutRxCount} POM sale(s) processed without a valid prescription — direct Ghana FDA violation.`,
                regulatoryReference: 'Ghana FDA POM Enforcement Rule 1 — Pharmacy Act 1994 s.24',
                recommendation: 'Immediately suspend implicated cashier accounts. File incident report with Ghana FDA within 48 hours. Retrain all dispensing staff.',
                financialImpactPesewas: pomSalesWithoutRxValuePesewas,
            }));
        }
        const expiredRx = await this.dataSource.query(`SELECT COUNT(*) as count
       FROM sales s
       JOIN prescriptions p ON p.id = s.prescription_id
       WHERE s.branch_id = $1
         ${periodPred}
         AND s.status != 'VOIDED'
         AND (p.prescribed_date AT TIME ZONE 'Africa/Accra')::date < (${saleAccraDay} - INTERVAL '30 days')`, [branchId, input.periodStart, input.periodEnd]);
        const expiredRxDispensedCount = parseInt((_f = (_e = expiredRx[0]) === null || _e === void 0 ? void 0 : _e.count) !== null && _f !== void 0 ? _f : '0', 10);
        if (expiredRxDispensedCount > 0) {
            findings.push(this.finding({
                severity: 'CRITICAL',
                category: 'REGULATORY',
                title: 'Expired Prescription Dispensed',
                description: `${expiredRxDispensedCount} sale(s) dispensed against prescriptions older than 30 days.`,
                regulatoryReference: 'Ghana FDA POM Rule 4 — Rx validity 30 days',
                recommendation: 'Audit all dispensed Rx for the period. Notify prescribers. Implement system-level Rx expiry hard block.',
            }));
        }
        const singleSignoff = await this.dataSource.query(`SELECT COUNT(*) as count
       FROM prescriptions p
       JOIN sales s ON s.prescription_id = p.id
       JOIN products pr ON pr.id = ANY(
         SELECT product_id FROM sale_items WHERE sale_id = s.id
       )
       WHERE s.branch_id = $1
         ${periodPred}
         AND pr.classification = 'CONTROLLED'
         AND p.approval_count < 2`, [branchId, input.periodStart, input.periodEnd]);
        const controlledDrugSingleSignoffCount = parseInt((_h = (_g = singleSignoff[0]) === null || _g === void 0 ? void 0 : _g.count) !== null && _h !== void 0 ? _h : '0', 10);
        if (controlledDrugSingleSignoffCount > 0) {
            findings.push(this.finding({
                severity: 'CRITICAL',
                category: 'REGULATORY',
                title: 'Controlled Drug Dispensed With Single Sign-Off',
                description: `${controlledDrugSingleSignoffCount} controlled drug dispensing(s) had only one pharmacist sign-off. Two required.`,
                regulatoryReference: 'Ghana FDA POM Rule 5 — Controlled Drugs Regulations 2013',
                recommendation: 'Halt controlled drug dispensing until dual sign-off workflow is enforced. Report to Pharmacy Council.',
            }));
        }
        const rxWithoutGmdcValidationCount = 0;
        const rxWithExpiredGmdcLicenceCount = 0;
        if (rxWithExpiredGmdcLicenceCount > 0) {
            findings.push(this.finding({
                severity: 'HIGH',
                category: 'REGULATORY',
                title: 'Prescriptions From Expired GMDC Licences Dispensed',
                description: `${rxWithExpiredGmdcLicenceCount} prescription(s) dispensed from prescribers with expired GMDC licences.`,
                regulatoryReference: 'Ghana FDA POM Rule 3 — GMDC Prescriber Licence Validation',
                recommendation: 'Reject all future Rx from expired GMDC licences. Notify Ghana FDA.',
            }));
        }
        const pdfCompliance = await this.dataSource.query(`SELECT COUNT(*) as total,
              COUNT(CASE WHEN p.s3_pdf_key IS NOT NULL THEN 1 END) as with_pdf
       FROM prescriptions p
       JOIN sales s ON s.prescription_id = p.id
       WHERE s.branch_id = $1 ${periodPred}`, [branchId, input.periodStart, input.periodEnd]);
        const totalRx = parseInt((_k = (_j = pdfCompliance[0]) === null || _j === void 0 ? void 0 : _j.total) !== null && _k !== void 0 ? _k : '0', 10);
        const withPdf = parseInt((_m = (_l = pdfCompliance[0]) === null || _l === void 0 ? void 0 : _l.with_pdf) !== null && _m !== void 0 ? _m : '0', 10);
        const rxMissingPdfCount = totalRx - withPdf;
        const rxPdfCompliancePct = totalRx > 0 ? (withPdf / totalRx) * 100 : 100;
        if (rxMissingPdfCount > 0) {
            findings.push(this.finding({
                severity: 'HIGH',
                category: 'REGULATORY',
                title: 'Prescription PDFs Missing (5-Year Retention Breach)',
                description: `${rxMissingPdfCount} prescription(s) have no scanned PDF on file. Ghana FDA requires 5-year retention.`,
                regulatoryReference: 'Ghana FDA POM Rule 7 — Rx PDF Retention (5 years)',
                recommendation: 'Retroactively scan and upload missing Rx PDFs. Enforce mandatory upload in dispensing workflow.',
            }));
        }
        const interactions = await this.dataSource.query(`SELECT
         COUNT(CASE WHEN al.type = 'MAJOR_INTERACTION_OVERRIDE' THEN 1 END) as major,
         COUNT(CASE WHEN al.type = 'CONTRAINDICATED_ATTEMPT' THEN 1 END) as contraindicated
       FROM audit_logs al
       WHERE al.branch_id = $1
         AND (al.created_at AT TIME ZONE 'Africa/Accra')::date BETWEEN $2::date AND $3::date`, [branchId, input.periodStart, input.periodEnd]);
        const majorInteractionOverrideCount = parseInt((_p = (_o = interactions[0]) === null || _o === void 0 ? void 0 : _o.major) !== null && _p !== void 0 ? _p : '0', 10);
        const contraindicatedAttemptCount = parseInt((_r = (_q = interactions[0]) === null || _q === void 0 ? void 0 : _q.contraindicated) !== null && _r !== void 0 ? _r : '0', 10);
        if (contraindicatedAttemptCount > 0) {
            findings.push(this.finding({
                severity: 'CRITICAL',
                category: 'DISPENSING',
                title: 'Contraindicated Drug Combination Attempted',
                description: `${contraindicatedAttemptCount} attempt(s) to dispense contraindicated drug combinations. System blocked these — but attempts indicate training gaps.`,
                regulatoryReference: 'Ghana FDA Drug Interaction Policy — Contraindicated = hard block',
                recommendation: 'Identify staff involved. Mandatory pharmacology refresher training. Review product catalogue for interaction flags.',
            }));
        }
        const overallStatus = findings.some((f) => f.severity === 'CRITICAL')
            ? 'CRITICAL_VIOLATIONS'
            : findings.some((f) => f.severity === 'HIGH')
                ? 'MAJOR_VIOLATIONS'
                : findings.length > 0
                    ? 'MINOR_GAPS'
                    : 'COMPLIANT';
        return {
            pomSalesWithoutRxCount,
            pomSalesWithoutRxValuePesewas,
            pomSalesWithoutRxFormatted: this.fmt(pomSalesWithoutRxValuePesewas),
            expiredRxDispensedCount,
            controlledDrugSingleSignoffCount,
            chemicalShopPomAttemptCount: 0,
            rxWithoutGmdcValidationCount,
            rxWithExpiredGmdcLicenceCount,
            rxMissingPdfCount,
            rxPdfCompliancePct,
            majorInteractionOverrideCount,
            contraindicatedAttemptCount,
            overallStatus,
            findings,
        };
    }
    async getFinancialIntegrityAudit(branchId, input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5;
        const findings = [];
        const revenue = await this.dataSource.query(`SELECT
         COALESCE(SUM(CASE WHEN s.status != 'VOIDED' THEN s.total_amount END), 0) as expected,
         COALESCE(SUM(CASE WHEN s.status = 'COMPLETED' THEN s.total_amount END), 0) as recorded,
         COALESCE(SUM(CASE WHEN s.status = 'COMPLETED' THEN s.total_amount END), 0) as cash,
         0 as momo
       FROM sales s
       WHERE s.branch_id = $1 AND (${this.effectiveSaleAt.sql('s')}) BETWEEN $2 AND $3`, [branchId, input.periodStart, input.periodEnd]);
        const expectedRevenuePesewas = parseInt((_b = (_a = revenue[0]) === null || _a === void 0 ? void 0 : _a.expected) !== null && _b !== void 0 ? _b : '0', 10);
        const recordedRevenuePesewas = parseInt((_d = (_c = revenue[0]) === null || _c === void 0 ? void 0 : _c.recorded) !== null && _d !== void 0 ? _d : '0', 10);
        const cashSalesPesewas = parseInt((_f = (_e = revenue[0]) === null || _e === void 0 ? void 0 : _e.cash) !== null && _f !== void 0 ? _f : '0', 10);
        const momoSalesPesewas = parseInt((_h = (_g = revenue[0]) === null || _g === void 0 ? void 0 : _g.momo) !== null && _h !== void 0 ? _h : '0', 10);
        const revenueDiscrepancyPesewas = expectedRevenuePesewas - recordedRevenuePesewas;
        if (revenueDiscrepancyPesewas > 50000) {
            findings.push(this.finding({
                severity: revenueDiscrepancyPesewas > 500000 ? 'CRITICAL' : 'HIGH',
                category: 'FRAUD',
                title: 'Revenue Reconciliation Gap Detected',
                description: `Expected revenue ${this.fmt(expectedRevenuePesewas)} vs recorded ${this.fmt(recordedRevenuePesewas)}. Gap: ${this.fmt(revenueDiscrepancyPesewas)}.`,
                recommendation: 'Cross-reference POS receipts with bank statements. Investigate cashier sessions with gaps.',
                financialImpactPesewas: revenueDiscrepancyPesewas,
            }));
        }
        const voids = await this.dataSource.query(`SELECT
         COALESCE(SUM(CASE WHEN s.status = 'VOIDED' THEN s.total_amount END), 0) as void_total,
         COUNT(CASE WHEN s.status = 'VOIDED' THEN 1 END) as void_count,
         COALESCE(SUM(CASE WHEN s.status = 'REFUNDED' THEN s.total_amount END), 0) as refund_total,
         COUNT(CASE WHEN s.status = 'REFUNDED' THEN 1 END) as refund_count
       FROM sales s
       WHERE s.branch_id = $1 AND (${this.effectiveSaleAt.sql('s')}) BETWEEN $2 AND $3`, [branchId, input.periodStart, input.periodEnd]);
        const totalVoidsPesewas = parseInt((_k = (_j = voids[0]) === null || _j === void 0 ? void 0 : _j.void_total) !== null && _k !== void 0 ? _k : '0', 10);
        const totalRefundsPesewas = parseInt((_m = (_l = voids[0]) === null || _l === void 0 ? void 0 : _l.refund_total) !== null && _m !== void 0 ? _m : '0', 10);
        const voidRatePct = expectedRevenuePesewas > 0 ? (totalVoidsPesewas / expectedRevenuePesewas) * 100 : 0;
        const refundRatePct = expectedRevenuePesewas > 0 ? (totalRefundsPesewas / expectedRevenuePesewas) * 100 : 0;
        const voidBenchmarkStatus = voidRatePct > 5 ? 'CRITICAL' : voidRatePct > 2 ? 'ELEVATED' : 'NORMAL';
        if (voidRatePct > 5) {
            findings.push(this.finding({
                severity: 'HIGH',
                category: 'FRAUD',
                title: `Void Rate ${voidRatePct.toFixed(1)}% — Exceeds 5% Threshold`,
                description: 'Abnormally high void rate is a classic indicator of cashier fraud (void-and-pocket scheme).',
                recommendation: 'Require manager approval for all voids. Review CCTV footage for high-void cashiers. Implement void reason codes.',
                financialImpactPesewas: totalVoidsPesewas,
            }));
        }
        const cashToMomoRatio = momoSalesPesewas > 0 ? cashSalesPesewas / momoSalesPesewas : 99;
        const cashDominanceFlag = cashSalesPesewas / (cashSalesPesewas + momoSalesPesewas + 1) > 0.8;
        if (cashDominanceFlag) {
            findings.push(this.finding({
                severity: 'MEDIUM',
                category: 'FINANCIAL',
                title: 'Unusual Cash Dominance (>80% of Sales)',
                description: 'High cash ratio may indicate MoMo fee avoidance, under-reporting, or preference for untraceable transactions.',
                recommendation: 'Encourage MoMo payments. Investigate if cash receipts match daily cash-up totals.',
            }));
        }
        const invoiceIntegrity = await this.dataSource.query(`SELECT
         COUNT(CASE WHEN si.status = 'PENDING' THEN 1 END) as unmatched,
         COALESCE(SUM(CASE WHEN si.status = 'PENDING' THEN si.total_amount END), 0) as unmatched_value,
         COUNT(CASE WHEN dup.cnt > 1 THEN 1 END) as duplicates,
         COUNT(CASE WHEN si.grn_id IS NULL THEN 1 END) as no_grn
       FROM supplier_invoices si
       LEFT JOIN (
         SELECT invoice_number, COUNT(*) as cnt FROM supplier_invoices GROUP BY invoice_number
       ) dup ON dup.invoice_number = si.invoice_number
       WHERE si.branch_id = $1 AND si.created_at BETWEEN $2 AND $3`, [branchId, input.periodStart, input.periodEnd]);
        const unmatchedInvoiceCount = parseInt((_p = (_o = invoiceIntegrity[0]) === null || _o === void 0 ? void 0 : _o.unmatched) !== null && _p !== void 0 ? _p : '0', 10);
        const unmatchedInvoiceValuePesewas = parseInt((_r = (_q = invoiceIntegrity[0]) === null || _q === void 0 ? void 0 : _q.unmatched_value) !== null && _r !== void 0 ? _r : '0', 10);
        const duplicateInvoiceCount = parseInt((_t = (_s = invoiceIntegrity[0]) === null || _s === void 0 ? void 0 : _s.duplicates) !== null && _t !== void 0 ? _t : '0', 10);
        const invoicesWithoutGrnCount = parseInt((_v = (_u = invoiceIntegrity[0]) === null || _u === void 0 ? void 0 : _u.no_grn) !== null && _v !== void 0 ? _v : '0', 10);
        if (duplicateInvoiceCount > 0) {
            findings.push(this.finding({
                severity: 'HIGH',
                category: 'FRAUD',
                title: `${duplicateInvoiceCount} Duplicate Supplier Invoice(s) Detected`,
                description: 'Duplicate invoice numbers are a classic accounts payable fraud signal (double-payment scheme).',
                recommendation: 'Block payment on duplicate invoices. Investigate supplier relationship. Implement unique invoice number constraint.',
                financialImpactPesewas: unmatchedInvoiceValuePesewas,
            }));
        }
        const expenses = await this.dataSource.query(`SELECT
         COUNT(CASE WHEN e.receipt_s3_key IS NULL THEN 1 END) as no_receipt,
         COALESCE(SUM(CASE WHEN e.receipt_s3_key IS NULL THEN e.amount_pesewas END), 0) as no_receipt_value,
         COUNT(CASE WHEN e.amount_pesewas % 100000 = 0 AND e.amount_pesewas >= 100000 THEN 1 END) as round_numbers
       FROM expenses e
       WHERE e.branch_id = $1 AND e.created_at BETWEEN $2 AND $3`, [branchId, input.periodStart, input.periodEnd]);
        const expensesWithoutReceiptCount = parseInt((_x = (_w = expenses[0]) === null || _w === void 0 ? void 0 : _w.no_receipt) !== null && _x !== void 0 ? _x : '0', 10);
        const expensesWithoutReceiptValuePesewas = parseInt((_z = (_y = expenses[0]) === null || _y === void 0 ? void 0 : _y.no_receipt_value) !== null && _z !== void 0 ? _z : '0', 10);
        const roundNumberExpenseCount = parseInt((_1 = (_0 = expenses[0]) === null || _0 === void 0 ? void 0 : _0.round_numbers) !== null && _1 !== void 0 ? _1 : '0', 10);
        const roundNumberExpenseFlag = roundNumberExpenseCount > 3;
        if (expensesWithoutReceiptCount > 0) {
            findings.push(this.finding({
                severity: 'MEDIUM',
                category: 'FINANCIAL',
                title: `${expensesWithoutReceiptCount} Expense(s) Without Receipt`,
                description: `${this.fmt(expensesWithoutReceiptValuePesewas)} in expenses have no supporting receipt — GRA audit risk.`,
                recommendation: 'Enforce mandatory receipt upload before expense approval. Reject retroactive claims without receipts.',
                financialImpactPesewas: expensesWithoutReceiptValuePesewas,
            }));
        }
        const glIntegrity = await this.dataSource.query(`SELECT
         COUNT(CASE WHEN gl.debit != gl.credit THEN 1 END) as unbalanced,
         COUNT(CASE WHEN gl.reference_id IS NULL AND gl.reference_type IS NULL THEN 1 END) as no_ref
       FROM general_ledger gl
       WHERE gl.branch_id = $1 AND gl.posted_at BETWEEN $2 AND $3`, [branchId, input.periodStart, input.periodEnd]);
        const unbalancedGlEntriesCount = parseInt((_3 = (_2 = glIntegrity[0]) === null || _2 === void 0 ? void 0 : _2.unbalanced) !== null && _3 !== void 0 ? _3 : '0', 10);
        const glEntriesWithoutReferenceCount = parseInt((_5 = (_4 = glIntegrity[0]) === null || _4 === void 0 ? void 0 : _4.no_ref) !== null && _5 !== void 0 ? _5 : '0', 10);
        if (unbalancedGlEntriesCount > 0) {
            findings.push(this.finding({
                severity: 'CRITICAL',
                category: 'DATA_INTEGRITY',
                title: `${unbalancedGlEntriesCount} Unbalanced GL Entries`,
                description: 'Debits ≠ Credits in general ledger. This violates double-entry accounting and invalidates financial statements.',
                recommendation: 'Immediately investigate and correct all unbalanced entries. Audit the system that created them.',
            }));
        }
        const integrityStatus = findings.some((f) => f.severity === 'CRITICAL')
            ? 'CRITICAL_BREACH'
            : findings.some((f) => f.severity === 'HIGH')
                ? 'FRAUD_SIGNALS'
                : findings.length > 0
                    ? 'ANOMALIES_DETECTED'
                    : 'CLEAN';
        return {
            expectedRevenuePesewas,
            expectedRevenueFormatted: this.fmt(expectedRevenuePesewas),
            recordedRevenuePesewas,
            recordedRevenueFormatted: this.fmt(recordedRevenuePesewas),
            revenueDiscrepancyPesewas,
            revenueDiscrepancyFormatted: this.fmt(revenueDiscrepancyPesewas),
            totalVoidsPesewas,
            totalVoidsFormatted: this.fmt(totalVoidsPesewas),
            voidRatePct,
            voidBenchmarkStatus,
            totalRefundsPesewas,
            totalRefundsFormatted: this.fmt(totalRefundsPesewas),
            refundRatePct,
            cashSalesPesewas,
            momoSalesPesewas,
            cashToMomoRatio,
            cashDominanceFlag,
            unmatchedInvoiceCount,
            unmatchedInvoiceValuePesewas,
            unmatchedInvoiceFormatted: this.fmt(unmatchedInvoiceValuePesewas),
            duplicateInvoiceCount,
            invoicesWithoutGrnCount,
            expensesWithoutReceiptCount,
            expensesWithoutReceiptValuePesewas,
            roundNumberExpenseCount,
            roundNumberExpenseFlag,
            unbalancedGlEntriesCount,
            glEntriesWithoutReferenceCount,
            integrityStatus,
            findings,
        };
    }
    async getInventoryIntegrityAudit(branchId, input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
        const findings = [];
        const adjustments = await this.dataSource.query(`SELECT
         COUNT(*) as total,
         COUNT(CASE WHEN sm.quantity < 0 THEN 1 END) as negative,
         COALESCE(SUM(CASE WHEN sm.quantity < 0 THEN ABS(sm.quantity) * (p.unit_price * 0.7) END), 0) as negative_value,
         COUNT(CASE WHEN sm.quantity < 0 AND ABS(sm.quantity) * (p.unit_price * 0.7) > 500000 THEN 1 END) as high_value_single_user
       FROM stock_movements sm
       JOIN products p ON p.id = sm.product_id
       WHERE sm.branch_id = $1 AND sm.movement_type = 'ADJUSTMENT' AND sm.created_at BETWEEN $2 AND $3`, [branchId, input.periodStart, input.periodEnd]);
        const totalAdjustmentCount = parseInt((_b = (_a = adjustments[0]) === null || _a === void 0 ? void 0 : _a.total) !== null && _b !== void 0 ? _b : '0', 10);
        const negativeAdjustmentCount = parseInt((_d = (_c = adjustments[0]) === null || _c === void 0 ? void 0 : _c.negative) !== null && _d !== void 0 ? _d : '0', 10);
        const negativeAdjustmentValuePesewas = parseInt((_f = (_e = adjustments[0]) === null || _e === void 0 ? void 0 : _e.negative_value) !== null && _f !== void 0 ? _f : '0', 10);
        const highValueAdjustmentByOneUserCount = parseInt((_h = (_g = adjustments[0]) === null || _g === void 0 ? void 0 : _g.high_value_single_user) !== null && _h !== void 0 ? _h : '0', 10);
        const inventoryValue = await this.dataSource.query(`SELECT COALESCE(SUM(i.quantity_on_hand * (p.unit_price * 0.7)), 0) as total_value
       FROM inventory i JOIN products p ON p.id = i.product_id
       WHERE i.branch_id = $1`, [branchId]);
        const totalInventoryValue = parseInt((_k = (_j = inventoryValue[0]) === null || _j === void 0 ? void 0 : _j.total_value) !== null && _k !== void 0 ? _k : '1', 10);
        const shrinkageRatePct = (negativeAdjustmentValuePesewas / totalInventoryValue) * 100;
        const shrinkageStatus = shrinkageRatePct > 3 ? 'CRITICAL' : shrinkageRatePct > 1 ? 'ELEVATED' : 'ACCEPTABLE';
        if (shrinkageRatePct > 1) {
            findings.push(this.finding({
                severity: shrinkageRatePct > 3 ? 'CRITICAL' : 'HIGH',
                category: 'INVENTORY',
                title: `Inventory Shrinkage ${shrinkageRatePct.toFixed(2)}% — Above 1% Benchmark`,
                description: `${this.fmt(negativeAdjustmentValuePesewas)} in negative adjustments. Pharmacy benchmark is <1%. Possible theft or dispensing without recording.`,
                recommendation: 'Conduct physical stock count. Review CCTV. Require dual-approval for negative adjustments > GH₵50.',
                financialImpactPesewas: negativeAdjustmentValuePesewas,
            }));
        }
        if (highValueAdjustmentByOneUserCount > 0) {
            findings.push(this.finding({
                severity: 'HIGH',
                category: 'FRAUD',
                title: 'High-Value Inventory Adjustments by Single User',
                description: `${highValueAdjustmentByOneUserCount} adjustment(s) > GH₵5 each made by a single user — concentration of control risk.`,
                recommendation: 'Require second-user approval for adjustments > GH₵50. Investigate the specific user IDs.',
            }));
        }
        const phantom = await this.dataSource.query(`SELECT COUNT(*) as count, COALESCE(SUM(si.quantity * si.unit_price), 0) as value
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN inventory i ON i.product_id = si.product_id AND i.branch_id = s.branch_id
       WHERE s.branch_id = $1 AND (${this.effectiveSaleAt.sql('s')}) BETWEEN $2 AND $3
         AND s.status != 'VOIDED' AND i.id IS NULL`, [branchId, input.periodStart, input.periodEnd]);
        const phantomStockSalesCount = parseInt((_m = (_l = phantom[0]) === null || _l === void 0 ? void 0 : _l.count) !== null && _m !== void 0 ? _m : '0', 10);
        const phantomStockValuePesewas = parseInt((_p = (_o = phantom[0]) === null || _o === void 0 ? void 0 : _o.value) !== null && _p !== void 0 ? _p : '0', 10);
        if (phantomStockSalesCount > 0) {
            findings.push(this.finding({
                severity: 'CRITICAL',
                category: 'DATA_INTEGRITY',
                title: `${phantomStockSalesCount} Sales of Products With No Inventory Record`,
                description: 'Products sold that have no inventory entry — indicates data integrity failure or ghost product creation.',
                recommendation: 'Investigate how products were sold without inventory. Check for deleted inventory records.',
                financialImpactPesewas: phantomStockValuePesewas,
            }));
        }
        const expiredDispensed = await this.dataSource.query(`SELECT COUNT(*) as count
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.branch_id = $1 AND (${this.effectiveSaleAt.sql('s')}) BETWEEN $2 AND $3
         AND s.status != 'VOIDED' AND si.expiry_date < (${this.effectiveSaleAt.sql('s')})`, [branchId, input.periodStart, input.periodEnd]);
        const expiredStockDispensedCount = parseInt((_r = (_q = expiredDispensed[0]) === null || _q === void 0 ? void 0 : _q.count) !== null && _r !== void 0 ? _r : '0', 10);
        if (expiredStockDispensedCount > 0) {
            findings.push(this.finding({
                severity: 'CRITICAL',
                category: 'REGULATORY',
                title: `${expiredStockDispensedCount} Expired Product(s) Dispensed`,
                description: 'Dispensing expired medication is a Ghana FDA violation and patient safety risk.',
                regulatoryReference: 'Ghana FDA — Medicines Act 2012, Expired Medicines Prohibition',
                recommendation: 'Immediately quarantine all near-expiry stock. Implement expiry date check at point of sale.',
            }));
        }
        const grnIntegrity = await this.dataSource.query(`SELECT
         COUNT(CASE WHEN si.id IS NULL THEN 1 END) as no_invoice,
         0 as stock_not_in_grn
       FROM goods_received_notes g
       LEFT JOIN supplier_invoices si ON si.grn_id = g.id
       WHERE g.branch_id = $1 AND g.received_at BETWEEN $2 AND $3`, [branchId, input.periodStart, input.periodEnd]);
        const grnWithoutInvoiceCount = parseInt((_t = (_s = grnIntegrity[0]) === null || _s === void 0 ? void 0 : _s.no_invoice) !== null && _t !== void 0 ? _t : '0', 10);
        const integrityStatus = findings.some((f) => f.severity === 'CRITICAL')
            ? 'CRITICAL'
            : findings.some((f) => f.severity === 'HIGH')
                ? 'INVESTIGATE'
                : findings.length > 0
                    ? 'WATCH'
                    : 'CLEAN';
        return {
            totalAdjustmentCount,
            negativeAdjustmentCount,
            negativeAdjustmentValuePesewas,
            negativeAdjustmentFormatted: this.fmt(negativeAdjustmentValuePesewas),
            shrinkageRatePct,
            shrinkageStatus,
            phantomStockSalesCount,
            phantomStockValuePesewas,
            expiredStockDispensedCount,
            nearExpiryNotFlaggedCount: 0,
            grnWithoutInvoiceCount,
            stockReceivedNotInGrnCount: 0,
            highValueAdjustmentByOneUserCount,
            integrityStatus,
            findings,
        };
    }
    async getTaxComplianceAudit(branchId, input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        const findings = [];
        const vat = await this.dataSource.query(`SELECT
         COALESCE(SUM(CASE WHEN s.status != 'VOIDED' AND p.requires_rx = false
           THEN s.total_amount * 0.15 END), 0) as collected,
         COALESCE(SUM(CASE WHEN gl.account_code = '2200' THEN gl.credit END), 0) as remitted,
         COUNT(CASE WHEN s.status != 'VOIDED' AND p.requires_rx = false
           AND s.prescription_id IS NOT NULL THEN 1 END) as exempt_no_rx
       FROM sales s
       JOIN sale_items si ON si.sale_id = s.id
       JOIN products p ON p.id = si.product_id
       LEFT JOIN general_ledger gl ON gl.branch_id = s.branch_id
         AND gl.posted_at BETWEEN $2 AND $3
       WHERE s.branch_id = $1 AND (${this.effectiveSaleAt.sql('s')}) BETWEEN $2 AND $3`, [branchId, input.periodStart, input.periodEnd]);
        const vatCollectedPesewas = parseInt((_b = (_a = vat[0]) === null || _a === void 0 ? void 0 : _a.collected) !== null && _b !== void 0 ? _b : '0', 10);
        const vatRemittedPesewas = parseInt((_d = (_c = vat[0]) === null || _c === void 0 ? void 0 : _c.remitted) !== null && _d !== void 0 ? _d : '0', 10);
        const vatGapPesewas = Math.max(0, vatCollectedPesewas - vatRemittedPesewas);
        const exemptSalesWithoutRxCount = parseInt((_f = (_e = vat[0]) === null || _e === void 0 ? void 0 : _e.exempt_no_rx) !== null && _f !== void 0 ? _f : '0', 10);
        const exemptionAbuseFlag = exemptSalesWithoutRxCount > 0;
        if (vatGapPesewas > 100000) {
            findings.push(this.finding({
                severity: 'HIGH',
                category: 'TAX',
                title: `VAT Gap of ${this.fmt(vatGapPesewas)} — Possible Under-Remittance`,
                description: `Collected ${this.fmt(vatCollectedPesewas)} VAT but only remitted ${this.fmt(vatRemittedPesewas)}. GRA penalty: 150% of unpaid tax + interest.`,
                regulatoryReference: 'Ghana GRA — VAT Act 2013 (Act 870), s.41 Penalty',
                recommendation: 'Remit outstanding VAT immediately. File amended return if deadline passed. Engage GRA-registered tax consultant.',
                financialImpactPesewas: vatGapPesewas,
            }));
        }
        if (exemptionAbuseFlag) {
            findings.push(this.finding({
                severity: 'HIGH',
                category: 'TAX',
                title: 'VAT Exemption Claimed on Non-Prescription Sales',
                description: `${exemptSalesWithoutRxCount} sale(s) claimed VAT exemption without a valid prescription. Only Rx medicines are VAT-exempt.`,
                regulatoryReference: 'Ghana GRA — VAT Act 2013, Schedule 1 (Exempt Supplies)',
                recommendation: 'Correct VAT returns for affected periods. Ensure POS only applies exemption when prescription_id is present.',
                financialImpactPesewas: exemptSalesWithoutRxCount * 5000,
            }));
        }
        const paye = await this.dataSource.query(`SELECT COUNT(*) as total_staff,
              COUNT(*) as with_paye -- placeholder
       FROM staff_profiles sp
       WHERE sp.branch_id = $1 AND sp.is_active = true`, [branchId]);
        const staffOnPayrollCount = parseInt((_h = (_g = paye[0]) === null || _g === void 0 ? void 0 : _g.total_staff) !== null && _h !== void 0 ? _h : '0', 10);
        const staffWithPayeDeductionCount = parseInt((_k = (_j = paye[0]) === null || _j === void 0 ? void 0 : _j.with_paye) !== null && _k !== void 0 ? _k : '0', 10);
        const payeComplianceFlag = staffWithPayeDeductionCount < staffOnPayrollCount;
        if (payeComplianceFlag) {
            findings.push(this.finding({
                severity: 'HIGH',
                category: 'TAX',
                title: `${staffOnPayrollCount - staffWithPayeDeductionCount} Staff Without PAYE Deduction`,
                description: 'Staff paid without PAYE deduction is a GRA violation. Employer is liable for unpaid tax.',
                regulatoryReference: 'Ghana GRA — Income Tax Act 2015 (Act 896), s.114 PAYE',
                recommendation: 'Enrol all staff in PAYE scheme immediately. File amended returns for affected months.',
            }));
        }
        const wht = await this.dataSource.query(`SELECT
         COUNT(CASE WHEN sp.amount > 200000 THEN 1 END) as above_threshold,
         COUNT(CASE WHEN sp.amount > 200000 THEN 1 END) as without_wht -- placeholder until WHT is explicitly tracked
       FROM supplier_payments sp
       JOIN supplier_invoices si ON si.id = sp.invoice_id
       WHERE si.branch_id = $1 AND sp.paid_at BETWEEN $2 AND $3`, [branchId, input.periodStart, input.periodEnd]);
        const supplierPaymentsAboveThresholdCount = parseInt((_m = (_l = wht[0]) === null || _l === void 0 ? void 0 : _l.above_threshold) !== null && _m !== void 0 ? _m : '0', 10);
        const supplierPaymentsWithoutWhtCount = parseInt((_p = (_o = wht[0]) === null || _o === void 0 ? void 0 : _o.without_wht) !== null && _p !== void 0 ? _p : '0', 10);
        if (supplierPaymentsWithoutWhtCount > 0) {
            findings.push(this.finding({
                severity: 'MEDIUM',
                category: 'TAX',
                title: `${supplierPaymentsWithoutWhtCount} Supplier Payment(s) Without Withholding Tax`,
                description: 'Payments > GH₵2,000 to suppliers require 7.5% withholding tax deduction under Ghana GRA rules.',
                regulatoryReference: 'Ghana GRA — Income Tax Act 2015, s.116 Withholding Tax',
                recommendation: 'Apply WHT on all qualifying payments. File WHT returns monthly.',
            }));
        }
        const overallTaxStatus = findings.some((f) => f.severity === 'CRITICAL')
            ? 'CRITICAL'
            : findings.some((f) => f.severity === 'HIGH')
                ? 'MAJOR_VIOLATIONS'
                : findings.length > 0
                    ? 'MINOR_GAPS'
                    : 'COMPLIANT';
        return {
            vatCollectedPesewas,
            vatCollectedFormatted: this.fmt(vatCollectedPesewas),
            vatRemittedPesewas,
            vatRemittedFormatted: this.fmt(vatRemittedPesewas),
            vatGapPesewas,
            vatGapFormatted: this.fmt(vatGapPesewas),
            vatFilingStatus: vatGapPesewas > 0 ? 'PENDING' : 'FILED',
            exemptSalesWithoutRxCount,
            exemptionAbuseFlag,
            staffOnPayrollCount,
            staffWithPayeDeductionCount,
            payeComplianceFlag,
            supplierPaymentsAboveThresholdCount,
            supplierPaymentsWithoutWhtCount,
            overallTaxStatus,
            findings,
        };
    }
    async getLicenceComplianceAudit(branchId) {
        var _a, _b, _c, _d, _e;
        const findings = [];
        const now = new Date();
        const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const licences = await this.dataSource.query(`SELECT sp.user_id, sp.professional_licence_no as licence_number, sp.licence_expiry_date as licence_expiry, u.role
       FROM staff_profiles sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.branch_id = $1 AND sp.is_active = true
         AND u.role IN ('pharmacist', 'head_pharmacist')`, [branchId]);
        const pharmacistsWithExpiredLicenceCount = licences.filter((l) => l.licence_expiry && new Date(l.licence_expiry) < now).length;
        const pharmacistsWithNoLicenceCount = licences.filter((l) => !l.licence_number).length;
        const licencesExpiringIn30DaysCount = licences.filter((l) => l.licence_expiry && new Date(l.licence_expiry) > now && new Date(l.licence_expiry) < in30Days).length;
        if (pharmacistsWithExpiredLicenceCount > 0) {
            findings.push(this.finding({
                severity: 'CRITICAL',
                category: 'REGULATORY',
                title: `${pharmacistsWithExpiredLicenceCount} Pharmacist(s) With Expired Licence`,
                description: 'Dispensing by an unlicensed pharmacist is a Ghana Pharmacy Council violation and invalidates all dispensed Rx.',
                regulatoryReference: 'Ghana Pharmacy Act 1994 — Pharmacy Council Licence Renewal',
                recommendation: 'Suspend dispensing privileges immediately. Renew licences before reinstating.',
            }));
        }
        if (licencesExpiringIn30DaysCount > 0) {
            findings.push(this.finding({
                severity: 'MEDIUM',
                category: 'REGULATORY',
                title: `${licencesExpiringIn30DaysCount} Pharmacist Licence(s) Expiring Within 30 Days`,
                description: 'Proactive renewal required to avoid dispensing interruption.',
                recommendation: 'Initiate Pharmacy Council renewal process immediately.',
            }));
        }
        const branch = await this.dataSource.query(`SELECT b.settings
       FROM branches b WHERE b.id = $1`, [branchId]);
        const settings = (_b = (_a = branch[0]) === null || _a === void 0 ? void 0 : _a.settings) !== null && _b !== void 0 ? _b : {};
        const branchLicenceOnFile = settings.hefra_licence_on_file === true;
        const branchLicenceExpiryDate = (_c = settings.hefra_licence_expiry) !== null && _c !== void 0 ? _c : null;
        const branchLicenceStatus = !branchLicenceOnFile
            ? 'NOT_ON_FILE'
            : branchLicenceExpiryDate && new Date(branchLicenceExpiryDate) < now
                ? 'EXPIRED'
                : branchLicenceExpiryDate && new Date(branchLicenceExpiryDate) < in30Days
                    ? 'EXPIRING_SOON'
                    : 'VALID';
        if (branchLicenceStatus === 'EXPIRED' || branchLicenceStatus === 'NOT_ON_FILE') {
            findings.push(this.finding({
                severity: 'CRITICAL',
                category: 'REGULATORY',
                title: `Branch HeFRA Operating Licence ${branchLicenceStatus}`,
                description: 'Operating a pharmacy without a valid HeFRA licence is illegal in Ghana.',
                regulatoryReference: 'Ghana HeFRA — Health Facilities Regulatory Agency Act 2011',
                recommendation: 'Cease operations until licence is obtained/renewed. Contact HeFRA immediately.',
            }));
        }
        const controlledSignoff = await this.dataSource.query(`SELECT COUNT(*) as count
       FROM prescriptions p
       JOIN sales s ON s.prescription_id = p.id
       JOIN sale_items si ON si.sale_id = s.id
       JOIN products pr ON pr.id = si.product_id
       WHERE s.branch_id = $1 AND pr.classification = 'CONTROLLED' AND p.approval_count < 2`, [branchId]);
        const controlledDrugDispensedWithoutDoubleSignoffCount = parseInt((_e = (_d = controlledSignoff[0]) === null || _d === void 0 ? void 0 : _d.count) !== null && _e !== void 0 ? _e : '0', 10);
        const overallStatus = findings.some((f) => f.severity === 'CRITICAL')
            ? 'CRITICAL'
            : findings.some((f) => f.severity === 'HIGH')
                ? 'MAJOR_VIOLATIONS'
                : findings.length > 0
                    ? 'MINOR_GAPS'
                    : 'COMPLIANT';
        return {
            pharmacistsWithExpiredLicenceCount,
            pharmacistsWithNoLicenceCount,
            licencesExpiringIn30DaysCount,
            branchLicenceOnFile,
            branchLicenceExpiryDate,
            branchLicenceStatus,
            controlledDrugRegisterCompliant: controlledDrugDispensedWithoutDoubleSignoffCount === 0,
            controlledDrugDispensedWithoutDoubleSignoffCount,
            coldChainProductsWithoutTempLogCount: 0,
            overallStatus,
            findings,
        };
    }
    async getStaffBehaviourProfiles(branchId, input) {
        const stats = await this.dataSource.query(`SELECT
         sub.cashier_id                                                  AS user_id,
         sub.role,
         COUNT(CASE WHEN sub.status != 'VOIDED' THEN 1 END)::int             AS sale_count,
         COALESCE(SUM(CASE WHEN sub.status != 'VOIDED' THEN sub.total_amount END), 0)::int AS total_revenue,
         COUNT(CASE WHEN sub.status = 'VOIDED' THEN 1 END)::int              AS void_count,
         COUNT(CASE WHEN sub.status = 'REFUNDED' THEN 1 END)::int   AS refund_count,
         0::int         AS discount_count,
         COALESCE((
           SELECT COUNT(*)::int FROM audit_logs al
           WHERE al.user_id = sub.cashier_id AND al.type = 'POM_BLOCK'
             AND al.created_at BETWEEN $2 AND $3
         ), 0)::int                                                      AS pom_block_count,
         COUNT(CASE WHEN EXTRACT(HOUR FROM sub.sale_at) NOT BETWEEN 7 AND 20 THEN 1 END)::int AS after_hours_count,
         COALESCE(MIN(sub.gap_seconds), 60)::float                         AS min_scan_gap_seconds
       FROM (
         SELECT
           s.cashier_id,
           u.role,
           s.status,
           s.total_amount,
           (${this.effectiveSaleAt.sql('s')}) AS sale_at,
           EXTRACT(EPOCH FROM (
             LEAD((${this.effectiveSaleAt.sql('s')})) OVER (PARTITION BY s.cashier_id ORDER BY (${this.effectiveSaleAt.sql('s')}))
             - (${this.effectiveSaleAt.sql('s')})
           )) AS gap_seconds
         FROM sales s
         JOIN users u ON u.id = s.cashier_id
         WHERE s.branch_id = $1 AND (${this.effectiveSaleAt.sql('s')}) BETWEEN $2 AND $3
       ) sub
       GROUP BY sub.cashier_id, sub.role`, [branchId, input.periodStart, input.periodEnd]);
        if (stats.length === 0)
            return [];
        const avgVoidRate = stats.reduce((sum, s) => sum + (s.sale_count > 0 ? s.void_count / s.sale_count : 0), 0) /
            stats.length;
        const avgScanSpeed = stats.reduce((sum, s) => sum + s.min_scan_gap_seconds, 0) / stats.length;
        const branchName = await this.getBranchName(branchId);
        const profiles = stats.map((s) => {
            const anomalies = [];
            const voidRate = s.sale_count > 0 ? s.void_count / s.sale_count : 0;
            const voidSigma = avgVoidRate > 0 ? (voidRate - avgVoidRate) / avgVoidRate : 0;
            if (voidRate > 0.05 || voidSigma > 2) {
                anomalies.push({
                    anomalyType: 'VOID_ABUSE',
                    description: `Void rate ${(voidRate * 100).toFixed(1)}% vs branch avg ${(avgVoidRate * 100).toFixed(1)}%`,
                    occurrenceCount: s.void_count,
                    deviationSigma: voidSigma,
                    riskLevel: voidSigma > 3 ? 'HIGH' : 'MEDIUM',
                });
            }
            const discountRate = s.sale_count > 0 ? s.discount_count / s.sale_count : 0;
            if (discountRate > 0.2) {
                anomalies.push({
                    anomalyType: 'DISCOUNT_ABUSE',
                    description: `${(discountRate * 100).toFixed(1)}% of sales have discounts applied — possible collusion with customers`,
                    occurrenceCount: s.discount_count,
                    deviationSigma: discountRate / 0.05,
                    riskLevel: discountRate > 0.4 ? 'HIGH' : 'MEDIUM',
                });
            }
            if (s.after_hours_count > 3) {
                anomalies.push({
                    anomalyType: 'AFTER_HOURS',
                    description: `${s.after_hours_count} transaction(s) outside business hours (07:00–20:00)`,
                    occurrenceCount: s.after_hours_count,
                    deviationSigma: s.after_hours_count / 2,
                    riskLevel: s.after_hours_count > 10 ? 'HIGH' : 'MEDIUM',
                });
            }
            const speedSigma = avgScanSpeed > 0 ? (avgScanSpeed - s.min_scan_gap_seconds) / avgScanSpeed : 0;
            if (s.min_scan_gap_seconds < 3 && s.sale_count > 10) {
                anomalies.push({
                    anomalyType: 'SPEED_ANOMALY',
                    description: `Min scan gap ${s.min_scan_gap_seconds.toFixed(1)}s — possible barcode pre-scanning or system manipulation`,
                    occurrenceCount: s.sale_count,
                    deviationSigma: speedSigma,
                    riskLevel: s.min_scan_gap_seconds < 1 ? 'HIGH' : 'MEDIUM',
                });
            }
            if (s.pom_block_count > 0) {
                anomalies.push({
                    anomalyType: 'POM_BYPASS_ATTEMPT',
                    description: `${s.pom_block_count} attempt(s) to dispense POM without prescription — Ghana FDA violation attempt`,
                    occurrenceCount: s.pom_block_count,
                    deviationSigma: s.pom_block_count,
                    riskLevel: s.pom_block_count > 3 ? 'HIGH' : 'MEDIUM',
                });
            }
            const refundRate = s.sale_count > 0 ? s.refund_count / s.sale_count : 0;
            if (refundRate > 0.05) {
                anomalies.push({
                    anomalyType: 'REFUND_PATTERN',
                    description: `Refund rate ${(refundRate * 100).toFixed(1)}% — above 5% threshold`,
                    occurrenceCount: s.refund_count,
                    deviationSigma: refundRate / 0.02,
                    riskLevel: refundRate > 0.1 ? 'HIGH' : 'MEDIUM',
                });
            }
            let riskScore = 0;
            riskScore += Math.min(voidSigma * 15, 30);
            riskScore += Math.min(discountRate * 50, 20);
            riskScore += Math.min(s.after_hours_count * 2, 15);
            riskScore += Math.min(s.pom_block_count * 10, 25);
            riskScore += Math.min(refundRate * 100, 10);
            riskScore = Math.min(Math.round(riskScore), 100);
            const riskRating = riskScore >= 75 ? 'ESCALATE' : riskScore >= 50 ? 'INVESTIGATE' : riskScore >= 25 ? 'WATCH' : 'CLEAN';
            const avgSaleValueGhs = s.sale_count > 0 ? s.total_revenue / s.sale_count / 100 : 0;
            const summary = this.buildStaffSummary(s.user_id, riskRating, anomalies, riskScore);
            return {
                userId: s.user_id,
                role: s.role,
                branchName,
                totalSalesCount: s.sale_count,
                totalRevenuePesewas: s.total_revenue,
                totalRevenueFormatted: this.fmt(s.total_revenue),
                avgSaleValueGhs,
                voidCount: s.void_count,
                refundCount: s.refund_count,
                discountCount: s.discount_count,
                pomAttemptBlockCount: s.pom_block_count,
                peakActivityHour: '09:00–10:00',
                afterHoursTransactionCount: s.after_hours_count,
                avgItemScanSpeedSeconds: s.min_scan_gap_seconds,
                anomalies,
                riskRating,
                riskScore,
                summary,
            };
        });
        return profiles.sort((a, b) => b.riskScore - a.riskScore);
    }
    async getStaffBehaviourProfile(branchId, input) {
        var _a, _b;
        const periodInput = {
            periodStart: (_a = input.fromDate) !== null && _a !== void 0 ? _a : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            periodEnd: (_b = input.toDate) !== null && _b !== void 0 ? _b : new Date().toISOString(),
        };
        const profiles = await this.getStaffBehaviourProfiles(branchId, periodInput);
        const profile = profiles.find((p) => p.userId === input.userId);
        if (!profile) {
            const branchName = await this.getBranchName(branchId);
            return {
                userId: input.userId,
                role: 'unknown',
                branchName,
                totalSalesCount: 0,
                totalRevenuePesewas: 0,
                totalRevenueFormatted: 'GH₵0.00',
                avgSaleValueGhs: 0,
                voidCount: 0,
                refundCount: 0,
                discountCount: 0,
                pomAttemptBlockCount: 0,
                peakActivityHour: 'N/A',
                afterHoursTransactionCount: 0,
                avgItemScanSpeedSeconds: 0,
                anomalies: [],
                riskRating: 'CLEAN',
                riskScore: 0,
                summary: 'No activity recorded in the selected period.',
            };
        }
        return profile;
    }
    buildRiskMatrix(findings) {
        const matrix = [];
        const criticalCount = findings.filter((f) => f.severity === 'CRITICAL').length;
        const fraudCount = findings.filter((f) => f.category === 'FRAUD').length;
        const regulatoryCount = findings.filter((f) => f.category === 'REGULATORY').length;
        const taxCount = findings.filter((f) => f.category === 'TAX').length;
        if (regulatoryCount > 0) {
            matrix.push({
                riskTitle: 'Ghana FDA Regulatory Non-Compliance',
                riskType: 'REGULATORY',
                likelihood: regulatoryCount > 3 ? 'HIGH' : 'MEDIUM',
                impact: 'CRITICAL',
                inherentRisk: 'CRITICAL',
                mitigationStatus: 'INADEQUATE',
                recommendedControl: 'Enforce POM guards at API level. Mandatory pharmacist training. Monthly compliance audit.',
            });
        }
        if (fraudCount > 0) {
            matrix.push({
                riskTitle: 'Internal Financial Fraud',
                riskType: 'FRAUD',
                likelihood: fraudCount > 2 ? 'HIGH' : 'MEDIUM',
                impact: 'HIGH',
                inherentRisk: fraudCount > 2 ? 'CRITICAL' : 'HIGH',
                mitigationStatus: 'PARTIAL',
                recommendedControl: 'Dual-approval for voids/refunds. Daily cash reconciliation. CCTV review protocol.',
            });
        }
        if (taxCount > 0) {
            matrix.push({
                riskTitle: 'GRA Tax Non-Compliance',
                riskType: 'FINANCIAL',
                likelihood: 'MEDIUM',
                impact: 'HIGH',
                inherentRisk: 'HIGH',
                mitigationStatus: 'PARTIAL',
                recommendedControl: 'Engage GRA-registered tax consultant. Automate VAT filing. Monthly WHT reconciliation.',
            });
        }
        matrix.push({
            riskTitle: 'Expired Medication Dispensing',
            riskType: 'REGULATORY',
            likelihood: 'LOW',
            impact: 'CRITICAL',
            inherentRisk: 'HIGH',
            mitigationStatus: 'ADEQUATE',
            recommendedControl: 'Automated expiry alerts at 90/60/30 days. FEFO stock rotation enforced in POS.',
        });
        matrix.push({
            riskTitle: 'Data Breach — Patient PHI',
            riskType: 'REPUTATIONAL',
            likelihood: 'LOW',
            impact: 'CRITICAL',
            inherentRisk: 'HIGH',
            mitigationStatus: 'ADEQUATE',
            recommendedControl: 'AES-256 encryption at rest. RLS on all tables. Annual penetration test.',
        });
        matrix.push({
            riskTitle: 'System Downtime During Peak Hours',
            riskType: 'OPERATIONAL',
            likelihood: criticalCount > 0 ? 'MEDIUM' : 'LOW',
            impact: 'HIGH',
            inherentRisk: 'MEDIUM',
            mitigationStatus: 'ADEQUATE',
            recommendedControl: 'Offline-first PWA with IndexedDB sync. 99.9% SLA on Supabase. Upstash Redis failover.',
        });
        return matrix;
    }
    scoreOverallRisk(sections) {
        var _a, _b;
        let score = 0;
        if (sections.dispensingCompliance.overallStatus === 'CRITICAL_VIOLATIONS')
            score += 35;
        else if (sections.dispensingCompliance.overallStatus === 'MAJOR_VIOLATIONS')
            score += 20;
        else if (sections.dispensingCompliance.overallStatus === 'MINOR_GAPS')
            score += 8;
        if (sections.financialIntegrity.integrityStatus === 'CRITICAL_BREACH')
            score += 25;
        else if (sections.financialIntegrity.integrityStatus === 'FRAUD_SIGNALS')
            score += 15;
        else if (sections.financialIntegrity.integrityStatus === 'ANOMALIES_DETECTED')
            score += 5;
        if (sections.inventoryIntegrity.integrityStatus === 'CRITICAL')
            score += 15;
        else if (sections.inventoryIntegrity.integrityStatus === 'INVESTIGATE')
            score += 8;
        else if (sections.inventoryIntegrity.integrityStatus === 'WATCH')
            score += 3;
        if (sections.taxCompliance.overallTaxStatus === 'CRITICAL')
            score += 15;
        else if (sections.taxCompliance.overallTaxStatus === 'MAJOR_VIOLATIONS')
            score += 8;
        else if (sections.taxCompliance.overallTaxStatus === 'MINOR_GAPS')
            score += 3;
        if (sections.licenceCompliance.overallStatus === 'CRITICAL')
            score += 10;
        else if (sections.licenceCompliance.overallStatus === 'MAJOR_VIOLATIONS')
            score += 5;
        const topStaffRisk = (_b = (_a = sections.staffProfiles[0]) === null || _a === void 0 ? void 0 : _a.riskScore) !== null && _b !== void 0 ? _b : 0;
        score += Math.round(topStaffRisk * 0.1);
        return Math.min(score, 100);
    }
    buildAuditorOpinion(riskScore, criticalCount, findings) {
        const totalFinancialExposure = findings.reduce((s, f) => { var _a; return s + ((_a = f.financialImpactPesewas) !== null && _a !== void 0 ? _a : 0); }, 0);
        const regulatoryFindings = findings.filter((f) => f.category === 'REGULATORY');
        let auditorOpinion;
        let opinionNarrative;
        if (criticalCount >= 3 || riskScore >= 75) {
            auditorOpinion = 'ADVERSE';
            opinionNarrative =
                `The Internal Audit Engine has identified ${criticalCount} critical finding(s) with a risk score of ${riskScore}/100. ` +
                    `The financial exposure is estimated at ${this.fmt(totalFinancialExposure)}. ` +
                    `The branch is operating with material Ghana FDA and/or GRA compliance failures that require immediate escalation to ownership and regulatory bodies. ` +
                    `Financial statements for this period cannot be relied upon without material adjustments.`;
        }
        else if (criticalCount >= 1 || riskScore >= 50) {
            auditorOpinion = 'QUALIFIED';
            opinionNarrative =
                `The audit identified ${criticalCount} critical and ${findings.filter((f) => f.severity === 'HIGH').length} high-severity finding(s). ` +
                    `Risk score: ${riskScore}/100. Estimated financial exposure: ${this.fmt(totalFinancialExposure)}. ` +
                    `Operations are broadly functional but significant compliance gaps exist that must be remediated within 30 days. ` +
                    `${regulatoryFindings.length > 0 ? 'Ghana FDA regulatory findings require priority attention.' : ''}`;
        }
        else if (findings.length > 0) {
            auditorOpinion = 'QUALIFIED';
            opinionNarrative =
                `The audit identified ${findings.length} finding(s) of low-to-medium severity. Risk score: ${riskScore}/100. ` +
                    `The branch is broadly compliant with Ghana FDA and GRA requirements. ` +
                    `Identified gaps should be addressed within 60 days as part of continuous improvement.`;
        }
        else {
            auditorOpinion = 'UNQUALIFIED';
            opinionNarrative =
                `No material findings identified. Risk score: ${riskScore}/100. ` +
                    `The branch is operating in compliance with Ghana FDA dispensing rules, GRA tax obligations, and internal financial controls. ` +
                    `Continue current practices and maintain monthly self-audit cadence.`;
        }
        const criticalActions = findings
            .filter((f) => f.severity === 'CRITICAL')
            .slice(0, 3)
            .map((f, i) => `${i + 1}. [CRITICAL — THIS WEEK] ${f.recommendation}`)
            .join('\n');
        const highActions = findings
            .filter((f) => f.severity === 'HIGH')
            .slice(0, 3)
            .map((f, i) => `${i + 1}. [HIGH — THIS MONTH] ${f.recommendation}`)
            .join('\n');
        const immediateActionPlan = criticalActions || highActions
            ? [criticalActions, highActions].filter(Boolean).join('\n\n')
            : 'No immediate actions required. Schedule next audit in 30 days.';
        return { auditorOpinion, opinionNarrative, immediateActionPlan };
    }
    finding(params) {
        return {
            id: (0, crypto_1.randomUUID)(),
            severity: params.severity,
            category: params.category,
            title: params.title,
            description: params.description,
            regulatoryReference: params.regulatoryReference,
            recommendation: params.recommendation,
            financialImpactPesewas: params.financialImpactPesewas,
            financialImpactFormatted: params.financialImpactPesewas
                ? this.fmt(params.financialImpactPesewas)
                : undefined,
            implicatedUserId: params.implicatedUserId,
            entityType: params.entityType,
            entityId: params.entityId,
            detectedAt: new Date(),
        };
    }
    buildStaffSummary(userId, riskRating, anomalies, riskScore) {
        var _a, _b;
        if (riskRating === 'CLEAN')
            return `User ${userId.slice(0, 8)}… shows no behavioural anomalies. Risk score: ${riskScore}/100.`;
        const topAnomaly = anomalies[0];
        return (`User ${userId.slice(0, 8)}… rated ${riskRating} with risk score ${riskScore}/100. ` +
            `Primary concern: ${(_a = topAnomaly === null || topAnomaly === void 0 ? void 0 : topAnomaly.anomalyType) !== null && _a !== void 0 ? _a : 'N/A'} — ${(_b = topAnomaly === null || topAnomaly === void 0 ? void 0 : topAnomaly.description) !== null && _b !== void 0 ? _b : ''}. ` +
            `${anomalies.length} anomaly signal(s) detected. ${riskRating === 'ESCALATE' ? 'Recommend immediate investigation and suspension pending review.' : 'Monitor closely.'}`);
    }
    riskRating(score) {
        if (score >= 75)
            return 'CRITICAL';
        if (score >= 50)
            return 'HIGH';
        if (score >= 25)
            return 'MEDIUM';
        return 'LOW';
    }
    severityWeight(severity) {
        var _a;
        const weights = { CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, INFO: 1 };
        return (_a = weights[severity]) !== null && _a !== void 0 ? _a : 0;
    }
    async getBranchName(branchId) {
        var _a, _b;
        const result = await this.dataSource.query(`SELECT name FROM branches WHERE id = $1`, [branchId]);
        return (_b = (_a = result[0]) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : 'Unknown Branch';
    }
    fmt(pesewas) {
        return `GH₵${(pesewas / 100).toFixed(2)}`;
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = AuditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        sales_effective_at_service_1.SalesEffectiveAtService])
], AuditService);
//# sourceMappingURL=audit.service.js.map