import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { SalesEffectiveAtService } from '../sales/sales-effective-at.service';
import {
  AuditFinding,
  AuditPeriodInput,
  DispensingComplianceAudit,
  FinancialIntegrityAudit,
  InventoryIntegrityAudit,
  InternalAuditReport,
  LicenceComplianceAudit,
  RiskMatrixEntry,
  StaffBehaviourAnomaly,
  StaffBehaviourProfile,
  StaffInvestigationInput,
  TaxComplianceAudit,
} from './dto/audit.types';

// ─────────────────────────────────────────────────────────────────────────────
// Internal row types (never exposed — no `any`)
// ─────────────────────────────────────────────────────────────────────────────
interface SaleRow {
  id: string;
  total_amount: number;
  payment_method: string;
  created_by: string;
  created_at: Date;
  is_void: boolean;
  branch_id: string;
}
interface StaffSaleStats {
  user_id: string;
  role: string;
  sale_count: number;
  total_revenue: number;
  void_count: number;
  refund_count: number;
  discount_count: number;
  pom_block_count: number;
  after_hours_count: number;
  min_scan_gap_seconds: number;
}
interface ExpenseRow {
  id: string;
  amount: number;
  description: string;
  receipt_url: string | null;
  created_by: string;
}
interface InvoiceRow {
  id: string;
  total_amount: number;
  grn_id: string | null;
  is_matched: boolean;
  invoice_number: string;
}
interface StaffLicenceRow {
  user_id: string;
  licence_number: string | null;
  licence_expiry: Date | null;
  role: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly effectiveSaleAt: SalesEffectiveAtService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // MASTER REPORT — runs all engines in parallel
  // ───────────────────────────────────────────────────────────────────────────
  async getInternalAuditReport(
    branchId: string,
    input: AuditPeriodInput,
  ): Promise<InternalAuditReport> {
    const [
      dispensingCompliance,
      financialIntegrity,
      inventoryIntegrity,
      taxCompliance,
      licenceCompliance,
      staffProfiles,
    ] = await Promise.all([
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
    const totalFinancialExposurePesewas = allFindings.reduce(
      (sum, f) => sum + (f.financialImpactPesewas ?? 0),
      0,
    );
    const riskMatrix = this.buildRiskMatrix(allFindings);
    const { auditorOpinion, opinionNarrative, immediateActionPlan } =
      this.buildAuditorOpinion(overallRiskScore, criticalFindingsCount, allFindings);

    const branchName = await this.getBranchName(branchId);

    return {
      reportId: randomUUID(),
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

  // ───────────────────────────────────────────────────────────────────────────
  // DISPENSING COMPLIANCE — Ghana FDA Rules 1–8
  // ───────────────────────────────────────────────────────────────────────────
  async getDispensingComplianceAudit(
    branchId: string,
    input: AuditPeriodInput,
  ): Promise<DispensingComplianceAudit> {
    const findings: AuditFinding[] = [];
    /** Inclusive calendar-day window in Africa/Accra (plain `BETWEEN date` on timestamptz omits most of `periodEnd`). */
    const saleAccraDay = `(${this.effectiveSaleAt.sql('s')} AT TIME ZONE 'Africa/Accra')::date`;
    const periodPred = `AND ${saleAccraDay} BETWEEN $2::date AND $3::date`;

    // Ghana FDA Rule 1: POM sales without approved Rx
    const pomNoRx = await this.dataSource.query<{ count: string; total: string }[]>(
      `SELECT COUNT(*) as count, COALESCE(SUM(s.total_amount),0) as total
       FROM sales s
       JOIN sale_items si ON si.sale_id = s.id
       JOIN products p ON p.id = si.product_id
       WHERE s.branch_id = $1
         ${periodPred}
         AND p.requires_rx = true
         AND s.prescription_id IS NULL
         AND s.status != 'VOIDED'`,
      [branchId, input.periodStart, input.periodEnd],
    );
    const pomSalesWithoutRxCount = parseInt(pomNoRx[0]?.count ?? '0', 10);
    const pomSalesWithoutRxValuePesewas = parseInt(pomNoRx[0]?.total ?? '0', 10);

    if (pomSalesWithoutRxCount > 0) {
      findings.push(
        this.finding({
          severity: 'CRITICAL',
          category: 'REGULATORY',
          title: 'POM Dispensed Without Prescription',
          description: `${pomSalesWithoutRxCount} POM sale(s) processed without a valid prescription — direct Ghana FDA violation.`,
          regulatoryReference: 'Ghana FDA POM Enforcement Rule 1 — Pharmacy Act 1994 s.24',
          recommendation: 'Immediately suspend implicated cashier accounts. File incident report with Ghana FDA within 48 hours. Retrain all dispensing staff.',
          financialImpactPesewas: pomSalesWithoutRxValuePesewas,
        }),
      );
    }

    // Ghana FDA Rule 4: Expired Rx dispensed (Rx validity = 30 days)
    const expiredRx = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*) as count
       FROM sales s
       JOIN prescriptions p ON p.id = s.prescription_id
       WHERE s.branch_id = $1
         ${periodPred}
         AND s.status != 'VOIDED'
         AND (p.prescribed_date AT TIME ZONE 'Africa/Accra')::date < (${saleAccraDay} - INTERVAL '30 days')`,
      [branchId, input.periodStart, input.periodEnd],
    );
    const expiredRxDispensedCount = parseInt(expiredRx[0]?.count ?? '0', 10);
    if (expiredRxDispensedCount > 0) {
      findings.push(
        this.finding({
          severity: 'CRITICAL',
          category: 'REGULATORY',
          title: 'Expired Prescription Dispensed',
          description: `${expiredRxDispensedCount} sale(s) dispensed against prescriptions older than 30 days.`,
          regulatoryReference: 'Ghana FDA POM Rule 4 — Rx validity 30 days',
          recommendation: 'Audit all dispensed Rx for the period. Notify prescribers. Implement system-level Rx expiry hard block.',
        }),
      );
    }

    // Ghana FDA Rule 5: Controlled drugs — single sign-off
    const singleSignoff = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*) as count
       FROM prescriptions p
       JOIN sales s ON s.prescription_id = p.id
       JOIN products pr ON pr.id = ANY(
         SELECT product_id FROM sale_items WHERE sale_id = s.id
       )
       WHERE s.branch_id = $1
         ${periodPred}
         AND pr.classification = 'CONTROLLED'
         AND p.approval_count < 2`,
      [branchId, input.periodStart, input.periodEnd],
    );
    const controlledDrugSingleSignoffCount = parseInt(singleSignoff[0]?.count ?? '0', 10);
    if (controlledDrugSingleSignoffCount > 0) {
      findings.push(
        this.finding({
          severity: 'CRITICAL',
          category: 'REGULATORY',
          title: 'Controlled Drug Dispensed With Single Sign-Off',
          description: `${controlledDrugSingleSignoffCount} controlled drug dispensing(s) had only one pharmacist sign-off. Two required.`,
          regulatoryReference: 'Ghana FDA POM Rule 5 — Controlled Drugs Regulations 2013',
          recommendation: 'Halt controlled drug dispensing until dual sign-off workflow is enforced. Report to Pharmacy Council.',
        }),
      );
    }

    // GMDC validation gaps (placeholder since gmdc_validated_at is not in schema yet)
    const rxWithoutGmdcValidationCount = 0;
    const rxWithExpiredGmdcLicenceCount = 0;

    if (rxWithExpiredGmdcLicenceCount > 0) {
      findings.push(
        this.finding({
          severity: 'HIGH',
          category: 'REGULATORY',
          title: 'Prescriptions From Expired GMDC Licences Dispensed',
          description: `${rxWithExpiredGmdcLicenceCount} prescription(s) dispensed from prescribers with expired GMDC licences.`,
          regulatoryReference: 'Ghana FDA POM Rule 3 — GMDC Prescriber Licence Validation',
          recommendation: 'Reject all future Rx from expired GMDC licences. Notify Ghana FDA.',
        }),
      );
    }

    // Rx PDF retention compliance
    const pdfCompliance = await this.dataSource.query<{ total: string; with_pdf: string }[]>(
      `SELECT COUNT(*) as total,
              COUNT(CASE WHEN p.s3_pdf_key IS NOT NULL THEN 1 END) as with_pdf
       FROM prescriptions p
       JOIN sales s ON s.prescription_id = p.id
       WHERE s.branch_id = $1 ${periodPred}`,
      [branchId, input.periodStart, input.periodEnd],
    );
    const totalRx = parseInt(pdfCompliance[0]?.total ?? '0', 10);
    const withPdf = parseInt(pdfCompliance[0]?.with_pdf ?? '0', 10);
    const rxMissingPdfCount = totalRx - withPdf;
    const rxPdfCompliancePct = totalRx > 0 ? (withPdf / totalRx) * 100 : 100;

    if (rxMissingPdfCount > 0) {
      findings.push(
        this.finding({
          severity: 'HIGH',
          category: 'REGULATORY',
          title: 'Prescription PDFs Missing (5-Year Retention Breach)',
          description: `${rxMissingPdfCount} prescription(s) have no scanned PDF on file. Ghana FDA requires 5-year retention.`,
          regulatoryReference: 'Ghana FDA POM Rule 7 — Rx PDF Retention (5 years)',
          recommendation: 'Retroactively scan and upload missing Rx PDFs. Enforce mandatory upload in dispensing workflow.',
        }),
      );
    }

    // Drug interaction overrides
    const interactions = await this.dataSource.query<{ major: string; contraindicated: string }[]>(
      `SELECT
         COUNT(CASE WHEN al.type = 'MAJOR_INTERACTION_OVERRIDE' THEN 1 END) as major,
         COUNT(CASE WHEN al.type = 'CONTRAINDICATED_ATTEMPT' THEN 1 END) as contraindicated
       FROM audit_logs al
       WHERE al.branch_id = $1
         AND (al.created_at AT TIME ZONE 'Africa/Accra')::date BETWEEN $2::date AND $3::date`,
      [branchId, input.periodStart, input.periodEnd],
    );
    const majorInteractionOverrideCount = parseInt(interactions[0]?.major ?? '0', 10);
    const contraindicatedAttemptCount = parseInt(interactions[0]?.contraindicated ?? '0', 10);

    if (contraindicatedAttemptCount > 0) {
      findings.push(
        this.finding({
          severity: 'CRITICAL',
          category: 'DISPENSING',
          title: 'Contraindicated Drug Combination Attempted',
          description: `${contraindicatedAttemptCount} attempt(s) to dispense contraindicated drug combinations. System blocked these — but attempts indicate training gaps.`,
          regulatoryReference: 'Ghana FDA Drug Interaction Policy — Contraindicated = hard block',
          recommendation: 'Identify staff involved. Mandatory pharmacology refresher training. Review product catalogue for interaction flags.',
        }),
      );
    }

    const overallStatus =
      findings.some((f) => f.severity === 'CRITICAL')
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
      chemicalShopPomAttemptCount: 0, // chemical shop isolation enforced at API level
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

  // ───────────────────────────────────────────────────────────────────────────
  // FINANCIAL INTEGRITY — fraud detection, revenue reconciliation
  // ───────────────────────────────────────────────────────────────────────────
  async getFinancialIntegrityAudit(
    branchId: string,
    input: AuditPeriodInput,
  ): Promise<FinancialIntegrityAudit> {
    const findings: AuditFinding[] = [];

    // Revenue reconciliation: expected = sum of all non-void sale items
    const revenue = await this.dataSource.query<
      { expected: string; recorded: string; cash: string; momo: string }[]
    >(
      `SELECT
         COALESCE(SUM(CASE WHEN s.status != 'VOIDED' THEN s.total_amount END), 0) as expected,
         COALESCE(SUM(CASE WHEN s.status = 'COMPLETED' THEN s.total_amount END), 0) as recorded,
         COALESCE(SUM(CASE WHEN s.status = 'COMPLETED' THEN s.total_amount END), 0) as cash,
         0 as momo
       FROM sales s
       WHERE s.branch_id = $1 AND (${this.effectiveSaleAt.sql('s')}) BETWEEN $2 AND $3`,
      [branchId, input.periodStart, input.periodEnd],
    );
    const expectedRevenuePesewas = parseInt(revenue[0]?.expected ?? '0', 10);
    const recordedRevenuePesewas = parseInt(revenue[0]?.recorded ?? '0', 10);
    const cashSalesPesewas = parseInt(revenue[0]?.cash ?? '0', 10);
    const momoSalesPesewas = parseInt(revenue[0]?.momo ?? '0', 10);
    const revenueDiscrepancyPesewas = expectedRevenuePesewas - recordedRevenuePesewas;

    if (revenueDiscrepancyPesewas > 50000) {
      // > GH₵5 discrepancy
      findings.push(
        this.finding({
          severity: revenueDiscrepancyPesewas > 500000 ? 'CRITICAL' : 'HIGH',
          category: 'FRAUD',
          title: 'Revenue Reconciliation Gap Detected',
          description: `Expected revenue ${this.fmt(expectedRevenuePesewas)} vs recorded ${this.fmt(recordedRevenuePesewas)}. Gap: ${this.fmt(revenueDiscrepancyPesewas)}.`,
          recommendation: 'Cross-reference POS receipts with bank statements. Investigate cashier sessions with gaps.',
          financialImpactPesewas: revenueDiscrepancyPesewas,
        }),
      );
    }

    // Void & refund analysis
    const voids = await this.dataSource.query<{ void_total: string; void_count: string; refund_total: string; refund_count: string }[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN s.status = 'VOIDED' THEN s.total_amount END), 0) as void_total,
         COUNT(CASE WHEN s.status = 'VOIDED' THEN 1 END) as void_count,
         COALESCE(SUM(CASE WHEN s.status = 'REFUNDED' THEN s.total_amount END), 0) as refund_total,
         COUNT(CASE WHEN s.status = 'REFUNDED' THEN 1 END) as refund_count
       FROM sales s
       WHERE s.branch_id = $1 AND (${this.effectiveSaleAt.sql('s')}) BETWEEN $2 AND $3`,
      [branchId, input.periodStart, input.periodEnd],
    );
    const totalVoidsPesewas = parseInt(voids[0]?.void_total ?? '0', 10);
    const totalRefundsPesewas = parseInt(voids[0]?.refund_total ?? '0', 10);
    const voidRatePct = expectedRevenuePesewas > 0 ? (totalVoidsPesewas / expectedRevenuePesewas) * 100 : 0;
    const refundRatePct = expectedRevenuePesewas > 0 ? (totalRefundsPesewas / expectedRevenuePesewas) * 100 : 0;
    const voidBenchmarkStatus = voidRatePct > 5 ? 'CRITICAL' : voidRatePct > 2 ? 'ELEVATED' : 'NORMAL';

    if (voidRatePct > 5) {
      findings.push(
        this.finding({
          severity: 'HIGH',
          category: 'FRAUD',
          title: `Void Rate ${voidRatePct.toFixed(1)}% — Exceeds 5% Threshold`,
          description: 'Abnormally high void rate is a classic indicator of cashier fraud (void-and-pocket scheme).',
          recommendation: 'Require manager approval for all voids. Review CCTV footage for high-void cashiers. Implement void reason codes.',
          financialImpactPesewas: totalVoidsPesewas,
        }),
      );
    }

    // Cash dominance flag — > 80% cash is suspicious
    const cashToMomoRatio = momoSalesPesewas > 0 ? cashSalesPesewas / momoSalesPesewas : 99;
    const cashDominanceFlag = cashSalesPesewas / (cashSalesPesewas + momoSalesPesewas + 1) > 0.8;
    if (cashDominanceFlag) {
      findings.push(
        this.finding({
          severity: 'MEDIUM',
          category: 'FINANCIAL',
          title: 'Unusual Cash Dominance (>80% of Sales)',
          description: 'High cash ratio may indicate MoMo fee avoidance, under-reporting, or preference for untraceable transactions.',
          recommendation: 'Encourage MoMo payments. Investigate if cash receipts match daily cash-up totals.',
        }),
      );
    }

    // Supplier invoice integrity
    const invoiceIntegrity = await this.dataSource.query<{
      unmatched: string; unmatched_value: string; duplicates: string; no_grn: string;
    }[]>(
      `SELECT
         COUNT(CASE WHEN si.status = 'PENDING' THEN 1 END) as unmatched,
         COALESCE(SUM(CASE WHEN si.status = 'PENDING' THEN si.total_amount END), 0) as unmatched_value,
         COUNT(CASE WHEN dup.cnt > 1 THEN 1 END) as duplicates,
         COUNT(CASE WHEN si.grn_id IS NULL THEN 1 END) as no_grn
       FROM supplier_invoices si
       LEFT JOIN (
         SELECT invoice_number, COUNT(*) as cnt FROM supplier_invoices GROUP BY invoice_number
       ) dup ON dup.invoice_number = si.invoice_number
       WHERE si.branch_id = $1 AND si.created_at BETWEEN $2 AND $3`,
      [branchId, input.periodStart, input.periodEnd],
    );
    const unmatchedInvoiceCount = parseInt(invoiceIntegrity[0]?.unmatched ?? '0', 10);
    const unmatchedInvoiceValuePesewas = parseInt(invoiceIntegrity[0]?.unmatched_value ?? '0', 10);
    const duplicateInvoiceCount = parseInt(invoiceIntegrity[0]?.duplicates ?? '0', 10);
    const invoicesWithoutGrnCount = parseInt(invoiceIntegrity[0]?.no_grn ?? '0', 10);

    if (duplicateInvoiceCount > 0) {
      findings.push(
        this.finding({
          severity: 'HIGH',
          category: 'FRAUD',
          title: `${duplicateInvoiceCount} Duplicate Supplier Invoice(s) Detected`,
          description: 'Duplicate invoice numbers are a classic accounts payable fraud signal (double-payment scheme).',
          recommendation: 'Block payment on duplicate invoices. Investigate supplier relationship. Implement unique invoice number constraint.',
          financialImpactPesewas: unmatchedInvoiceValuePesewas,
        }),
      );
    }

    // Expense integrity — round-number fraud signal
    const expenses = await this.dataSource.query<{
      no_receipt: string; no_receipt_value: string; round_numbers: string;
    }[]>(
      `SELECT
         COUNT(CASE WHEN e.receipt_s3_key IS NULL THEN 1 END) as no_receipt,
         COALESCE(SUM(CASE WHEN e.receipt_s3_key IS NULL THEN e.amount_pesewas END), 0) as no_receipt_value,
         COUNT(CASE WHEN e.amount_pesewas % 100000 = 0 AND e.amount_pesewas >= 100000 THEN 1 END) as round_numbers
       FROM expenses e
       WHERE e.branch_id = $1 AND e.created_at BETWEEN $2 AND $3`,
      [branchId, input.periodStart, input.periodEnd],
    );
    const expensesWithoutReceiptCount = parseInt(expenses[0]?.no_receipt ?? '0', 10);
    const expensesWithoutReceiptValuePesewas = parseInt(expenses[0]?.no_receipt_value ?? '0', 10);
    const roundNumberExpenseCount = parseInt(expenses[0]?.round_numbers ?? '0', 10);
    const roundNumberExpenseFlag = roundNumberExpenseCount > 3;

    if (expensesWithoutReceiptCount > 0) {
      findings.push(
        this.finding({
          severity: 'MEDIUM',
          category: 'FINANCIAL',
          title: `${expensesWithoutReceiptCount} Expense(s) Without Receipt`,
          description: `${this.fmt(expensesWithoutReceiptValuePesewas)} in expenses have no supporting receipt — GRA audit risk.`,
          recommendation: 'Enforce mandatory receipt upload before expense approval. Reject retroactive claims without receipts.',
          financialImpactPesewas: expensesWithoutReceiptValuePesewas,
        }),
      );
    }

    // GL integrity
    const glIntegrity = await this.dataSource.query<{ unbalanced: string; no_ref: string }[]>(
      `SELECT
         COUNT(CASE WHEN gl.debit != gl.credit THEN 1 END) as unbalanced,
         COUNT(CASE WHEN gl.reference_id IS NULL AND gl.reference_type IS NULL THEN 1 END) as no_ref
       FROM general_ledger gl
       WHERE gl.branch_id = $1 AND gl.posted_at BETWEEN $2 AND $3`,
      [branchId, input.periodStart, input.periodEnd],
    );
    const unbalancedGlEntriesCount = parseInt(glIntegrity[0]?.unbalanced ?? '0', 10);
    const glEntriesWithoutReferenceCount = parseInt(glIntegrity[0]?.no_ref ?? '0', 10);

    if (unbalancedGlEntriesCount > 0) {
      findings.push(
        this.finding({
          severity: 'CRITICAL',
          category: 'DATA_INTEGRITY',
          title: `${unbalancedGlEntriesCount} Unbalanced GL Entries`,
          description: 'Debits ≠ Credits in general ledger. This violates double-entry accounting and invalidates financial statements.',
          recommendation: 'Immediately investigate and correct all unbalanced entries. Audit the system that created them.',
        }),
      );
    }

    const integrityStatus =
      findings.some((f) => f.severity === 'CRITICAL')
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

  // ───────────────────────────────────────────────────────────────────────────
  // INVENTORY INTEGRITY — theft, shrinkage, phantom stock
  // ───────────────────────────────────────────────────────────────────────────
  async getInventoryIntegrityAudit(
    branchId: string,
    input: AuditPeriodInput,
  ): Promise<InventoryIntegrityAudit> {
    const findings: AuditFinding[] = [];

    const adjustments = await this.dataSource.query<{
      total: string; negative: string; negative_value: string; high_value_single_user: string;
    }[]>(
      `SELECT
         COUNT(*) as total,
         COUNT(CASE WHEN sm.quantity < 0 THEN 1 END) as negative,
         COALESCE(SUM(CASE WHEN sm.quantity < 0 THEN ABS(sm.quantity) * (p.unit_price * 0.7) END), 0) as negative_value,
         COUNT(CASE WHEN sm.quantity < 0 AND ABS(sm.quantity) * (p.unit_price * 0.7) > 500000 THEN 1 END) as high_value_single_user
       FROM stock_movements sm
       JOIN products p ON p.id = sm.product_id
       WHERE sm.branch_id = $1 AND sm.movement_type = 'ADJUSTMENT' AND sm.created_at BETWEEN $2 AND $3`,
      [branchId, input.periodStart, input.periodEnd],
    );
    const totalAdjustmentCount = parseInt(adjustments[0]?.total ?? '0', 10);
    const negativeAdjustmentCount = parseInt(adjustments[0]?.negative ?? '0', 10);
    const negativeAdjustmentValuePesewas = parseInt(adjustments[0]?.negative_value ?? '0', 10);
    const highValueAdjustmentByOneUserCount = parseInt(adjustments[0]?.high_value_single_user ?? '0', 10);

    // Shrinkage rate vs total inventory value
    const inventoryValue = await this.dataSource.query<{ total_value: string }[]>(
      `SELECT COALESCE(SUM(i.quantity_on_hand * (p.unit_price * 0.7)), 0) as total_value
       FROM inventory i JOIN products p ON p.id = i.product_id
       WHERE i.branch_id = $1`,
      [branchId],
    );
    const totalInventoryValue = parseInt(inventoryValue[0]?.total_value ?? '1', 10);
    const shrinkageRatePct = (negativeAdjustmentValuePesewas / totalInventoryValue) * 100;
    const shrinkageStatus = shrinkageRatePct > 3 ? 'CRITICAL' : shrinkageRatePct > 1 ? 'ELEVATED' : 'ACCEPTABLE';

    if (shrinkageRatePct > 1) {
      findings.push(
        this.finding({
          severity: shrinkageRatePct > 3 ? 'CRITICAL' : 'HIGH',
          category: 'INVENTORY',
          title: `Inventory Shrinkage ${shrinkageRatePct.toFixed(2)}% — Above 1% Benchmark`,
          description: `${this.fmt(negativeAdjustmentValuePesewas)} in negative adjustments. Pharmacy benchmark is <1%. Possible theft or dispensing without recording.`,
          recommendation: 'Conduct physical stock count. Review CCTV. Require dual-approval for negative adjustments > GH₵50.',
          financialImpactPesewas: negativeAdjustmentValuePesewas,
        }),
      );
    }

    if (highValueAdjustmentByOneUserCount > 0) {
      findings.push(
        this.finding({
          severity: 'HIGH',
          category: 'FRAUD',
          title: 'High-Value Inventory Adjustments by Single User',
          description: `${highValueAdjustmentByOneUserCount} adjustment(s) > GH₵5 each made by a single user — concentration of control risk.`,
          recommendation: 'Require second-user approval for adjustments > GH₵50. Investigate the specific user IDs.',
        }),
      );
    }

    // Phantom stock — sold items with no inventory record
    const phantom = await this.dataSource.query<{ count: string; value: string }[]>(
      `SELECT COUNT(*) as count, COALESCE(SUM(si.quantity * si.unit_price), 0) as value
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN inventory i ON i.product_id = si.product_id AND i.branch_id = s.branch_id
       WHERE s.branch_id = $1 AND (${this.effectiveSaleAt.sql('s')}) BETWEEN $2 AND $3
         AND s.status != 'VOIDED' AND i.id IS NULL`,
      [branchId, input.periodStart, input.periodEnd],
    );
    const phantomStockSalesCount = parseInt(phantom[0]?.count ?? '0', 10);
    const phantomStockValuePesewas = parseInt(phantom[0]?.value ?? '0', 10);

    if (phantomStockSalesCount > 0) {
      findings.push(
        this.finding({
          severity: 'CRITICAL',
          category: 'DATA_INTEGRITY',
          title: `${phantomStockSalesCount} Sales of Products With No Inventory Record`,
          description: 'Products sold that have no inventory entry — indicates data integrity failure or ghost product creation.',
          recommendation: 'Investigate how products were sold without inventory. Check for deleted inventory records.',
          financialImpactPesewas: phantomStockValuePesewas,
        }),
      );
    }

    // Expired stock dispensed
    const expiredDispensed = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*) as count
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.branch_id = $1 AND (${this.effectiveSaleAt.sql('s')}) BETWEEN $2 AND $3
         AND s.status != 'VOIDED' AND si.expiry_date < (${this.effectiveSaleAt.sql('s')})`,
      [branchId, input.periodStart, input.periodEnd],
    );
    const expiredStockDispensedCount = parseInt(expiredDispensed[0]?.count ?? '0', 10);
    if (expiredStockDispensedCount > 0) {
      findings.push(
        this.finding({
          severity: 'CRITICAL',
          category: 'REGULATORY',
          title: `${expiredStockDispensedCount} Expired Product(s) Dispensed`,
          description: 'Dispensing expired medication is a Ghana FDA violation and patient safety risk.',
          regulatoryReference: 'Ghana FDA — Medicines Act 2012, Expired Medicines Prohibition',
          recommendation: 'Immediately quarantine all near-expiry stock. Implement expiry date check at point of sale.',
        }),
      );
    }

    // GRN integrity
    const grnIntegrity = await this.dataSource.query<{ no_invoice: string; stock_not_in_grn: string }[]>(
      `SELECT
         COUNT(CASE WHEN si.id IS NULL THEN 1 END) as no_invoice,
         0 as stock_not_in_grn
       FROM goods_received_notes g
       LEFT JOIN supplier_invoices si ON si.grn_id = g.id
       WHERE g.branch_id = $1 AND g.received_at BETWEEN $2 AND $3`,
      [branchId, input.periodStart, input.periodEnd],
    );
    const grnWithoutInvoiceCount = parseInt(grnIntegrity[0]?.no_invoice ?? '0', 10);

    const integrityStatus =
      findings.some((f) => f.severity === 'CRITICAL')
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

  // ───────────────────────────────────────────────────────────────────────────
  // TAX COMPLIANCE — Ghana GRA: VAT, PAYE, withholding tax
  // ───────────────────────────────────────────────────────────────────────────
  async getTaxComplianceAudit(
    branchId: string,
    input: AuditPeriodInput,
  ): Promise<TaxComplianceAudit> {
    const findings: AuditFinding[] = [];

    // VAT: 15% on non-Rx sales (12.5% VAT + 2.5% NHIL)
    const vat = await this.dataSource.query<{
      collected: string; remitted: string; exempt_no_rx: string;
    }[]>(
      `SELECT
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
       WHERE s.branch_id = $1 AND (${this.effectiveSaleAt.sql('s')}) BETWEEN $2 AND $3`,
      [branchId, input.periodStart, input.periodEnd],
    );
    const vatCollectedPesewas = parseInt(vat[0]?.collected ?? '0', 10);
    const vatRemittedPesewas = parseInt(vat[0]?.remitted ?? '0', 10);
    const vatGapPesewas = Math.max(0, vatCollectedPesewas - vatRemittedPesewas);
    const exemptSalesWithoutRxCount = parseInt(vat[0]?.exempt_no_rx ?? '0', 10);
    const exemptionAbuseFlag = exemptSalesWithoutRxCount > 0;

    if (vatGapPesewas > 100000) {
      // > GH₵10 gap
      findings.push(
        this.finding({
          severity: 'HIGH',
          category: 'TAX',
          title: `VAT Gap of ${this.fmt(vatGapPesewas)} — Possible Under-Remittance`,
          description: `Collected ${this.fmt(vatCollectedPesewas)} VAT but only remitted ${this.fmt(vatRemittedPesewas)}. GRA penalty: 150% of unpaid tax + interest.`,
          regulatoryReference: 'Ghana GRA — VAT Act 2013 (Act 870), s.41 Penalty',
          recommendation: 'Remit outstanding VAT immediately. File amended return if deadline passed. Engage GRA-registered tax consultant.',
          financialImpactPesewas: vatGapPesewas,
        }),
      );
    }

    if (exemptionAbuseFlag) {
      findings.push(
        this.finding({
          severity: 'HIGH',
          category: 'TAX',
          title: 'VAT Exemption Claimed on Non-Prescription Sales',
          description: `${exemptSalesWithoutRxCount} sale(s) claimed VAT exemption without a valid prescription. Only Rx medicines are VAT-exempt.`,
          regulatoryReference: 'Ghana GRA — VAT Act 2013, Schedule 1 (Exempt Supplies)',
          recommendation: 'Correct VAT returns for affected periods. Ensure POS only applies exemption when prescription_id is present.',
          financialImpactPesewas: exemptSalesWithoutRxCount * 5000, // estimated
        }),
      );
    }

    // PAYE compliance (Placeholder until payroll module is fully implemented)
    const paye = await this.dataSource.query<{ total_staff: string; with_paye: string }[]>(
      `SELECT COUNT(*) as total_staff,
              COUNT(*) as with_paye -- placeholder
       FROM staff_profiles sp
       WHERE sp.branch_id = $1 AND sp.is_active = true`,
      [branchId],
    );
    const staffOnPayrollCount = parseInt(paye[0]?.total_staff ?? '0', 10);
    const staffWithPayeDeductionCount = parseInt(paye[0]?.with_paye ?? '0', 10);
    const payeComplianceFlag = staffWithPayeDeductionCount < staffOnPayrollCount;

    if (payeComplianceFlag) {
      findings.push(
        this.finding({
          severity: 'HIGH',
          category: 'TAX',
          title: `${staffOnPayrollCount - staffWithPayeDeductionCount} Staff Without PAYE Deduction`,
          description: 'Staff paid without PAYE deduction is a GRA violation. Employer is liable for unpaid tax.',
          regulatoryReference: 'Ghana GRA — Income Tax Act 2015 (Act 896), s.114 PAYE',
          recommendation: 'Enrol all staff in PAYE scheme immediately. File amended returns for affected months.',
        }),
      );
    }

    // Withholding tax on supplier payments > GH₵2,000 (200,000 pesewas)
    // Assuming withholding tax is tracked via general_ledger or we just flag payments > 200000
    const wht = await this.dataSource.query<{ above_threshold: string; without_wht: string }[]>(
      `SELECT
         COUNT(CASE WHEN sp.amount > 200000 THEN 1 END) as above_threshold,
         COUNT(CASE WHEN sp.amount > 200000 THEN 1 END) as without_wht -- placeholder until WHT is explicitly tracked
       FROM supplier_payments sp
       JOIN supplier_invoices si ON si.id = sp.invoice_id
       WHERE si.branch_id = $1 AND sp.paid_at BETWEEN $2 AND $3`,
      [branchId, input.periodStart, input.periodEnd],
    );
    const supplierPaymentsAboveThresholdCount = parseInt(wht[0]?.above_threshold ?? '0', 10);
    const supplierPaymentsWithoutWhtCount = parseInt(wht[0]?.without_wht ?? '0', 10);

    if (supplierPaymentsWithoutWhtCount > 0) {
      findings.push(
        this.finding({
          severity: 'MEDIUM',
          category: 'TAX',
          title: `${supplierPaymentsWithoutWhtCount} Supplier Payment(s) Without Withholding Tax`,
          description: 'Payments > GH₵2,000 to suppliers require 7.5% withholding tax deduction under Ghana GRA rules.',
          regulatoryReference: 'Ghana GRA — Income Tax Act 2015, s.116 Withholding Tax',
          recommendation: 'Apply WHT on all qualifying payments. File WHT returns monthly.',
        }),
      );
    }

    const overallTaxStatus =
      findings.some((f) => f.severity === 'CRITICAL')
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

  // ───────────────────────────────────────────────────────────────────────────
  // LICENCE COMPLIANCE — Ghana FDA, HeFRA, Pharmacy Council
  // ───────────────────────────────────────────────────────────────────────────
  async getLicenceComplianceAudit(branchId: string): Promise<LicenceComplianceAudit> {
    const findings: AuditFinding[] = [];
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const licences = await this.dataSource.query<StaffLicenceRow[]>(
      `SELECT sp.user_id, sp.professional_licence_no as licence_number, sp.licence_expiry_date as licence_expiry, u.role
       FROM staff_profiles sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.branch_id = $1 AND sp.is_active = true
         AND u.role IN ('pharmacist', 'head_pharmacist')`,
      [branchId],
    );

    const pharmacistsWithExpiredLicenceCount = licences.filter(
      (l) => l.licence_expiry && new Date(l.licence_expiry) < now,
    ).length;
    const pharmacistsWithNoLicenceCount = licences.filter((l) => !l.licence_number).length;
    const licencesExpiringIn30DaysCount = licences.filter(
      (l) => l.licence_expiry && new Date(l.licence_expiry) > now && new Date(l.licence_expiry) < in30Days,
    ).length;

    if (pharmacistsWithExpiredLicenceCount > 0) {
      findings.push(
        this.finding({
          severity: 'CRITICAL',
          category: 'REGULATORY',
          title: `${pharmacistsWithExpiredLicenceCount} Pharmacist(s) With Expired Licence`,
          description: 'Dispensing by an unlicensed pharmacist is a Ghana Pharmacy Council violation and invalidates all dispensed Rx.',
          regulatoryReference: 'Ghana Pharmacy Act 1994 — Pharmacy Council Licence Renewal',
          recommendation: 'Suspend dispensing privileges immediately. Renew licences before reinstating.',
        }),
      );
    }

    if (licencesExpiringIn30DaysCount > 0) {
      findings.push(
        this.finding({
          severity: 'MEDIUM',
          category: 'REGULATORY',
          title: `${licencesExpiringIn30DaysCount} Pharmacist Licence(s) Expiring Within 30 Days`,
          description: 'Proactive renewal required to avoid dispensing interruption.',
          recommendation: 'Initiate Pharmacy Council renewal process immediately.',
        }),
      );
    }

    // Branch operating licence (HeFRA)
    const branch = await this.dataSource.query<{
      settings: any;
    }[]>(
      `SELECT b.settings
       FROM branches b WHERE b.id = $1`,
      [branchId],
    );
    const settings = branch[0]?.settings ?? {};
    const branchLicenceOnFile = settings.hefra_licence_on_file === true;
    const branchLicenceExpiryDate = settings.hefra_licence_expiry ?? null;
    const branchLicenceStatus = !branchLicenceOnFile
      ? 'NOT_ON_FILE'
      : branchLicenceExpiryDate && new Date(branchLicenceExpiryDate) < now
      ? 'EXPIRED'
      : branchLicenceExpiryDate && new Date(branchLicenceExpiryDate) < in30Days
      ? 'EXPIRING_SOON'
      : 'VALID';

    if (branchLicenceStatus === 'EXPIRED' || branchLicenceStatus === 'NOT_ON_FILE') {
      findings.push(
        this.finding({
          severity: 'CRITICAL',
          category: 'REGULATORY',
          title: `Branch HeFRA Operating Licence ${branchLicenceStatus}`,
          description: 'Operating a pharmacy without a valid HeFRA licence is illegal in Ghana.',
          regulatoryReference: 'Ghana HeFRA — Health Facilities Regulatory Agency Act 2011',
          recommendation: 'Cease operations until licence is obtained/renewed. Contact HeFRA immediately.',
        }),
      );
    }

    // Controlled drug double sign-off
    const controlledSignoff = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*) as count
       FROM prescriptions p
       JOIN sales s ON s.prescription_id = p.id
       JOIN sale_items si ON si.sale_id = s.id
       JOIN products pr ON pr.id = si.product_id
       WHERE s.branch_id = $1 AND pr.classification = 'CONTROLLED' AND p.approval_count < 2`,
      [branchId],
    );
    const controlledDrugDispensedWithoutDoubleSignoffCount = parseInt(
      controlledSignoff[0]?.count ?? '0',
      10,
    );

    const overallStatus =
      findings.some((f) => f.severity === 'CRITICAL')
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

  // ───────────────────────────────────────────────────────────────────────────
  // STAFF BEHAVIOUR PROFILING — the "spy" engine
  // Ghana DPA 2012: user IDs only, never names in findings
  // ───────────────────────────────────────────────────────────────────────────
  async getStaffBehaviourProfiles(
    branchId: string,
    input: AuditPeriodInput,
  ): Promise<StaffBehaviourProfile[]> {
    const stats = await this.dataSource.query<StaffSaleStats[]>(
      `SELECT
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
       GROUP BY sub.cashier_id, sub.role`,
      [branchId, input.periodStart, input.periodEnd],
    );

    if (stats.length === 0) return [];

    // Compute branch averages for deviation scoring
    const avgVoidRate =
      stats.reduce((sum, s) => sum + (s.sale_count > 0 ? s.void_count / s.sale_count : 0), 0) /
      stats.length;
    const avgScanSpeed =
      stats.reduce((sum, s) => sum + s.min_scan_gap_seconds, 0) / stats.length;

    const branchName = await this.getBranchName(branchId);

    const profiles = stats.map((s): StaffBehaviourProfile => {
      const anomalies: StaffBehaviourAnomaly[] = [];
      const voidRate = s.sale_count > 0 ? s.void_count / s.sale_count : 0;
      const voidSigma = avgVoidRate > 0 ? (voidRate - avgVoidRate) / avgVoidRate : 0;

      // VOID_ABUSE — void rate > 3× branch average
      if (voidRate > 0.05 || voidSigma > 2) {
        anomalies.push({
          anomalyType: 'VOID_ABUSE',
          description: `Void rate ${(voidRate * 100).toFixed(1)}% vs branch avg ${(avgVoidRate * 100).toFixed(1)}%`,
          occurrenceCount: s.void_count,
          deviationSigma: voidSigma,
          riskLevel: voidSigma > 3 ? 'HIGH' : 'MEDIUM',
        });
      }

      // DISCOUNT_ABUSE — > 20% of sales have discounts
      const discountRate = s.sale_count > 0 ? s.discount_count / s.sale_count : 0;
      if (discountRate > 0.2) {
        anomalies.push({
          anomalyType: 'DISCOUNT_ABUSE',
          description: `${(discountRate * 100).toFixed(1)}% of sales have discounts applied — possible collusion with customers`,
          occurrenceCount: s.discount_count,
          deviationSigma: discountRate / 0.05, // normalised against 5% expected
          riskLevel: discountRate > 0.4 ? 'HIGH' : 'MEDIUM',
        });
      }

      // AFTER_HOURS — transactions outside 07:00–20:00
      if (s.after_hours_count > 3) {
        anomalies.push({
          anomalyType: 'AFTER_HOURS',
          description: `${s.after_hours_count} transaction(s) outside business hours (07:00–20:00)`,
          occurrenceCount: s.after_hours_count,
          deviationSigma: s.after_hours_count / 2,
          riskLevel: s.after_hours_count > 10 ? 'HIGH' : 'MEDIUM',
        });
      }

      // SPEED_ANOMALY — scanning faster than humanly possible (< 3s per item)
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

      // POM_BYPASS_ATTEMPT
      if (s.pom_block_count > 0) {
        anomalies.push({
          anomalyType: 'POM_BYPASS_ATTEMPT',
          description: `${s.pom_block_count} attempt(s) to dispense POM without prescription — Ghana FDA violation attempt`,
          occurrenceCount: s.pom_block_count,
          deviationSigma: s.pom_block_count,
          riskLevel: s.pom_block_count > 3 ? 'HIGH' : 'MEDIUM',
        });
      }

      // REFUND_PATTERN — > 5% refund rate
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

      // Risk score: weighted sum of anomaly signals
      let riskScore = 0;
      riskScore += Math.min(voidSigma * 15, 30);
      riskScore += Math.min(discountRate * 50, 20);
      riskScore += Math.min(s.after_hours_count * 2, 15);
      riskScore += Math.min(s.pom_block_count * 10, 25);
      riskScore += Math.min(refundRate * 100, 10);
      riskScore = Math.min(Math.round(riskScore), 100);

      const riskRating =
        riskScore >= 75 ? 'ESCALATE' : riskScore >= 50 ? 'INVESTIGATE' : riskScore >= 25 ? 'WATCH' : 'CLEAN';

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
        peakActivityHour: '09:00–10:00', // simplified — full impl needs histogram
        afterHoursTransactionCount: s.after_hours_count,
        avgItemScanSpeedSeconds: s.min_scan_gap_seconds,
        anomalies,
        riskRating,
        riskScore,
        summary,
      };
    });

    // Sort by risk score descending — highest risk first
    return profiles.sort((a, b) => b.riskScore - a.riskScore);
  }

  async getStaffBehaviourProfile(
    branchId: string,
    input: StaffInvestigationInput,
  ): Promise<StaffBehaviourProfile> {
    const periodInput: AuditPeriodInput = {
      periodStart: input.fromDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      periodEnd: input.toDate ?? new Date().toISOString(),
    };
    const profiles = await this.getStaffBehaviourProfiles(branchId, periodInput);
    const profile = profiles.find((p) => p.userId === input.userId);
    if (!profile) {
      // Return clean profile if no activity in period
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

  // ───────────────────────────────────────────────────────────────────────────
  // RISK MATRIX — probability × impact
  // ───────────────────────────────────────────────────────────────────────────
  buildRiskMatrix(findings: AuditFinding[]): RiskMatrixEntry[] {
    const matrix: RiskMatrixEntry[] = [];

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

    // Always include these standing risks for a pharmacy
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

  // ───────────────────────────────────────────────────────────────────────────
  // SCORING & OPINION
  // ───────────────────────────────────────────────────────────────────────────
  scoreOverallRisk(sections: {
    dispensingCompliance: DispensingComplianceAudit;
    financialIntegrity: FinancialIntegrityAudit;
    inventoryIntegrity: InventoryIntegrityAudit;
    taxCompliance: TaxComplianceAudit;
    licenceCompliance: LicenceComplianceAudit;
    staffProfiles: StaffBehaviourProfile[];
  }): number {
    let score = 0;

    // Dispensing compliance — highest weight (Ghana FDA)
    if (sections.dispensingCompliance.overallStatus === 'CRITICAL_VIOLATIONS') score += 35;
    else if (sections.dispensingCompliance.overallStatus === 'MAJOR_VIOLATIONS') score += 20;
    else if (sections.dispensingCompliance.overallStatus === 'MINOR_GAPS') score += 8;

    // Financial integrity
    if (sections.financialIntegrity.integrityStatus === 'CRITICAL_BREACH') score += 25;
    else if (sections.financialIntegrity.integrityStatus === 'FRAUD_SIGNALS') score += 15;
    else if (sections.financialIntegrity.integrityStatus === 'ANOMALIES_DETECTED') score += 5;

    // Inventory integrity
    if (sections.inventoryIntegrity.integrityStatus === 'CRITICAL') score += 15;
    else if (sections.inventoryIntegrity.integrityStatus === 'INVESTIGATE') score += 8;
    else if (sections.inventoryIntegrity.integrityStatus === 'WATCH') score += 3;

    // Tax compliance
    if (sections.taxCompliance.overallTaxStatus === 'CRITICAL') score += 15;
    else if (sections.taxCompliance.overallTaxStatus === 'MAJOR_VIOLATIONS') score += 8;
    else if (sections.taxCompliance.overallTaxStatus === 'MINOR_GAPS') score += 3;

    // Licence compliance
    if (sections.licenceCompliance.overallStatus === 'CRITICAL') score += 10;
    else if (sections.licenceCompliance.overallStatus === 'MAJOR_VIOLATIONS') score += 5;

    // Staff risk — top staff risk score contributes
    const topStaffRisk = sections.staffProfiles[0]?.riskScore ?? 0;
    score += Math.round(topStaffRisk * 0.1); // max 10 points

    return Math.min(score, 100);
  }

  buildAuditorOpinion(
    riskScore: number,
    criticalCount: number,
    findings: AuditFinding[],
  ): { auditorOpinion: string; opinionNarrative: string; immediateActionPlan: string } {
    const totalFinancialExposure = findings.reduce((s, f) => s + (f.financialImpactPesewas ?? 0), 0);
    const regulatoryFindings = findings.filter((f) => f.category === 'REGULATORY');

    let auditorOpinion: string;
    let opinionNarrative: string;

    if (criticalCount >= 3 || riskScore >= 75) {
      auditorOpinion = 'ADVERSE';
      opinionNarrative =
        `The Internal Audit Engine has identified ${criticalCount} critical finding(s) with a risk score of ${riskScore}/100. ` +
        `The financial exposure is estimated at ${this.fmt(totalFinancialExposure)}. ` +
        `The branch is operating with material Ghana FDA and/or GRA compliance failures that require immediate escalation to ownership and regulatory bodies. ` +
        `Financial statements for this period cannot be relied upon without material adjustments.`;
    } else if (criticalCount >= 1 || riskScore >= 50) {
      auditorOpinion = 'QUALIFIED';
      opinionNarrative =
        `The audit identified ${criticalCount} critical and ${findings.filter((f) => f.severity === 'HIGH').length} high-severity finding(s). ` +
        `Risk score: ${riskScore}/100. Estimated financial exposure: ${this.fmt(totalFinancialExposure)}. ` +
        `Operations are broadly functional but significant compliance gaps exist that must be remediated within 30 days. ` +
        `${regulatoryFindings.length > 0 ? 'Ghana FDA regulatory findings require priority attention.' : ''}`;
    } else if (findings.length > 0) {
      auditorOpinion = 'QUALIFIED';
      opinionNarrative =
        `The audit identified ${findings.length} finding(s) of low-to-medium severity. Risk score: ${riskScore}/100. ` +
        `The branch is broadly compliant with Ghana FDA and GRA requirements. ` +
        `Identified gaps should be addressed within 60 days as part of continuous improvement.`;
    } else {
      auditorOpinion = 'UNQUALIFIED';
      opinionNarrative =
        `No material findings identified. Risk score: ${riskScore}/100. ` +
        `The branch is operating in compliance with Ghana FDA dispensing rules, GRA tax obligations, and internal financial controls. ` +
        `Continue current practices and maintain monthly self-audit cadence.`;
    }

    // Build prioritised action plan
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

    const immediateActionPlan =
      criticalActions || highActions
        ? [criticalActions, highActions].filter(Boolean).join('\n\n')
        : 'No immediate actions required. Schedule next audit in 30 days.';

    return { auditorOpinion, opinionNarrative, immediateActionPlan };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ───────────────────────────────────────────────────────────────────────────
  private finding(params: {
    severity: string;
    category: string;
    title: string;
    description: string;
    regulatoryReference?: string;
    recommendation: string;
    financialImpactPesewas?: number;
    implicatedUserId?: string;
    entityType?: string;
    entityId?: string;
  }): AuditFinding {
    return {
      id: randomUUID(),
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

  private buildStaffSummary(
    userId: string,
    riskRating: string,
    anomalies: StaffBehaviourAnomaly[],
    riskScore: number,
  ): string {
    // Ghana DPA 2012: use userId only, never name
    if (riskRating === 'CLEAN') return `User ${userId.slice(0, 8)}… shows no behavioural anomalies. Risk score: ${riskScore}/100.`;
    const topAnomaly = anomalies[0];
    return (
      `User ${userId.slice(0, 8)}… rated ${riskRating} with risk score ${riskScore}/100. ` +
      `Primary concern: ${topAnomaly?.anomalyType ?? 'N/A'} — ${topAnomaly?.description ?? ''}. ` +
      `${anomalies.length} anomaly signal(s) detected. ${riskRating === 'ESCALATE' ? 'Recommend immediate investigation and suspension pending review.' : 'Monitor closely.'}`
    );
  }

  private riskRating(score: number): string {
    if (score >= 75) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 25) return 'MEDIUM';
    return 'LOW';
  }

  private severityWeight(severity: string): number {
    const weights: Record<string, number> = { CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, INFO: 1 };
    return weights[severity] ?? 0;
  }

  private async getBranchName(branchId: string): Promise<string> {
    const result = await this.dataSource.query<{ name: string }[]>(
      `SELECT name FROM branches WHERE id = $1`,
      [branchId],
    );
    return result[0]?.name ?? 'Unknown Branch';
  }

  private fmt(pesewas: number): string {
    return `GH₵${(pesewas / 100).toFixed(2)}`;
  }
}
