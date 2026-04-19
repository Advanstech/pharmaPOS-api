import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { FinancialIntelligenceService } from './financial-intelligence.service';
import { GLPostingService } from './gl-posting.service';
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
import {
  TrialBalanceRowOutput,
  BalanceSheetOutput,
  GLDetailRowOutput,
  ChartOfAccountsEntry,
  FinancialSummaryOutput,
} from './dto/gl.types';
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
    private readonly glService: GLPostingService,
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

  // ── Trial Balance ─────────────────────────────────────────────────────────

  @Query(() => [TrialBalanceRowOutput], { name: 'trialBalance' })
  @Roles('owner', 'se_admin', 'manager')
  async trialBalance(
    @Args('asOfDate', { type: () => String, nullable: true }) asOfDate: string | undefined,
    @CurrentUser() actor: JwtUser,
  ): Promise<TrialBalanceRowOutput[]> {
    return this.glService.getTrialBalance(actor.branchId, asOfDate);
  }

  // ── Balance Sheet ─────────────────────────────────────────────────────────

  @Query(() => BalanceSheetOutput, { name: 'balanceSheet' })
  @Roles('owner', 'se_admin', 'manager')
  async balanceSheet(
    @Args('asOfDate', { type: () => String, nullable: true }) asOfDate: string | undefined,
    @CurrentUser() actor: JwtUser,
  ): Promise<BalanceSheetOutput> {
    return this.glService.getBalanceSheet(actor.branchId, asOfDate) as any;
  }

  // ── GL Detail ─────────────────────────────────────────────────────────────

  @Query(() => [GLDetailRowOutput], { name: 'glDetail' })
  @Roles('owner', 'se_admin', 'manager')
  async glDetail(
    @Args('accountCode', { type: () => String, nullable: true }) accountCode: string | undefined,
    @Args('startDate', { type: () => String, nullable: true }) startDate: string | undefined,
    @Args('endDate', { type: () => String, nullable: true }) endDate: string | undefined,
    @CurrentUser() actor: JwtUser,
  ): Promise<GLDetailRowOutput[]> {
    return this.glService.getGLDetail(actor.branchId, accountCode, startDate, endDate) as any;
  }

  // ── Chart of Accounts ─────────────────────────────────────────────────────

  @Query(() => [ChartOfAccountsEntry], { name: 'chartOfAccounts' })
  @Roles('owner', 'se_admin', 'manager')
  async chartOfAccounts(@CurrentUser() actor: JwtUser): Promise<ChartOfAccountsEntry[]> {
    const trial = await this.glService.getTrialBalance(actor.branchId);

    // Define the full chart of accounts with categories
    const COA: Array<{ code: string; name: string; type: string; category: string }> = [
      { code: '1000', name: 'Cash & Bank', type: 'ASSET', category: 'Current Assets' },
      { code: '1100', name: 'Accounts Receivable', type: 'ASSET', category: 'Current Assets' },
      { code: '1200', name: 'Inventory', type: 'ASSET', category: 'Current Assets' },
      { code: '1300', name: 'Prepaid Expenses', type: 'ASSET', category: 'Current Assets' },
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY', category: 'Current Liabilities' },
      { code: '2200', name: 'VAT Payable', type: 'LIABILITY', category: 'Current Liabilities' },
      { code: '2300', name: 'NHIL Payable', type: 'LIABILITY', category: 'Current Liabilities' },
      { code: '2400', name: 'Accrued Expenses', type: 'LIABILITY', category: 'Current Liabilities' },
      { code: '3000', name: "Owner's Capital", type: 'EQUITY', category: 'Equity' },
      { code: '3100', name: 'Retained Earnings', type: 'EQUITY', category: 'Equity' },
      { code: '4000', name: 'Sales Revenue', type: 'REVENUE', category: 'Revenue' },
      { code: '4100', name: 'OTC / Chemical Revenue', type: 'REVENUE', category: 'Revenue' },
      { code: '4200', name: 'Other Income', type: 'REVENUE', category: 'Revenue' },
      { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE', category: 'Cost of Sales' },
      { code: '5010', name: 'Inventory Shrinkage', type: 'EXPENSE', category: 'Cost of Sales' },
      { code: '5020', name: 'Expired Stock Write-off', type: 'EXPENSE', category: 'Cost of Sales' },
      { code: '5050', name: 'Taxes & Levies', type: 'EXPENSE', category: 'Operating Expenses' },
      { code: '5100', name: 'Utilities', type: 'EXPENSE', category: 'Operating Expenses' },
      { code: '5200', name: 'Rent', type: 'EXPENSE', category: 'Operating Expenses' },
      { code: '5300', name: 'Salaries & Wages', type: 'EXPENSE', category: 'Operating Expenses' },
      { code: '5400', name: 'Fuel & Transport', type: 'EXPENSE', category: 'Operating Expenses' },
      { code: '5500', name: 'Maintenance & Repairs', type: 'EXPENSE', category: 'Operating Expenses' },
      { code: '5600', name: 'Marketing & Advertising', type: 'EXPENSE', category: 'Operating Expenses' },
      { code: '5700', name: 'Licenses & Permits', type: 'EXPENSE', category: 'Operating Expenses' },
      { code: '5800', name: 'Bank Charges & MoMo Fees', type: 'EXPENSE', category: 'Operating Expenses' },
      { code: '5900', name: 'Miscellaneous', type: 'EXPENSE', category: 'Operating Expenses' },
    ];

    const balanceMap = new Map(trial.map(r => [r.accountCode, r.balance]));

    return COA.map(a => ({
      accountCode: a.code,
      accountName: a.name,
      accountType: a.type,
      category: a.category,
      balancePesewas: Math.abs(balanceMap.get(a.code) || 0),
      balanceFormatted: 'GH\u20B5' + (Math.abs(balanceMap.get(a.code) || 0) / 100).toFixed(2),
    }));
  }

  // ── Financial Summary (for dashboard) ─────────────────────────────────────

  @Query(() => FinancialSummaryOutput, { name: 'financialSummary' })
  @Roles('owner', 'se_admin', 'manager')
  async financialSummary(
    @Args('periodStart') periodStart: string,
    @Args('periodEnd') periodEnd: string,
    @CurrentUser() actor: JwtUser,
  ): Promise<FinancialSummaryOutput> {
    const branchId = actor.branchId;

    // Get P&L from existing service
    const pl = await this.accountingService.getProfitLoss(branchId, periodStart, periodEnd);

    // Get cash balance from GL
    const [cashRow] = await this.glService['dataSource'].query(
      `SELECT COALESCE(SUM(debit) - SUM(credit), 0)::int AS balance
       FROM general_ledger WHERE branch_id = $1 AND account_code = '1000'`,
      [branchId],
    ) as Array<{ balance: number }>;

    // Get accounts payable from GL
    const [apRow] = await this.glService['dataSource'].query(
      `SELECT COALESCE(SUM(credit) - SUM(debit), 0)::int AS balance
       FROM general_ledger WHERE branch_id = $1 AND account_code = '2100'`,
      [branchId],
    ) as Array<{ balance: number }>;

    // Get VAT payable from GL
    const [vatRow] = await this.glService['dataSource'].query(
      `SELECT COALESCE(SUM(credit) - SUM(debit), 0)::int AS balance
       FROM general_ledger WHERE branch_id = $1 AND account_code = '2200'`,
      [branchId],
    ) as Array<{ balance: number }>;

    // Get inventory value from GL
    const [invRow] = await this.glService['dataSource'].query(
      `SELECT COALESCE(SUM(debit) - SUM(credit), 0)::int AS balance
       FROM general_ledger WHERE branch_id = $1 AND account_code = '1200'`,
      [branchId],
    ) as Array<{ balance: number }>;

    // Transaction counts
    const [txRow] = await this.glService['dataSource'].query(
      `SELECT COUNT(*)::int AS cnt FROM sales
       WHERE branch_id = $1 AND status = 'COMPLETED'
       AND created_at >= $2::date AND created_at < ($3::date + INTERVAL '1 day')`,
      [branchId, periodStart, periodEnd],
    ) as Array<{ cnt: number }>;

    // Expense counts
    const [expRow] = await this.glService['dataSource'].query(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending
       FROM staff_expenses WHERE branch_id = $1`,
      [branchId],
    ) as Array<{ total: number; pending: number }>;

    const fmt = (p: number) => 'GH\u20B5' + (p / 100).toFixed(2);

    return {
      periodStart,
      periodEnd,
      revenuePesewas: pl.revenuePesewas,
      revenueFormatted: pl.revenueFormatted,
      cogsPesewas: pl.cogsPesewas,
      cogsFormatted: pl.cogsFormatted,
      grossProfitPesewas: pl.grossProfitPesewas,
      grossProfitFormatted: pl.grossProfitFormatted,
      grossMarginPct: pl.grossProfitMarginPct,
      operatingExpensesPesewas: pl.operatingExpensesPesewas,
      operatingExpensesFormatted: pl.operatingExpensesFormatted,
      netProfitPesewas: pl.netProfitPesewas,
      netProfitFormatted: pl.netProfitFormatted,
      netMarginPct: pl.netProfitMarginPct,
      cashBalancePesewas: cashRow?.balance || 0,
      cashBalanceFormatted: fmt(cashRow?.balance || 0),
      accountsPayablePesewas: apRow?.balance || 0,
      accountsPayableFormatted: fmt(apRow?.balance || 0),
      vatPayablePesewas: vatRow?.balance || 0,
      vatPayableFormatted: fmt(vatRow?.balance || 0),
      inventoryValuePesewas: invRow?.balance || 0,
      inventoryValueFormatted: fmt(invRow?.balance || 0),
      totalTransactions: txRow?.cnt || 0,
      totalExpenses: expRow?.total || 0,
      pendingExpenses: expRow?.pending || 0,
    };
  }
}
