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
exports.OcrColumnMappingPresetOutput = exports.OcrColumnMappingPair = exports.InvoiceOcrIngestionResult = exports.AccountingWorkbookExport = exports.ProfitLossStatement = exports.CashFlowForecast = exports.SupplierInvoiceOutput = exports.SupplierCreditSummary = exports.ExpenseOutput = exports.UpsertOcrColumnMappingPresetInput = exports.OcrColumnMappingPairInput = exports.IngestSupplierInvoiceOcrInput = exports.SupplierInvoiceOcrLineInput = exports.MatchSupplierInvoiceInput = exports.RecordSupplierPaymentInput = exports.ApproveExpenseInput = exports.CreateExpenseInput = exports.PaymentStatus = exports.ExpenseCategory = void 0;
const graphql_1 = require("@nestjs/graphql");
const class_validator_1 = require("class-validator");
var ExpenseCategory;
(function (ExpenseCategory) {
    ExpenseCategory["UTILITIES"] = "UTILITIES";
    ExpenseCategory["RENT"] = "RENT";
    ExpenseCategory["SALARIES"] = "SALARIES";
    ExpenseCategory["FUEL"] = "FUEL";
    ExpenseCategory["MAINTENANCE"] = "MAINTENANCE";
    ExpenseCategory["MARKETING"] = "MARKETING";
    ExpenseCategory["LICENSES"] = "LICENSES";
    ExpenseCategory["BANK_CHARGES"] = "BANK_CHARGES";
    ExpenseCategory["MISCELLANEOUS"] = "MISCELLANEOUS";
})(ExpenseCategory || (exports.ExpenseCategory = ExpenseCategory = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING"] = "PENDING";
    PaymentStatus["APPROVED"] = "APPROVED";
    PaymentStatus["PAID"] = "PAID";
    PaymentStatus["REJECTED"] = "REJECTED";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
let CreateExpenseInput = class CreateExpenseInput {
};
exports.CreateExpenseInput = CreateExpenseInput;
__decorate([
    (0, graphql_1.Field)(() => String, { description: 'Expense category' }),
    (0, class_validator_1.IsEnum)(ExpenseCategory),
    __metadata("design:type", String)
], CreateExpenseInput.prototype, "category", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Amount in GHS pesewas' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreateExpenseInput.prototype, "amountPesewas", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Description of the expense. Example: "Electricity bill — March 2026"' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateExpenseInput.prototype, "description", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'S3 key of the uploaded receipt/invoice PDF or image',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateExpenseInput.prototype, "receiptS3Key", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Date the expense was incurred (ISO 8601). Defaults to today.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateExpenseInput.prototype, "expenseDate", void 0);
exports.CreateExpenseInput = CreateExpenseInput = __decorate([
    (0, graphql_1.InputType)({ description: 'Record a staff expense — requires manager/owner approval before payment' })
], CreateExpenseInput);
let ApproveExpenseInput = class ApproveExpenseInput {
};
exports.ApproveExpenseInput = ApproveExpenseInput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the expense to approve/reject' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ApproveExpenseInput.prototype, "expenseId", void 0);
__decorate([
    (0, graphql_1.Field)(() => String, { description: 'APPROVED or REJECTED' }),
    (0, class_validator_1.IsEnum)(PaymentStatus),
    __metadata("design:type", String)
], ApproveExpenseInput.prototype, "status", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Optional notes from the approver',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ApproveExpenseInput.prototype, "notes", void 0);
exports.ApproveExpenseInput = ApproveExpenseInput = __decorate([
    (0, graphql_1.InputType)({ description: 'Approve or reject a pending expense' })
], ApproveExpenseInput);
let RecordSupplierPaymentInput = class RecordSupplierPaymentInput {
};
exports.RecordSupplierPaymentInput = RecordSupplierPaymentInput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the supplier invoice being paid' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RecordSupplierPaymentInput.prototype, "invoiceId", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Amount paid in GHS pesewas' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], RecordSupplierPaymentInput.prototype, "amountPesewas", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Payment method. Example: CASH, MTN_MOMO, BANK_TRANSFER' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecordSupplierPaymentInput.prototype, "paymentMethod", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Payment reference (MoMo transaction ID, bank reference, cheque number)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecordSupplierPaymentInput.prototype, "reference", void 0);
exports.RecordSupplierPaymentInput = RecordSupplierPaymentInput = __decorate([
    (0, graphql_1.InputType)({ description: 'Record a payment to a supplier against an invoice' })
], RecordSupplierPaymentInput);
let MatchSupplierInvoiceInput = class MatchSupplierInvoiceInput {
};
exports.MatchSupplierInvoiceInput = MatchSupplierInvoiceInput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the supplier invoice' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MatchSupplierInvoiceInput.prototype, "invoiceId", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the GRN (Goods Received Note) to match against' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MatchSupplierInvoiceInput.prototype, "grnId", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Optional notes about the match (e.g., discrepancies found)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MatchSupplierInvoiceInput.prototype, "notes", void 0);
exports.MatchSupplierInvoiceInput = MatchSupplierInvoiceInput = __decorate([
    (0, graphql_1.InputType)({ description: 'Match a supplier invoice to a GRN (3-way match: PO → GRN → Invoice)' })
], MatchSupplierInvoiceInput);
let SupplierInvoiceOcrLineInput = class SupplierInvoiceOcrLineInput {
};
exports.SupplierInvoiceOcrLineInput = SupplierInvoiceOcrLineInput;
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Raw OCR line text for audit/reference.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SupplierInvoiceOcrLineInput.prototype, "rawText", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Supplier barcode/pack code parsed from OCR.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SupplierInvoiceOcrLineInput.prototype, "barcode", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Parsed product name from invoice line.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SupplierInvoiceOcrLineInput.prototype, "productName", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { nullable: true, description: 'Resolved product UUID when OCR pipeline already matched catalog.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SupplierInvoiceOcrLineInput.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { nullable: true, description: 'Quantity parsed from the line.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], SupplierInvoiceOcrLineInput.prototype, "quantity", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { nullable: true, description: 'Unit cost in GHS pesewas parsed from OCR.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], SupplierInvoiceOcrLineInput.prototype, "unitCostPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { nullable: true, description: 'Line total in GHS pesewas (used to infer unit cost when missing).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], SupplierInvoiceOcrLineInput.prototype, "lineTotalPesewas", void 0);
exports.SupplierInvoiceOcrLineInput = SupplierInvoiceOcrLineInput = __decorate([
    (0, graphql_1.InputType)({ description: 'A single OCR-extracted supplier invoice line item.' })
], SupplierInvoiceOcrLineInput);
let IngestSupplierInvoiceOcrInput = class IngestSupplierInvoiceOcrInput {
};
exports.IngestSupplierInvoiceOcrInput = IngestSupplierInvoiceOcrInput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'Supplier invoice UUID to enrich.' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], IngestSupplierInvoiceOcrInput.prototype, "invoiceId", void 0);
__decorate([
    (0, graphql_1.Field)(() => [SupplierInvoiceOcrLineInput], { description: 'OCR extracted line items.' }),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], IngestSupplierInvoiceOcrInput.prototype, "lines", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'OCR engine identifier/version. Example: azure-form-recognizer-v4.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], IngestSupplierInvoiceOcrInput.prototype, "parser", void 0);
exports.IngestSupplierInvoiceOcrInput = IngestSupplierInvoiceOcrInput = __decorate([
    (0, graphql_1.InputType)({
        description: 'Persist OCR extracted invoice lines and ingest matched unit costs into product cost history ' +
            'for pricing autofill.',
    })
], IngestSupplierInvoiceOcrInput);
let OcrColumnMappingPairInput = class OcrColumnMappingPairInput {
};
exports.OcrColumnMappingPairInput = OcrColumnMappingPairInput;
__decorate([
    (0, graphql_1.Field)({ description: 'Source column header (normalized server-side).' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], OcrColumnMappingPairInput.prototype, "sourceHeader", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Target field key. Allowed values: productName | barcode | productId | quantity | unitCostGhs | unitCostPesewas | lineTotalGhs | lineTotalPesewas | rawText | ignore',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], OcrColumnMappingPairInput.prototype, "targetField", void 0);
exports.OcrColumnMappingPairInput = OcrColumnMappingPairInput = __decorate([
    (0, graphql_1.InputType)({ description: 'Single column mapping from spreadsheet source header to OCR target field.' })
], OcrColumnMappingPairInput);
let UpsertOcrColumnMappingPresetInput = class UpsertOcrColumnMappingPresetInput {
};
exports.UpsertOcrColumnMappingPresetInput = UpsertOcrColumnMappingPresetInput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { nullable: true, description: 'Preset UUID to update; omit to create.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertOcrColumnMappingPresetInput.prototype, "presetId", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { nullable: true, description: 'Optional supplier UUID for supplier-specific presets.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertOcrColumnMappingPresetInput.prototype, "supplierId", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Preset display name.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpsertOcrColumnMappingPresetInput.prototype, "name", void 0);
__decorate([
    (0, graphql_1.Field)(() => [OcrColumnMappingPairInput], { description: 'Column mapping pairs.' }),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], UpsertOcrColumnMappingPresetInput.prototype, "mappings", void 0);
exports.UpsertOcrColumnMappingPresetInput = UpsertOcrColumnMappingPresetInput = __decorate([
    (0, graphql_1.InputType)({
        description: 'Create or update a branch-shared OCR column mapping preset for spreadsheet imports.',
    })
], UpsertOcrColumnMappingPresetInput);
let ExpenseOutput = class ExpenseOutput {
};
exports.ExpenseOutput = ExpenseOutput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], ExpenseOutput.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], ExpenseOutput.prototype, "branchId", void 0);
__decorate([
    (0, graphql_1.Field)(() => String),
    __metadata("design:type", String)
], ExpenseOutput.prototype, "category", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Amount in GHS pesewas' }),
    __metadata("design:type", Number)
], ExpenseOutput.prototype, "amountPesewas", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Formatted amount. Example: GH₵150.00' }),
    __metadata("design:type", String)
], ExpenseOutput.prototype, "amountFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], ExpenseOutput.prototype, "description", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], ExpenseOutput.prototype, "receiptS3Key", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Date)
], ExpenseOutput.prototype, "expenseDate", void 0);
__decorate([
    (0, graphql_1.Field)(() => String),
    __metadata("design:type", String)
], ExpenseOutput.prototype, "status", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], ExpenseOutput.prototype, "createdBy", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], ExpenseOutput.prototype, "createdByName", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { nullable: true }),
    __metadata("design:type", String)
], ExpenseOutput.prototype, "approvedBy", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], ExpenseOutput.prototype, "approvedByName", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], ExpenseOutput.prototype, "approvalNotes", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Date)
], ExpenseOutput.prototype, "createdAt", void 0);
exports.ExpenseOutput = ExpenseOutput = __decorate([
    (0, graphql_1.ObjectType)({ description: 'An expense record — staff expenses requiring approval' })
], ExpenseOutput);
let SupplierCreditSummary = class SupplierCreditSummary {
};
exports.SupplierCreditSummary = SupplierCreditSummary;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], SupplierCreditSummary.prototype, "supplierId", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], SupplierCreditSummary.prototype, "supplierName", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Total outstanding balance in GHS pesewas' }),
    __metadata("design:type", Number)
], SupplierCreditSummary.prototype, "outstandingBalancePesewas", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Formatted balance. Example: GH₵12,500.00' }),
    __metadata("design:type", String)
], SupplierCreditSummary.prototype, "outstandingBalanceFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Amount overdue (past due date) in GHS pesewas' }),
    __metadata("design:type", Number)
], SupplierCreditSummary.prototype, "overduePesewas", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Formatted overdue amount' }),
    __metadata("design:type", String)
], SupplierCreditSummary.prototype, "overdueFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Number of unpaid invoices' }),
    __metadata("design:type", Number)
], SupplierCreditSummary.prototype, "unpaidInvoiceCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Number of overdue invoices' }),
    __metadata("design:type", Number)
], SupplierCreditSummary.prototype, "overdueInvoiceCount", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Next payment due date (earliest unpaid invoice)' }),
    __metadata("design:type", Date)
], SupplierCreditSummary.prototype, "nextPaymentDue", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Credit limit in GHS pesewas (from supplier record)' }),
    __metadata("design:type", Number)
], SupplierCreditSummary.prototype, "creditLimitPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Credit utilization % (outstanding / credit_limit * 100)' }),
    __metadata("design:type", Number)
], SupplierCreditSummary.prototype, "creditUtilizationPct", void 0);
exports.SupplierCreditSummary = SupplierCreditSummary = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Supplier credit balance and aging summary' })
], SupplierCreditSummary);
let SupplierInvoiceOutput = class SupplierInvoiceOutput {
};
exports.SupplierInvoiceOutput = SupplierInvoiceOutput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], SupplierInvoiceOutput.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], SupplierInvoiceOutput.prototype, "supplierId", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], SupplierInvoiceOutput.prototype, "supplierName", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], SupplierInvoiceOutput.prototype, "branchId", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { nullable: true }),
    __metadata("design:type", String)
], SupplierInvoiceOutput.prototype, "grnId", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], SupplierInvoiceOutput.prototype, "invoiceNumber", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Date)
], SupplierInvoiceOutput.prototype, "invoiceDate", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", Date)
], SupplierInvoiceOutput.prototype, "dueDate", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], SupplierInvoiceOutput.prototype, "totalAmountPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], SupplierInvoiceOutput.prototype, "totalAmountFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], SupplierInvoiceOutput.prototype, "paidAmountPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], SupplierInvoiceOutput.prototype, "paidAmountFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Remaining balance = total - paid' }),
    __metadata("design:type", Number)
], SupplierInvoiceOutput.prototype, "balancePesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], SupplierInvoiceOutput.prototype, "balanceFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => String, { description: 'PENDING | MATCHED | PARTIAL | PAID | OVERDUE' }),
    __metadata("design:type", String)
], SupplierInvoiceOutput.prototype, "status", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], SupplierInvoiceOutput.prototype, "s3PdfKey", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Date)
], SupplierInvoiceOutput.prototype, "createdAt", void 0);
exports.SupplierInvoiceOutput = SupplierInvoiceOutput = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Supplier invoice with payment status' })
], SupplierInvoiceOutput);
let CashFlowForecast = class CashFlowForecast {
};
exports.CashFlowForecast = CashFlowForecast;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Current cash on hand in GHS pesewas' }),
    __metadata("design:type", Number)
], CashFlowForecast.prototype, "currentCashPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], CashFlowForecast.prototype, "currentCashFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Total supplier payables due in next 7 days' }),
    __metadata("design:type", Number)
], CashFlowForecast.prototype, "payablesDue7DaysPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], CashFlowForecast.prototype, "payablesDue7DaysFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Total supplier payables due in next 30 days' }),
    __metadata("design:type", Number)
], CashFlowForecast.prototype, "payablesDue30DaysPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], CashFlowForecast.prototype, "payablesDue30DaysFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Projected revenue in next 7 days (based on 30-day avg daily sales)' }),
    __metadata("design:type", Number)
], CashFlowForecast.prototype, "projectedRevenue7DaysPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], CashFlowForecast.prototype, "projectedRevenue7DaysFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Projected revenue in next 30 days' }),
    __metadata("design:type", Number)
], CashFlowForecast.prototype, "projectedRevenue30DaysPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], CashFlowForecast.prototype, "projectedRevenue30DaysFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Cash runway in days (current cash / avg daily expenses)' }),
    __metadata("design:type", Number)
], CashFlowForecast.prototype, "cashRunwayDays", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Recommendation: PAY_NOW | WAIT_7_DAYS | WAIT_30_DAYS | NEGOTIATE_EXTENSION | CRITICAL_LOW_CASH',
    }),
    __metadata("design:type", String)
], CashFlowForecast.prototype, "recommendation", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Human-readable explanation of the recommendation' }),
    __metadata("design:type", String)
], CashFlowForecast.prototype, "recommendationReason", void 0);
exports.CashFlowForecast = CashFlowForecast = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Cash flow intelligence — predict when to pay suppliers based on sales velocity' })
], CashFlowForecast);
let ProfitLossStatement = class ProfitLossStatement {
};
exports.ProfitLossStatement = ProfitLossStatement;
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], ProfitLossStatement.prototype, "periodStart", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], ProfitLossStatement.prototype, "periodEnd", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Total revenue (sales) in GHS pesewas' }),
    __metadata("design:type", Number)
], ProfitLossStatement.prototype, "revenuePesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], ProfitLossStatement.prototype, "revenueFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Cost of goods sold (COGS) — supplier invoices matched to sales' }),
    __metadata("design:type", Number)
], ProfitLossStatement.prototype, "cogsPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], ProfitLossStatement.prototype, "cogsFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Gross profit = revenue - COGS' }),
    __metadata("design:type", Number)
], ProfitLossStatement.prototype, "grossProfitPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], ProfitLossStatement.prototype, "grossProfitFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Gross profit margin % = (gross profit / revenue) * 100' }),
    __metadata("design:type", Number)
], ProfitLossStatement.prototype, "grossProfitMarginPct", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Total operating expenses (salaries, rent, utilities, etc.)' }),
    __metadata("design:type", Number)
], ProfitLossStatement.prototype, "operatingExpensesPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], ProfitLossStatement.prototype, "operatingExpensesFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Net profit = gross profit - operating expenses' }),
    __metadata("design:type", Number)
], ProfitLossStatement.prototype, "netProfitPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], ProfitLossStatement.prototype, "netProfitFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Net profit margin % = (net profit / revenue) * 100' }),
    __metadata("design:type", Number)
], ProfitLossStatement.prototype, "netProfitMarginPct", void 0);
exports.ProfitLossStatement = ProfitLossStatement = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Profit & Loss statement for a period' })
], ProfitLossStatement);
let AccountingWorkbookExport = class AccountingWorkbookExport {
};
exports.AccountingWorkbookExport = AccountingWorkbookExport;
__decorate([
    (0, graphql_1.Field)({ description: 'Suggested file name for the exported workbook' }),
    __metadata("design:type", String)
], AccountingWorkbookExport.prototype, "fileName", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'MIME type for Excel workbook' }),
    __metadata("design:type", String)
], AccountingWorkbookExport.prototype, "mimeType", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Base64 encoded XLSX binary content' }),
    __metadata("design:type", String)
], AccountingWorkbookExport.prototype, "base64Content", void 0);
exports.AccountingWorkbookExport = AccountingWorkbookExport = __decorate([
    (0, graphql_1.ObjectType)({
        description: 'Excel workbook export payload for accounting. `base64Content` should be decoded and saved as .xlsx on the client.',
    })
], AccountingWorkbookExport);
let InvoiceOcrIngestionResult = class InvoiceOcrIngestionResult {
};
exports.InvoiceOcrIngestionResult = InvoiceOcrIngestionResult;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], InvoiceOcrIngestionResult.prototype, "invoiceId", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], InvoiceOcrIngestionResult.prototype, "totalLines", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], InvoiceOcrIngestionResult.prototype, "matchedLines", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], InvoiceOcrIngestionResult.prototype, "unmatchedLines", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Number of product_cost_history rows created from OCR invoice lines.' }),
    __metadata("design:type", Number)
], InvoiceOcrIngestionResult.prototype, "costSnapshotsCreated", void 0);
__decorate([
    (0, graphql_1.Field)(() => [String], {
        description: 'Unmatched line hints so web can show user review actions (e.g. map product manually).',
    }),
    __metadata("design:type", Array)
], InvoiceOcrIngestionResult.prototype, "unmatchedHints", void 0);
exports.InvoiceOcrIngestionResult = InvoiceOcrIngestionResult = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Summary after ingesting OCR supplier invoice lines.' })
], InvoiceOcrIngestionResult);
let OcrColumnMappingPair = class OcrColumnMappingPair {
};
exports.OcrColumnMappingPair = OcrColumnMappingPair;
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], OcrColumnMappingPair.prototype, "sourceHeader", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], OcrColumnMappingPair.prototype, "targetField", void 0);
exports.OcrColumnMappingPair = OcrColumnMappingPair = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Single mapped column rule in an OCR preset.' })
], OcrColumnMappingPair);
let OcrColumnMappingPresetOutput = class OcrColumnMappingPresetOutput {
};
exports.OcrColumnMappingPresetOutput = OcrColumnMappingPresetOutput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], OcrColumnMappingPresetOutput.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], OcrColumnMappingPresetOutput.prototype, "branchId", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { nullable: true }),
    __metadata("design:type", String)
], OcrColumnMappingPresetOutput.prototype, "supplierId", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], OcrColumnMappingPresetOutput.prototype, "supplierName", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], OcrColumnMappingPresetOutput.prototype, "name", void 0);
__decorate([
    (0, graphql_1.Field)(() => [OcrColumnMappingPair]),
    __metadata("design:type", Array)
], OcrColumnMappingPresetOutput.prototype, "mappings", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Date)
], OcrColumnMappingPresetOutput.prototype, "updatedAt", void 0);
exports.OcrColumnMappingPresetOutput = OcrColumnMappingPresetOutput = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Branch-shared OCR spreadsheet mapping preset.' })
], OcrColumnMappingPresetOutput);
//# sourceMappingURL=accounting.types.js.map