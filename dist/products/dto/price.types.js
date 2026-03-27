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
exports.ProductCostSnapshot = exports.PriceUpdateResult = exports.ExchangeRate = exports.PriceHistory = exports.PriceDisplay = exports.SetExchangeRateInput = exports.BulkUpdatePriceInput = exports.UpdatePriceInput = exports.Currency = void 0;
const graphql_1 = require("@nestjs/graphql");
const class_validator_1 = require("class-validator");
var Currency;
(function (Currency) {
    Currency["GHS"] = "GHS";
    Currency["USD"] = "USD";
})(Currency || (exports.Currency = Currency = {}));
(0, graphql_1.registerEnumType)(Currency, {
    name: 'Currency',
    description: 'Supported display currencies. GHS is the canonical storage currency used for all transactions. ' +
        'USD is display-only for reference — never used in transactions.',
});
let UpdatePriceInput = class UpdatePriceInput {
};
exports.UpdatePriceInput = UpdatePriceInput;
__decorate([
    (0, graphql_1.Field)({ description: 'UUID of the product to reprice' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdatePriceInput.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        description: 'New unit price in GHS pesewas (integer). ' +
            'Example: GH 25.00 = 2500. GH 1.50 = 150. All prices are GHS — never USD.',
    }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], UpdatePriceInput.prototype, "unitPriceGhsPesewas", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Reason for the price change. Recorded in price_history audit trail. ' +
            'Examples: Supplier price increase, Promotional discount, Annual review.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdatePriceInput.prototype, "reason", void 0);
exports.UpdatePriceInput = UpdatePriceInput = __decorate([
    (0, graphql_1.InputType)({
        description: 'Update the unit price of a single product. ' +
            'Price is stored in GHS pesewas (integer). Previous price is recorded in price_history for audit. ' +
            'Requires role: owner or manager.',
    })
], UpdatePriceInput);
let BulkUpdatePriceInput = class BulkUpdatePriceInput {
};
exports.BulkUpdatePriceInput = BulkUpdatePriceInput;
__decorate([
    (0, graphql_1.Field)(() => [UpdatePriceInput], {
        description: 'Array of price updates. Maximum 100 products per bulk update.',
    }),
    __metadata("design:type", Array)
], BulkUpdatePriceInput.prototype, "updates", void 0);
exports.BulkUpdatePriceInput = BulkUpdatePriceInput = __decorate([
    (0, graphql_1.InputType)({
        description: 'Update prices for multiple products in a single atomic transaction. ' +
            'All updates succeed or all fail. Requires role: owner or manager.',
    })
], BulkUpdatePriceInput);
let SetExchangeRateInput = class SetExchangeRateInput {
};
exports.SetExchangeRateInput = SetExchangeRateInput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, {
        description: 'USD to GHS exchange rate. Example: 15.50 means GH 15.50 = $1.00. ' +
            'Bank of Ghana official rate recommended.',
    }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], SetExchangeRateInput.prototype, "usdToGhsRate", void 0);
exports.SetExchangeRateInput = SetExchangeRateInput = __decorate([
    (0, graphql_1.InputType)({
        description: 'Set the USD/GHS exchange rate used for display-only USD price conversion. ' +
            'Cached in Redis. Used only for informational display — all transactions are always in GHS. ' +
            'Requires role: owner or se_admin.',
    })
], SetExchangeRateInput);
let PriceDisplay = class PriceDisplay {
};
exports.PriceDisplay = PriceDisplay;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        description: 'Price in GHS pesewas (canonical storage format). ' +
            'Example: 2500 = GH 25.00. Use this for all calculations.',
    }),
    __metadata("design:type", Number)
], PriceDisplay.prototype, "ghsPesewas", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Human-readable GHS price. Example: GH 25.00' }),
    __metadata("design:type", String)
], PriceDisplay.prototype, "ghsFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, {
        nullable: true,
        description: 'USD equivalent for display only. Calculated using the current exchange rate. ' +
            'Never use this for transactions — GHS only.',
    }),
    __metadata("design:type", Number)
], PriceDisplay.prototype, "usdEquivalent", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Human-readable USD price. Example: $1.61' }),
    __metadata("design:type", String)
], PriceDisplay.prototype, "usdFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, {
        nullable: true,
        description: 'Exchange rate used for the USD conversion. Example: 15.50',
    }),
    __metadata("design:type", Number)
], PriceDisplay.prototype, "exchangeRate", void 0);
exports.PriceDisplay = PriceDisplay = __decorate([
    (0, graphql_1.ObjectType)({
        description: 'Price display object. GHS is canonical — always present. ' +
            'USD fields are optional display-only reference values.',
    })
], PriceDisplay);
let PriceHistory = class PriceHistory {
};
exports.PriceHistory = PriceHistory;
__decorate([
    (0, graphql_1.Field)({ description: 'UUID of this price history record' }),
    __metadata("design:type", String)
], PriceHistory.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'UUID of the product' }),
    __metadata("design:type", String)
], PriceHistory.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Product name at time of change' }),
    __metadata("design:type", String)
], PriceHistory.prototype, "productName", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Previous price in GHS pesewas' }),
    __metadata("design:type", Number)
], PriceHistory.prototype, "oldPriceGhsPesewas", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Previous price formatted. Example: GH 20.00' }),
    __metadata("design:type", String)
], PriceHistory.prototype, "oldPriceFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'New price in GHS pesewas' }),
    __metadata("design:type", Number)
], PriceHistory.prototype, "newPriceGhsPesewas", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'New price formatted. Example: GH 25.00' }),
    __metadata("design:type", String)
], PriceHistory.prototype, "newPriceFormatted", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Reason for the price change' }),
    __metadata("design:type", String)
], PriceHistory.prototype, "reason", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Name of the user who made the change' }),
    __metadata("design:type", String)
], PriceHistory.prototype, "changedByName", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'ISO 8601 timestamp of the price change' }),
    __metadata("design:type", Date)
], PriceHistory.prototype, "changedAt", void 0);
exports.PriceHistory = PriceHistory = __decorate([
    (0, graphql_1.ObjectType)({ description: 'A single entry in the price change audit trail' })
], PriceHistory);
let ExchangeRate = class ExchangeRate {
};
exports.ExchangeRate = ExchangeRate;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, {
        description: 'Current USD to GHS rate. Example: 15.50 means GH 15.50 = $1.00',
    }),
    __metadata("design:type", Number)
], ExchangeRate.prototype, "usdToGhsRate", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'ISO 8601 timestamp when the rate was last updated' }),
    __metadata("design:type", Date)
], ExchangeRate.prototype, "updatedAt", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Name of the user who last updated the rate' }),
    __metadata("design:type", String)
], ExchangeRate.prototype, "updatedByName", void 0);
exports.ExchangeRate = ExchangeRate = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Current USD/GHS exchange rate configuration' })
], ExchangeRate);
let PriceUpdateResult = class PriceUpdateResult {
};
exports.PriceUpdateResult = PriceUpdateResult;
__decorate([
    (0, graphql_1.Field)({ description: 'UUID of the updated product' }),
    __metadata("design:type", String)
], PriceUpdateResult.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Product name' }),
    __metadata("design:type", String)
], PriceUpdateResult.prototype, "productName", void 0);
__decorate([
    (0, graphql_1.Field)(() => PriceDisplay, { description: 'New price with GHS and optional USD display' }),
    __metadata("design:type", PriceDisplay)
], PriceUpdateResult.prototype, "price", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'ISO 8601 timestamp of the update' }),
    __metadata("design:type", Date)
], PriceUpdateResult.prototype, "updatedAt", void 0);
exports.PriceUpdateResult = PriceUpdateResult = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Result of a successful price update' })
], PriceUpdateResult);
let ProductCostSnapshot = class ProductCostSnapshot {
};
exports.ProductCostSnapshot = ProductCostSnapshot;
__decorate([
    (0, graphql_1.Field)({ description: 'UUID of the product' }),
    __metadata("design:type", String)
], ProductCostSnapshot.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Latest supplier unit cost in GHS pesewas' }),
    __metadata("design:type", Number)
], ProductCostSnapshot.prototype, "latestCostPesewas", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Formatted cost display. Example: GH₵4.00' }),
    __metadata("design:type", String)
], ProductCostSnapshot.prototype, "latestCostFormatted", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Supplier UUID associated with this cost observation' }),
    __metadata("design:type", String)
], ProductCostSnapshot.prototype, "supplierId", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Supplier name associated with this cost observation' }),
    __metadata("design:type", String)
], ProductCostSnapshot.prototype, "supplierName", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Cost source type. Example: GRN | INVOICE | MANUAL' }),
    __metadata("design:type", String)
], ProductCostSnapshot.prototype, "sourceType", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Timestamp when this supplier cost was observed' }),
    __metadata("design:type", Date)
], ProductCostSnapshot.prototype, "observedAt", void 0);
exports.ProductCostSnapshot = ProductCostSnapshot = __decorate([
    (0, graphql_1.ObjectType)({
        description: 'Latest observed supplier unit cost per product for a branch. ' +
            'Sourced from GRN/invoice ingestion and used to prefill pricing controls.',
    })
], ProductCostSnapshot);
//# sourceMappingURL=price.types.js.map