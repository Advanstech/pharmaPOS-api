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
exports.DailySummary = exports.SaleOutput = exports.SaleItemOutput = exports.CreateSaleInput = exports.TenderInput = exports.SaleItemInput = exports.PaymentMethod = void 0;
const graphql_1 = require("@nestjs/graphql");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["CASH"] = "CASH";
    PaymentMethod["MTN_MOMO"] = "MTN_MOMO";
    PaymentMethod["VODAFONE_CASH"] = "VODAFONE_CASH";
    PaymentMethod["AIRTELTIGO_MONEY"] = "AIRTELTIGO_MONEY";
    PaymentMethod["CARD"] = "CARD";
    PaymentMethod["SPLIT"] = "SPLIT";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
let SaleItemInput = class SaleItemInput {
};
exports.SaleItemInput = SaleItemInput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the product being sold' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SaleItemInput.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Number of units to sell. Must be ≥ 1.' }),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], SaleItemInput.prototype, "quantity", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'UUID of the approved prescription. **Required** when the product has `requiresRx = true`. ' +
            'Ghana FDA: omitting this for a POM product throws `FDA_POM_VIOLATION`.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SaleItemInput.prototype, "prescriptionId", void 0);
exports.SaleItemInput = SaleItemInput = __decorate([
    (0, graphql_1.InputType)({ description: 'A single line item in a sale' })
], SaleItemInput);
let TenderInput = class TenderInput {
};
exports.TenderInput = TenderInput;
__decorate([
    (0, graphql_1.Field)(() => String, {
        description: 'Payment method. Ghana-native options: `MTN_MOMO`, `VODAFONE_CASH`, `AIRTELTIGO_MONEY`. ' +
            'Also supports `CASH`, `CARD`, `SPLIT`.',
    }),
    (0, class_validator_1.IsEnum)(PaymentMethod),
    __metadata("design:type", String)
], TenderInput.prototype, "method", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        description: 'Amount tendered in **GHS pesewas** (integer). Example: GH₵50.00 = `5000`. ' +
            'All monetary values are GHS — never USD.',
    }),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], TenderInput.prototype, "amountPesewas", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'MoMo transaction reference from Hubtel/MTN. Required when method is `MTN_MOMO` or `VODAFONE_CASH`.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TenderInput.prototype, "momoReference", void 0);
exports.TenderInput = TenderInput = __decorate([
    (0, graphql_1.InputType)({ description: 'A payment tender — one sale can have multiple tenders (split payment)' })
], TenderInput);
let CreateSaleInput = class CreateSaleInput {
};
exports.CreateSaleInput = CreateSaleInput;
__decorate([
    (0, graphql_1.Field)(() => [SaleItemInput], { description: 'One or more products being sold. Must not be empty.' }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SaleItemInput),
    __metadata("design:type", Array)
], CreateSaleInput.prototype, "items", void 0);
__decorate([
    (0, graphql_1.Field)(() => [TenderInput], {
        description: 'Payment tenders. Total tendered amount must be ≥ total sale amount. ' +
            'Multiple tenders allowed for split payments.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TenderInput),
    __metadata("design:type", Array)
], CreateSaleInput.prototype, "tenders", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'UUID of the customer. Optional for walk-in sales.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateSaleInput.prototype, "customerId", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, {
        description: 'Client-generated UUID v4 idempotency key. ' +
            'If a sale with this key already exists, the existing sale is returned without creating a duplicate. ' +
            'Generate once per checkout attempt — reuse on retry after network failure.',
    }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateSaleInput.prototype, "idempotencyKey", void 0);
__decorate([
    (0, graphql_1.Field)(() => String, {
        nullable: true,
        description: 'When the customer completed checkout (ISO 8601). **Offline POS** should send the local checkout time so ' +
            'reports and VAT periods attribute revenue to the correct business day after sync. Omit for online checkout — server `createdAt` is used.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], CreateSaleInput.prototype, "soldAt", void 0);
exports.CreateSaleInput = CreateSaleInput = __decorate([
    (0, graphql_1.InputType)({
        description: 'Create a completed sale at the POS terminal. ' +
            'Ghana FDA: POM items are validated by `PomEnforcementGuard` before this mutation runs. ' +
            'Idempotency key prevents duplicate records during offline sync.',
    })
], CreateSaleInput);
let SaleItemOutput = class SaleItemOutput {
};
exports.SaleItemOutput = SaleItemOutput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of this sale item record' }),
    __metadata("design:type", String)
], SaleItemOutput.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the product sold' }),
    __metadata("design:type", String)
], SaleItemOutput.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Product name at time of sale (snapshot)' }),
    __metadata("design:type", String)
], SaleItemOutput.prototype, "productName", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Ghana FDA classification at read time (`OTC` | `POM` | `CONTROLLED`) — joined from product record.',
    }),
    __metadata("design:type", String)
], SaleItemOutput.prototype, "classification", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Quantity sold' }),
    __metadata("design:type", Number)
], SaleItemOutput.prototype, "quantity", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        description: 'Unit price in GHS pesewas at time of sale (snapshot). Example: `2500` = GH₵25.00',
    }),
    __metadata("design:type", Number)
], SaleItemOutput.prototype, "unitPricePesewas", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Ghana GRA: `true` if this item is VAT-exempt (prescription medicines). ' +
            '`false` if 15% VAT applies.',
    }),
    __metadata("design:type", Boolean)
], SaleItemOutput.prototype, "vatExempt", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'UUID of the supplier — enables full supply chain traceability per Ghana FDA requirements',
    }),
    __metadata("design:type", String)
], SaleItemOutput.prototype, "supplierId", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Supplier trading name at time of reporting (joined for receipts and audit views)',
    }),
    __metadata("design:type", String)
], SaleItemOutput.prototype, "supplierName", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        description: 'Inventory units remaining immediately after this sale line is committed. ' +
            'Used by POS UI for real-time stock sync.',
    }),
    __metadata("design:type", Number)
], SaleItemOutput.prototype, "stockAfterSale", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        description: 'Reorder threshold configured for this product at the selling branch.',
    }),
    __metadata("design:type", Number)
], SaleItemOutput.prototype, "reorderLevel", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Post-sale stock health status: `ok` | `low` | `critical` | `out`.',
    }),
    __metadata("design:type", String)
], SaleItemOutput.prototype, "stockStatus", void 0);
exports.SaleItemOutput = SaleItemOutput = __decorate([
    (0, graphql_1.ObjectType)({ description: 'A single line item within a completed sale' })
], SaleItemOutput);
let SaleOutput = class SaleOutput {
};
exports.SaleOutput = SaleOutput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the sale' }),
    __metadata("design:type", String)
], SaleOutput.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the branch where the sale occurred' }),
    __metadata("design:type", String)
], SaleOutput.prototype, "branchId", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the cashier who processed the sale' }),
    __metadata("design:type", String)
], SaleOutput.prototype, "cashierId", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Branch display name where the sale was recorded' }),
    __metadata("design:type", String)
], SaleOutput.prototype, "branchName", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Cashier display name from staff record' }),
    __metadata("design:type", String)
], SaleOutput.prototype, "cashierName", void 0);
__decorate([
    (0, graphql_1.Field)(() => [SaleItemOutput], { description: 'Line items in this sale' }),
    __metadata("design:type", Array)
], SaleOutput.prototype, "items", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        description: 'Total sale amount in GHS pesewas (subtotal + VAT). Example: `11500` = GH₵115.00',
    }),
    __metadata("design:type", Number)
], SaleOutput.prototype, "totalPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        description: 'VAT collected in GHS pesewas. Ghana GRA: 15% on non-exempt items (12.5% VAT + 2.5% NHIL).',
    }),
    __metadata("design:type", Number)
], SaleOutput.prototype, "vatPesewas", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Human-readable total. Always GH₵ — never USD. Example: `GH₵115.00`' }),
    __metadata("design:type", String)
], SaleOutput.prototype, "totalFormatted", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Sale status. Values: `COMPLETED` | `REFUNDED` | `VOID`' }),
    __metadata("design:type", String)
], SaleOutput.prototype, "status", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'Idempotency key used to create this sale' }),
    __metadata("design:type", String)
], SaleOutput.prototype, "idempotencyKey", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.GraphQLISODateTime, {
        nullable: true,
        description: 'Checkout wall time when provided (e.g. offline queue). Null when only server record time applies.',
    }),
    __metadata("design:type", Object)
], SaleOutput.prototype, "soldAt", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.GraphQLISODateTime, {
        description: 'When the sale row was persisted on the server. For reporting, the API uses `soldAt` when set, else this.',
    }),
    __metadata("design:type", Date)
], SaleOutput.prototype, "createdAt", void 0);
exports.SaleOutput = SaleOutput = __decorate([
    (0, graphql_1.ObjectType)({ description: 'A completed sale record' })
], SaleOutput);
let DailySummary = class DailySummary {
};
exports.DailySummary = DailySummary;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Number of completed sales' }),
    __metadata("design:type", Number)
], DailySummary.prototype, "salesCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Total revenue in GHS pesewas' }),
    __metadata("design:type", Number)
], DailySummary.prototype, "totalRevenuePesewas", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Formatted total revenue. Example: `GH₵4,250.00`' }),
    __metadata("design:type", String)
], DailySummary.prototype, "totalRevenueFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Total VAT collected in GHS pesewas (Ghana GRA reporting)' }),
    __metadata("design:type", Number)
], DailySummary.prototype, "vatCollectedPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, { description: 'Average sale value in GHS (not pesewas). Example: `42.50`' }),
    __metadata("design:type", Number)
], DailySummary.prototype, "averageSaleGhs", void 0);
exports.DailySummary = DailySummary = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Aggregated sales summary for a single day' })
], DailySummary);
//# sourceMappingURL=sale.types.js.map