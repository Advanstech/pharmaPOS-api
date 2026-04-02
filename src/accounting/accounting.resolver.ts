import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { FinancialIntelligenceService } from './financial-intelligence.service';
import {
  CreateExpenseInput,
  ApproveExpenseInput,
  RecordSupplierPaymentInput,
  MatchSupplierInvoiceInput,
  IngestSupplierInvoiceOcrInput,
  UpsertOcrColumnMappingPresetInput,
  ExpenseOutput,
  SupplierCreditSummary,
  SupplierInvoiceOutput,
  CashFlowForecast,
  ProfitLossStatement,
  AccountingWorkbookExport,
  InvoiceOcrIngestionResult,
  OcrColumnMappingPresetOutput,
  PaymentStatus,
} from './dto/accounting.types';
import {
  CfoBriefing,
  WorkingCapitalReport,
  InventoryFinancialMetrics,
  RevenueIntelligence,
  VatComplianceReport,
  InvestmentIntelligenceReport,
  FinancialPeriodInput,
} from './dto/financial-intelligence.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountingResolver {
  constructor(
    private readonly accountingService: AccountingService,
    private readonly fiService: FinancialIntelligenceService,
  ) {}

  // ── Expenses ──────────────────────────────────────────────────────────────

  @Mutation(() => ExpenseOutput, { name: 'createExpense' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician', 'cashier', 'chemical_cashier')
  createExpense(
    @Args('input') input: CreateExpenseInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<ExpenseOutput> {
    return this.accountingService.createExpense(input, actor);
  }

  // RBAC: owner, se_admin, manager only — approve/reject expenses
  @Mutation(() => ExpenseOutput, { name: 'approveExpense' })
  @Roles('owner', 'se_admin', 'manager')
  approveExpense(
    @Args('input') input: ApproveExpenseInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<ExpenseOutput> {
    return this.accountingService.approveExpense(input, actor);
  }

  @Query(() => [ExpenseOutput], { name: 'listExpenses' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician', 'cashier', 'chemical_cashier')
  listExpenses(
    @CurrentUser() actor: JwtUser,
    @Args('status', { type: () => String, nullable: true }) status?: PaymentStatus,
  ): Promise<ExpenseOutput[]> {
    return this.accountingService.listExpenses(actor, status);
  }

  // ── Supplier Credit & Invoices ────────────────────────────────────────────

  @Query(() => SupplierCreditSummary, { name: 'supplierCreditSummary' })
  @Roles('owner', 'se_admin', 'manager')
  supplierCreditSummary(
    @Args('supplierId', { type: () => ID }) supplierId: string,
    @CurrentUser() actor: JwtUser,
  ): Promise<SupplierCreditSummary> {
    return this.accountingService.getSupplierCreditSummary(supplierId, actor.branchId);
  }

  @Query(() => [SupplierInvoiceOutput], { name: 'supplierInvoices' })
  @Roles('owner', 'se_admin', 'manager')
  supplierInvoices(
    @CurrentUser() actor: JwtUser,
    @Args('supplierId', { type: () => ID, nullable: true }) supplierId?: string,
  ): Promise<SupplierInvoiceOutput[]> {
    return this.accountingService.listSupplierInvoices(actor, supplierId);
  }

  // RBAC: owner, se_admin, manager only — record payments to suppliers
  @Mutation(() => SupplierInvoiceOutput, { name: 'recordSupplierPayment' })
  @Roles('owner', 'se_admin', 'manager')
  recordSupplierPayment(
    @Args('input') input: RecordSupplierPaymentInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<SupplierInvoiceOutput> {
    return this.accountingService.recordSupplierPayment(input, actor);
  }

  // RBAC: owner, se_admin, manager only — match invoice to GRN
  @Mutation(() => SupplierInvoiceOutput, { name: 'matchSupplierInvoice' })
  @Roles('owner', 'se_admin', 'manager')
  matchSupplierInvoice(
    @Args('input') input: MatchSupplierInvoiceInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<SupplierInvoiceOutput> {
    return this.accountingService.matchSupplierInvoice(input, actor);
  }

  @Mutation(() => InvoiceOcrIngestionResult, { name: 'ingestSupplierInvoiceOcr' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'technician')
  ingestSupplierInvoiceOcr(
    @Args('input') input: IngestSupplierInvoiceOcrInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<InvoiceOcrIngestionResult> {
    return this.accountingService.ingestSupplierInvoiceOcr(input, actor);
  }

  @Query(() => [OcrColumnMappingPresetOutput], { name: 'ocrColumnMappingPresets' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'technician')
  ocrColumnMappingPresets(
    @CurrentUser() actor: JwtUser,
    @Args('supplierId', { type: () => ID, nullable: true }) supplierId?: string,
  ): Promise<OcrColumnMappingPresetOutput[]> {
    return this.accountingService.listOcrColumnMappingPresets(actor.branchId, supplierId);
  }

  @Mutation(() => OcrColumnMappingPresetOutput, { name: 'upsertOcrColumnMappingPreset' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'technician')
  upsertOcrColumnMappingPreset(
    @Args('input') input: UpsertOcrColumnMappingPresetInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<OcrColumnMappingPresetOutput> {
    return this.accountingService.upsertOcrColumnMappingPreset(input, actor);
  }

  @Mutation(() => Boolean, { name: 'deleteOcrColumnMappingPreset' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'technician')
  deleteOcrColumnMappingPreset(
    @Args('presetId', { type: () => ID }) presetId: string,
    @CurrentUser() actor: JwtUser,
  ): Promise<boolean> {
    return this.accountingService.deleteOcrColumnMappingPreset(presetId, actor);
  }

  // ── Cash Flow Intelligence ───────────────────────────────────────────────

  @Query(() => CashFlowForecast, { name: 'cashFlowForecast' })
  @Roles('owner', 'se_admin', 'manager')
  cashFlowForecast(@CurrentUser() actor: JwtUser): Promise<CashFlowForecast> {
    return this.accountingService.getCashFlowForecast(actor.branchId);
  }

  // ── Profit & Loss ─────────────────────────────────────────────────────────

  @Query(() => ProfitLossStatement, { name: 'profitLoss' })
  @Roles('owner', 'se_admin', 'manager')
  profitLoss(
    @CurrentUser() actor: JwtUser,
    @Args('periodStart') periodStart: string,
    @Args('periodEnd') periodEnd: string,
  ): Promise<ProfitLossStatement> {
    return this.accountingService.getProfitLoss(actor.branchId, periodStart, periodEnd);
  }

  @Query(() => AccountingWorkbookExport, { name: 'accountingWorkbook' })
  @Roles('owner', 'se_admin', 'manager')
  accountingWorkbook(
    @CurrentUser() actor: JwtUser,
    @Args('periodStart') periodStart: string,
    @Args('periodEnd') periodEnd: string,
  ): Promise<AccountingWorkbookExport> {
    return this.accountingService.exportAccountingWorkbook(actor, periodStart, periodEnd);
  }

  // ── Financial Intelligence Engine ─────────────────────────────────────────
  // RBAC: owner, se_admin only — full CFO-level financial briefing

  /** Complete CFO briefing — all financial analytics in one call */
  @Query(() => CfoBriefing, { name: 'cfoBriefing' })
  @Roles('owner', 'se_admin')
  cfoBriefing(@CurrentUser() actor: JwtUser): Promise<CfoBriefing> {
    return this.fiService.getCfoBriefing(actor.branchId);
  }

  /** Working capital health — current ratio, quick ratio, cash runway */
  @Query(() => WorkingCapitalReport, { name: 'workingCapital' })
  @Roles('owner', 'se_admin', 'manager')
  workingCapital(@CurrentUser() actor: JwtUser): Promise<WorkingCapitalReport> {
    return this.fiService.getWorkingCapital(actor.branchId);
  }

  /** Inventory financial efficiency — turnover, DIO, slow-moving, near-expiry, shrinkage */
  @Query(() => InventoryFinancialMetrics, { name: 'inventoryFinancialMetrics' })
  @Roles('owner', 'se_admin', 'manager')
  inventoryFinancialMetrics(@CurrentUser() actor: JwtUser): Promise<InventoryFinancialMetrics> {
    return this.fiService.getInventoryFinancialMetrics(actor.branchId);
  }

  /** Revenue intelligence — trends, MoM/YoY growth, CMGR, projection, peak hours */
  @Query(() => RevenueIntelligence, { name: 'revenueIntelligence' })
  @Roles('owner', 'se_admin', 'manager')
  revenueIntelligence(@CurrentUser() actor: JwtUser): Promise<RevenueIntelligence> {
    return this.fiService.getRevenueIntelligence(actor.branchId);
  }

  /** Ghana GRA VAT compliance report — output VAT, input VAT, net payable, filing status */
  @Query(() => VatComplianceReport, { name: 'vatCompliance' })
  @Roles('owner', 'se_admin', 'manager')
  vatCompliance(
    @CurrentUser() actor: JwtUser,
    @Args('year', { type: () => Number, nullable: true }) year?: number,
    @Args('month', { type: () => Number, nullable: true }) month?: number,
  ): Promise<VatComplianceReport> {
    const now = new Date();
    return this.fiService.getVatCompliance(
      actor.branchId,
      year ?? now.getFullYear(),
      month ?? now.getMonth() + 1,
    );
  }

  /**
   * Investment intelligence — only fires when business is profitable.
   * Recommends: inventory expansion, new branch, delivery service,
   * marketing, or Ghana T-Bills based on actual financial data.
   * RBAC: owner, se_admin only.
   */
  @Query(() => InvestmentIntelligenceReport, { name: 'investmentIntelligence' })
  @Roles('owner', 'se_admin')
  async investmentIntelligence(@CurrentUser() actor: JwtUser): Promise<InvestmentIntelligenceReport> {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = now.toISOString().split('T')[0];
    // Delegate to the full briefing and extract the investment section
    const briefing = await this.fiService.getCfoBriefing(actor.branchId);
    void monthStart; void monthEnd; // used inside getCfoBriefing
    return briefing.investmentIntelligence;
  }
}
