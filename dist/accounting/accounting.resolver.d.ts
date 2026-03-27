import { AccountingService } from './accounting.service';
import { FinancialIntelligenceService } from './financial-intelligence.service';
import { CreateExpenseInput, ApproveExpenseInput, RecordSupplierPaymentInput, MatchSupplierInvoiceInput, IngestSupplierInvoiceOcrInput, UpsertOcrColumnMappingPresetInput, ExpenseOutput, SupplierCreditSummary, SupplierInvoiceOutput, CashFlowForecast, ProfitLossStatement, InvoiceOcrIngestionResult, OcrColumnMappingPresetOutput, PaymentStatus } from './dto/accounting.types';
import { CfoBriefing, WorkingCapitalReport, InventoryFinancialMetrics, RevenueIntelligence, VatComplianceReport, InvestmentIntelligenceReport } from './dto/financial-intelligence.types';
import { JwtUser } from '../auth/decorators/current-user.decorator';
export declare class AccountingResolver {
    private readonly accountingService;
    private readonly fiService;
    constructor(accountingService: AccountingService, fiService: FinancialIntelligenceService);
    createExpense(input: CreateExpenseInput, actor: JwtUser): Promise<ExpenseOutput>;
    approveExpense(input: ApproveExpenseInput, actor: JwtUser): Promise<ExpenseOutput>;
    listExpenses(actor: JwtUser, status?: PaymentStatus): Promise<ExpenseOutput[]>;
    supplierCreditSummary(supplierId: string, actor: JwtUser): Promise<SupplierCreditSummary>;
    supplierInvoices(actor: JwtUser, supplierId?: string): Promise<SupplierInvoiceOutput[]>;
    recordSupplierPayment(input: RecordSupplierPaymentInput, actor: JwtUser): Promise<SupplierInvoiceOutput>;
    matchSupplierInvoice(input: MatchSupplierInvoiceInput, actor: JwtUser): Promise<SupplierInvoiceOutput>;
    ingestSupplierInvoiceOcr(input: IngestSupplierInvoiceOcrInput, actor: JwtUser): Promise<InvoiceOcrIngestionResult>;
    ocrColumnMappingPresets(actor: JwtUser, supplierId?: string): Promise<OcrColumnMappingPresetOutput[]>;
    upsertOcrColumnMappingPreset(input: UpsertOcrColumnMappingPresetInput, actor: JwtUser): Promise<OcrColumnMappingPresetOutput>;
    deleteOcrColumnMappingPreset(presetId: string, actor: JwtUser): Promise<boolean>;
    cashFlowForecast(actor: JwtUser): Promise<CashFlowForecast>;
    profitLoss(actor: JwtUser, periodStart: string, periodEnd: string): Promise<ProfitLossStatement>;
    cfoBriefing(actor: JwtUser): Promise<CfoBriefing>;
    workingCapital(actor: JwtUser): Promise<WorkingCapitalReport>;
    inventoryFinancialMetrics(actor: JwtUser): Promise<InventoryFinancialMetrics>;
    revenueIntelligence(actor: JwtUser): Promise<RevenueIntelligence>;
    vatCompliance(actor: JwtUser, year?: number, month?: number): Promise<VatComplianceReport>;
    investmentIntelligence(actor: JwtUser): Promise<InvestmentIntelligenceReport>;
}
