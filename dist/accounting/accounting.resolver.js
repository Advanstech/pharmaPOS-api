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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountingResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const common_1 = require("@nestjs/common");
const accounting_service_1 = require("./accounting.service");
const financial_intelligence_service_1 = require("./financial-intelligence.service");
const accounting_types_1 = require("./dto/accounting.types");
const financial_intelligence_types_1 = require("./dto/financial-intelligence.types");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
let AccountingResolver = class AccountingResolver {
    constructor(accountingService, fiService) {
        this.accountingService = accountingService;
        this.fiService = fiService;
    }
    createExpense(input, actor) {
        return this.accountingService.createExpense(input, actor);
    }
    approveExpense(input, actor) {
        return this.accountingService.approveExpense(input, actor);
    }
    listExpenses(actor, status) {
        return this.accountingService.listExpenses(actor, status);
    }
    supplierCreditSummary(supplierId, actor) {
        return this.accountingService.getSupplierCreditSummary(supplierId, actor.branchId);
    }
    supplierInvoices(actor, supplierId) {
        return this.accountingService.listSupplierInvoices(actor, supplierId);
    }
    recordSupplierPayment(input, actor) {
        return this.accountingService.recordSupplierPayment(input, actor);
    }
    matchSupplierInvoice(input, actor) {
        return this.accountingService.matchSupplierInvoice(input, actor);
    }
    ingestSupplierInvoiceOcr(input, actor) {
        return this.accountingService.ingestSupplierInvoiceOcr(input, actor);
    }
    ocrColumnMappingPresets(actor, supplierId) {
        return this.accountingService.listOcrColumnMappingPresets(actor.branchId, supplierId);
    }
    upsertOcrColumnMappingPreset(input, actor) {
        return this.accountingService.upsertOcrColumnMappingPreset(input, actor);
    }
    deleteOcrColumnMappingPreset(presetId, actor) {
        return this.accountingService.deleteOcrColumnMappingPreset(presetId, actor);
    }
    cashFlowForecast(actor) {
        return this.accountingService.getCashFlowForecast(actor.branchId);
    }
    profitLoss(actor, periodStart, periodEnd) {
        return this.accountingService.getProfitLoss(actor.branchId, periodStart, periodEnd);
    }
    accountingWorkbook(actor, periodStart, periodEnd) {
        return this.accountingService.exportAccountingWorkbook(actor, periodStart, periodEnd);
    }
    cfoBriefing(actor) {
        return this.fiService.getCfoBriefing(actor.branchId);
    }
    workingCapital(actor) {
        return this.fiService.getWorkingCapital(actor.branchId);
    }
    inventoryFinancialMetrics(actor) {
        return this.fiService.getInventoryFinancialMetrics(actor.branchId);
    }
    revenueIntelligence(actor) {
        return this.fiService.getRevenueIntelligence(actor.branchId);
    }
    vatCompliance(actor, year, month) {
        const now = new Date();
        return this.fiService.getVatCompliance(actor.branchId, year !== null && year !== void 0 ? year : now.getFullYear(), month !== null && month !== void 0 ? month : now.getMonth() + 1);
    }
    async investmentIntelligence(actor) {
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const monthEnd = now.toISOString().split('T')[0];
        const briefing = await this.fiService.getCfoBriefing(actor.branchId);
        void monthStart;
        void monthEnd;
        return briefing.investmentIntelligence;
    }
};
exports.AccountingResolver = AccountingResolver;
__decorate([
    (0, graphql_1.Mutation)(() => accounting_types_1.ExpenseOutput, { name: 'createExpense' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician', 'cashier', 'chemical_cashier'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [accounting_types_1.CreateExpenseInput, Object]),
    __metadata("design:returntype", Promise)
], AccountingResolver.prototype, "createExpense", null);
__decorate([
    (0, graphql_1.Mutation)(() => accounting_types_1.ExpenseOutput, { name: 'approveExpense' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [accounting_types_1.ApproveExpenseInput, Object]),
    __metadata("design:returntype", Promise)
], AccountingResolver.prototype, "approveExpense", null);
__decorate([
    (0, graphql_1.Query)(() => [accounting_types_1.ExpenseOutput], { name: 'listExpenses' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician', 'cashier', 'chemical_cashier'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, graphql_1.Args)('status', { type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AccountingResolver.prototype, "listExpenses", null);
__decorate([
    (0, graphql_1.Query)(() => accounting_types_1.SupplierCreditSummary, { name: 'supplierCreditSummary' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, graphql_1.Args)('supplierId', { type: () => graphql_1.ID })),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AccountingResolver.prototype, "supplierCreditSummary", null);
__decorate([
    (0, graphql_1.Query)(() => [accounting_types_1.SupplierInvoiceOutput], { name: 'supplierInvoices' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, graphql_1.Args)('supplierId', { type: () => graphql_1.ID, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AccountingResolver.prototype, "supplierInvoices", null);
__decorate([
    (0, graphql_1.Mutation)(() => accounting_types_1.SupplierInvoiceOutput, { name: 'recordSupplierPayment' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [accounting_types_1.RecordSupplierPaymentInput, Object]),
    __metadata("design:returntype", Promise)
], AccountingResolver.prototype, "recordSupplierPayment", null);
__decorate([
    (0, graphql_1.Mutation)(() => accounting_types_1.SupplierInvoiceOutput, { name: 'matchSupplierInvoice' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [accounting_types_1.MatchSupplierInvoiceInput, Object]),
    __metadata("design:returntype", Promise)
], AccountingResolver.prototype, "matchSupplierInvoice", null);
__decorate([
    (0, graphql_1.Mutation)(() => accounting_types_1.InvoiceOcrIngestionResult, { name: 'ingestSupplierInvoiceOcr' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'technician'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [accounting_types_1.IngestSupplierInvoiceOcrInput, Object]),
    __metadata("design:returntype", Promise)
], AccountingResolver.prototype, "ingestSupplierInvoiceOcr", null);
__decorate([
    (0, graphql_1.Query)(() => [accounting_types_1.OcrColumnMappingPresetOutput], { name: 'ocrColumnMappingPresets' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'technician'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, graphql_1.Args)('supplierId', { type: () => graphql_1.ID, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AccountingResolver.prototype, "ocrColumnMappingPresets", null);
__decorate([
    (0, graphql_1.Mutation)(() => accounting_types_1.OcrColumnMappingPresetOutput, { name: 'upsertOcrColumnMappingPreset' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'technician'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [accounting_types_1.UpsertOcrColumnMappingPresetInput, Object]),
    __metadata("design:returntype", Promise)
], AccountingResolver.prototype, "upsertOcrColumnMappingPreset", null);
__decorate([
    (0, graphql_1.Mutation)(() => Boolean, { name: 'deleteOcrColumnMappingPreset' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'technician'),
    __param(0, (0, graphql_1.Args)('presetId', { type: () => graphql_1.ID })),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AccountingResolver.prototype, "deleteOcrColumnMappingPreset", null);
__decorate([
    (0, graphql_1.Query)(() => accounting_types_1.CashFlowForecast, { name: 'cashFlowForecast' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AccountingResolver.prototype, "cashFlowForecast", null);
__decorate([
    (0, graphql_1.Query)(() => accounting_types_1.ProfitLossStatement, { name: 'profitLoss' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, graphql_1.Args)('periodStart')),
    __param(2, (0, graphql_1.Args)('periodEnd')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], AccountingResolver.prototype, "profitLoss", null);
__decorate([
    (0, graphql_1.Query)(() => accounting_types_1.AccountingWorkbookExport, { name: 'accountingWorkbook' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, graphql_1.Args)('periodStart')),
    __param(2, (0, graphql_1.Args)('periodEnd')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], AccountingResolver.prototype, "accountingWorkbook", null);
__decorate([
    (0, graphql_1.Query)(() => financial_intelligence_types_1.CfoBriefing, { name: 'cfoBriefing' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AccountingResolver.prototype, "cfoBriefing", null);
__decorate([
    (0, graphql_1.Query)(() => financial_intelligence_types_1.WorkingCapitalReport, { name: 'workingCapital' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AccountingResolver.prototype, "workingCapital", null);
__decorate([
    (0, graphql_1.Query)(() => financial_intelligence_types_1.InventoryFinancialMetrics, { name: 'inventoryFinancialMetrics' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AccountingResolver.prototype, "inventoryFinancialMetrics", null);
__decorate([
    (0, graphql_1.Query)(() => financial_intelligence_types_1.RevenueIntelligence, { name: 'revenueIntelligence' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AccountingResolver.prototype, "revenueIntelligence", null);
__decorate([
    (0, graphql_1.Query)(() => financial_intelligence_types_1.VatComplianceReport, { name: 'vatCompliance' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, graphql_1.Args)('year', { type: () => Number, nullable: true })),
    __param(2, (0, graphql_1.Args)('month', { type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", Promise)
], AccountingResolver.prototype, "vatCompliance", null);
__decorate([
    (0, graphql_1.Query)(() => financial_intelligence_types_1.InvestmentIntelligenceReport, { name: 'investmentIntelligence' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AccountingResolver.prototype, "investmentIntelligence", null);
exports.AccountingResolver = AccountingResolver = __decorate([
    (0, graphql_1.Resolver)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [accounting_service_1.AccountingService,
        financial_intelligence_service_1.FinancialIntelligenceService])
], AccountingResolver);
//# sourceMappingURL=accounting.resolver.js.map