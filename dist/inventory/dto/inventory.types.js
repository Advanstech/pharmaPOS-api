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
exports.StockCountItemOutput = exports.StockCountSessionOutput = exports.CompleteStockCountInput = exports.StockCountItemInput = exports.UpdateStockCountInput = exports.CreateStockCountInput = exports.GRNOutput = exports.GRNItemOutput = exports.CreateGRNInput = exports.GRNItemInput = exports.StockChangedEvent = exports.LowStockAlert = exports.StockMovementOutput = exports.InventoryItem = exports.ReceiveStockInput = exports.AdjustStockInput = void 0;
const graphql_1 = require("@nestjs/graphql");
const class_validator_1 = require("class-validator");
let AdjustStockInput = class AdjustStockInput {
};
exports.AdjustStockInput = AdjustStockInput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the product to adjust' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AdjustStockInput.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        description: 'Stock change amount. Positive = add, negative = remove. ' +
            'Example: `10` adds 10 units; `-3` removes 3 units.',
    }),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], AdjustStockInput.prototype, "quantityDelta", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Reason for the adjustment. Shown in audit trail. ' +
            'Examples: `"Damaged goods"`, `"Stock count correction"`, `"Customer return"`.',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdjustStockInput.prototype, "reason", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Batch number from the supplier GRN. Used for FEFO (First Expiry First Out) tracking.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdjustStockInput.prototype, "batchNumber", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Expiry date of this batch in ISO 8601 format. Example: `"2027-06-30"`.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AdjustStockInput.prototype, "expiryDate", void 0);
exports.AdjustStockInput = AdjustStockInput = __decorate([
    (0, graphql_1.InputType)({
        description: 'Manually adjust stock for a product at the current branch. ' +
            'Use positive delta to add stock (e.g. found items, returns) and negative to remove (e.g. damage, expiry write-off). ' +
            'Every adjustment is recorded in `stock_movements` for audit purposes.',
    })
], AdjustStockInput);
let ReceiveStockInput = class ReceiveStockInput {
};
exports.ReceiveStockInput = ReceiveStockInput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the product being received' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReceiveStockInput.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Quantity received. Must be ≥ 1.' }),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ReceiveStockInput.prototype, "quantity", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Batch/lot number from the supplier invoice or GRN document.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReceiveStockInput.prototype, "batchNumber", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Expiry date of this batch in ISO 8601 format. ' +
            'Required for medicines — used for FEFO dispensing order.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ReceiveStockInput.prototype, "expiryDate", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'UUID of the purchase order this receipt is fulfilling. Optional.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReceiveStockInput.prototype, "purchaseOrderId", void 0);
exports.ReceiveStockInput = ReceiveStockInput = __decorate([
    (0, graphql_1.InputType)({
        description: 'Record stock received from a supplier (Goods Received Note). ' +
            'Increments `quantity_on_hand` and creates a `RECEIVE` stock movement record. ' +
            'Optionally links to a purchase order for reconciliation.',
    })
], ReceiveStockInput);
let InventoryItem = class InventoryItem {
};
exports.InventoryItem = InventoryItem;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the product' }),
    __metadata("design:type", String)
], InventoryItem.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Product name' }),
    __metadata("design:type", String)
], InventoryItem.prototype, "productName", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Ghana FDA classification. Values: `OTC` | `POM` | `CONTROLLED`',
    }),
    __metadata("design:type", String)
], InventoryItem.prototype, "classification", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Current units on hand at this branch' }),
    __metadata("design:type", Number)
], InventoryItem.prototype, "quantityOnHand", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        description: 'Reorder threshold. When `quantityOnHand` falls to or below this level, ' +
            'a low-stock alert is triggered and the product appears in the reorder list.',
    }),
    __metadata("design:type", Number)
], InventoryItem.prototype, "reorderLevel", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Stock health status. Values: `ok` (above reorder) | `low` (at reorder) | ' +
            '`critical` (≤20% of reorder level) | `out` (zero stock).',
    }),
    __metadata("design:type", String)
], InventoryItem.prototype, "stockStatus", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Expiry date of the nearest-expiring batch (FEFO). ' +
            'Null if no expiry date is recorded for this product.',
    }),
    __metadata("design:type", Date)
], InventoryItem.prototype, "nearestExpiry", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'UUID of the primary supplier — enables supply chain traceability',
    }),
    __metadata("design:type", String)
], InventoryItem.prototype, "supplierId", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Supplier trading name' }),
    __metadata("design:type", String)
], InventoryItem.prototype, "supplierName", void 0);
exports.InventoryItem = InventoryItem = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Current inventory position for a product at a branch' })
], InventoryItem);
let StockMovementOutput = class StockMovementOutput {
};
exports.StockMovementOutput = StockMovementOutput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of this movement record' }),
    __metadata("design:type", String)
], StockMovementOutput.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the product' }),
    __metadata("design:type", String)
], StockMovementOutput.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Product name at time of movement' }),
    __metadata("design:type", String)
], StockMovementOutput.prototype, "productName", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        description: 'Quantity changed. Negative for outbound movements (sales, write-offs). ' +
            'Positive for inbound (receive, return, adjustment).',
    }),
    __metadata("design:type", Number)
], StockMovementOutput.prototype, "quantity", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Movement type. Values: `SALE` | `RECEIVE` | `ADJUSTMENT` | `RETURN` | `WRITE_OFF` | `TRANSFER`',
    }),
    __metadata("design:type", String)
], StockMovementOutput.prototype, "movementType", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Batch number associated with this movement' }),
    __metadata("design:type", String)
], StockMovementOutput.prototype, "batchNumber", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Expiry date of the batch involved' }),
    __metadata("design:type", Date)
], StockMovementOutput.prototype, "expiryDate", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'ISO 8601 timestamp of the movement (Africa/Accra timezone)' }),
    __metadata("design:type", Date)
], StockMovementOutput.prototype, "createdAt", void 0);
exports.StockMovementOutput = StockMovementOutput = __decorate([
    (0, graphql_1.ObjectType)({ description: 'A single stock movement event (sale, receive, adjustment, return)' })
], StockMovementOutput);
let LowStockAlert = class LowStockAlert {
};
exports.LowStockAlert = LowStockAlert;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the product' }),
    __metadata("design:type", String)
], LowStockAlert.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Product name' }),
    __metadata("design:type", String)
], LowStockAlert.prototype, "productName", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Current units on hand' }),
    __metadata("design:type", Number)
], LowStockAlert.prototype, "quantityOnHand", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Configured reorder threshold' }),
    __metadata("design:type", Number)
], LowStockAlert.prototype, "reorderLevel", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Alert severity. Values: `low` | `critical` | `out`',
    }),
    __metadata("design:type", String)
], LowStockAlert.prototype, "status", void 0);
exports.LowStockAlert = LowStockAlert = __decorate([
    (0, graphql_1.ObjectType)({
        description: 'A product that has fallen to or below its reorder level. ' +
            'Used to populate the reorder list and trigger staff SMS alerts via Hubtel.',
    })
], LowStockAlert);
let StockChangedEvent = class StockChangedEvent {
};
exports.StockChangedEvent = StockChangedEvent;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], StockChangedEvent.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], StockChangedEvent.prototype, "branchId", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], StockChangedEvent.prototype, "quantityOnHand", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], StockChangedEvent.prototype, "reorderLevel", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Stock health status: `ok` | `low` | `critical` | `out`.' }),
    __metadata("design:type", String)
], StockChangedEvent.prototype, "stockStatus", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Server timestamp for this stock event (Africa/Accra timezone).' }),
    __metadata("design:type", Date)
], StockChangedEvent.prototype, "changedAt", void 0);
exports.StockChangedEvent = StockChangedEvent = __decorate([
    (0, graphql_1.ObjectType)({
        description: 'Real-time stock update event emitted after successful sale, stock receive, GRN intake, or manual adjustment.',
    })
], StockChangedEvent);
let GRNItemInput = class GRNItemInput {
};
exports.GRNItemInput = GRNItemInput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the product being received' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], GRNItemInput.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Quantity received' }),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], GRNItemInput.prototype, "quantity", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Batch/lot number from supplier' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GRNItemInput.prototype, "batchNumber", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Expiry date in ISO 8601 format' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], GRNItemInput.prototype, "expiryDate", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'S3 key of uploaded product image (photo taken during stock receiving)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GRNItemInput.prototype, "imageS3Key", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        nullable: true,
        description: 'Supplier unit cost in GHS pesewas for this received product line. ' +
            'If omitted, the system infers a weighted average cost from invoice total and quantities.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], GRNItemInput.prototype, "unitCostPesewas", void 0);
exports.GRNItemInput = GRNItemInput = __decorate([
    (0, graphql_1.InputType)({ description: 'A single product line on a GRN' })
], GRNItemInput);
let CreateGRNInput = class CreateGRNInput {
};
exports.CreateGRNInput = CreateGRNInput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the supplier delivering the goods' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateGRNInput.prototype, "supplierId", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'UUID of the purchase order this GRN is fulfilling (optional)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateGRNInput.prototype, "purchaseOrderId", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Supplier invoice number from their delivery note',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateGRNInput.prototype, "supplierInvoiceNumber", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Invoice date from supplier document (ISO 8601)',
    }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateGRNInput.prototype, "invoiceDate", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Due date for payment (ISO 8601). Calculated from payment terms if not provided.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateGRNInput.prototype, "dueDate", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        description: 'Total invoice amount in GHS pesewas (from supplier invoice)',
    }),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateGRNInput.prototype, "totalAmountPesewas", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'S3 key of uploaded supplier invoice PDF/image',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateGRNInput.prototype, "invoicePdfS3Key", void 0);
__decorate([
    (0, graphql_1.Field)(() => [GRNItemInput], {
        description: 'Products received — each with batch, expiry, optional image',
    }),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], CreateGRNInput.prototype, "items", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Optional notes from the receiving staff',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateGRNInput.prototype, "notes", void 0);
exports.CreateGRNInput = CreateGRNInput = __decorate([
    (0, graphql_1.InputType)({
        description: 'Create a Goods Received Note — records stock arrival from supplier with their invoice. ' +
            'Ghana workflow: Supplier delivers goods with invoice → Staff receives and stocks → ' +
            'Manager matches invoice to GRN → Owner pays supplier on credit terms (NET_30/NET_60).',
    })
], CreateGRNInput);
let GRNItemOutput = class GRNItemOutput {
};
exports.GRNItemOutput = GRNItemOutput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], GRNItemOutput.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], GRNItemOutput.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], GRNItemOutput.prototype, "productName", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], GRNItemOutput.prototype, "quantity", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], GRNItemOutput.prototype, "batchNumber", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Date)
], GRNItemOutput.prototype, "expiryDate", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], GRNItemOutput.prototype, "imageS3Key", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        nullable: true,
        description: 'Observed supplier unit cost captured at receiving time, in GHS pesewas.',
    }),
    __metadata("design:type", Number)
], GRNItemOutput.prototype, "unitCostPesewas", void 0);
exports.GRNItemOutput = GRNItemOutput = __decorate([
    (0, graphql_1.ObjectType)({ description: 'A single product line on a GRN' })
], GRNItemOutput);
let GRNOutput = class GRNOutput {
};
exports.GRNOutput = GRNOutput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], GRNOutput.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], GRNOutput.prototype, "branchId", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], GRNOutput.prototype, "supplierId", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], GRNOutput.prototype, "supplierName", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { nullable: true }),
    __metadata("design:type", String)
], GRNOutput.prototype, "purchaseOrderId", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], GRNOutput.prototype, "supplierInvoiceNumber", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Date)
], GRNOutput.prototype, "invoiceDate", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", Date)
], GRNOutput.prototype, "dueDate", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], GRNOutput.prototype, "totalAmountPesewas", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], GRNOutput.prototype, "totalAmountFormatted", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], GRNOutput.prototype, "invoicePdfS3Key", void 0);
__decorate([
    (0, graphql_1.Field)(() => [GRNItemOutput]),
    __metadata("design:type", Array)
], GRNOutput.prototype, "items", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], GRNOutput.prototype, "notes", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], GRNOutput.prototype, "receivedBy", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], GRNOutput.prototype, "receivedByName", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Date)
], GRNOutput.prototype, "receivedAt", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'true if this GRN has been matched to a supplier_invoice record',
    }),
    __metadata("design:type", Boolean)
], GRNOutput.prototype, "isMatched", void 0);
exports.GRNOutput = GRNOutput = __decorate([
    (0, graphql_1.ObjectType)({
        description: 'Goods Received Note — records stock arrival from supplier. ' +
            'Links to supplier invoice for 3-way match (PO → GRN → Invoice) and payment tracking.',
    })
], GRNOutput);
let CreateStockCountInput = class CreateStockCountInput {
};
exports.CreateStockCountInput = CreateStockCountInput;
__decorate([
    (0, graphql_1.Field)(() => [graphql_1.ID], {
        nullable: true,
        description: 'Specific product IDs to count. If empty, counts all products.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], CreateStockCountInput.prototype, "productIds", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Optional notes for this count session' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateStockCountInput.prototype, "notes", void 0);
exports.CreateStockCountInput = CreateStockCountInput = __decorate([
    (0, graphql_1.InputType)({
        description: 'Create a new stock count session (cycle counting)',
    })
], CreateStockCountInput);
let UpdateStockCountInput = class UpdateStockCountInput {
};
exports.UpdateStockCountInput = UpdateStockCountInput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'Stock count session ID' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateStockCountInput.prototype, "sessionId", void 0);
__decorate([
    (0, graphql_1.Field)(() => [StockCountItemInput], { description: 'Product count entries' }),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], UpdateStockCountInput.prototype, "counts", void 0);
exports.UpdateStockCountInput = UpdateStockCountInput = __decorate([
    (0, graphql_1.InputType)({ description: 'Submit counted quantities for products' })
], UpdateStockCountInput);
let StockCountItemInput = class StockCountItemInput {
};
exports.StockCountItemInput = StockCountItemInput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'Product ID' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], StockCountItemInput.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Physical count quantity' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], StockCountItemInput.prototype, "countedQuantity", void 0);
exports.StockCountItemInput = StockCountItemInput = __decorate([
    (0, graphql_1.InputType)({ description: 'Single product count entry' })
], StockCountItemInput);
let CompleteStockCountInput = class CompleteStockCountInput {
};
exports.CompleteStockCountInput = CompleteStockCountInput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'Stock count session ID' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CompleteStockCountInput.prototype, "sessionId", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Final notes/review comments' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CompleteStockCountInput.prototype, "notes", void 0);
exports.CompleteStockCountInput = CompleteStockCountInput = __decorate([
    (0, graphql_1.InputType)({ description: 'Complete a stock count session' })
], CompleteStockCountInput);
let StockCountSessionOutput = class StockCountSessionOutput {
};
exports.StockCountSessionOutput = StockCountSessionOutput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], StockCountSessionOutput.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], StockCountSessionOutput.prototype, "branchId", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Session status: pending | in_progress | completed | cancelled' }),
    __metadata("design:type", String)
], StockCountSessionOutput.prototype, "status", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'When counting started' }),
    __metadata("design:type", Date)
], StockCountSessionOutput.prototype, "startedAt", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'When counting completed' }),
    __metadata("design:type", Date)
], StockCountSessionOutput.prototype, "completedAt", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'User who started the count' }),
    __metadata("design:type", String)
], StockCountSessionOutput.prototype, "countedBy", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { nullable: true, description: 'User who reviewed/completed' }),
    __metadata("design:type", String)
], StockCountSessionOutput.prototype, "reviewedBy", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Total number of items to count' }),
    __metadata("design:type", Number)
], StockCountSessionOutput.prototype, "totalItems", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Total variance across all items' }),
    __metadata("design:type", Number)
], StockCountSessionOutput.prototype, "totalVariance", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Total value impact of variance (pesewas)' }),
    __metadata("design:type", Number)
], StockCountSessionOutput.prototype, "totalValueVariance", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], StockCountSessionOutput.prototype, "notes", void 0);
exports.StockCountSessionOutput = StockCountSessionOutput = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Stock count session (cycle counting audit)' })
], StockCountSessionOutput);
let StockCountItemOutput = class StockCountItemOutput {
};
exports.StockCountItemOutput = StockCountItemOutput;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], StockCountItemOutput.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Product name' }),
    __metadata("design:type", String)
], StockCountItemOutput.prototype, "productName", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Expected quantity from system' }),
    __metadata("design:type", Number)
], StockCountItemOutput.prototype, "expectedQuantity", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Physical counted quantity' }),
    __metadata("design:type", Number)
], StockCountItemOutput.prototype, "countedQuantity", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Variance (counted - expected)' }),
    __metadata("design:type", Number)
], StockCountItemOutput.prototype, "variance", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { nullable: true, description: 'Unit cost for value calculation' }),
    __metadata("design:type", Number)
], StockCountItemOutput.prototype, "unitCostPesewas", void 0);
exports.StockCountItemOutput = StockCountItemOutput = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Single stock count item with variance details' })
], StockCountItemOutput);
//# sourceMappingURL=inventory.types.js.map