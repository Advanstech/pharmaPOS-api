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
exports.ProductType = exports.ProductCategoryType = exports.ProductSupplierType = exports.ProductInventoryType = exports.InventoryBatchType = exports.ProductImageType = void 0;
const graphql_1 = require("@nestjs/graphql");
let ProductImageType = class ProductImageType {
};
exports.ProductImageType = ProductImageType;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the image record' }),
    __metadata("design:type", String)
], ProductImageType.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Full-size CDN URL. Use for product detail pages.' }),
    __metadata("design:type", String)
], ProductImageType.prototype, "cdnUrl", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Thumbnail CDN URL (200×200px). Use for search result cards.' }),
    __metadata("design:type", String)
], ProductImageType.prototype, "urlThumb", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Image source. Values: `DRUG_DB` | `DALLE3` (reserved for future automated pipelines) | ' +
            '`MANUAL_UPLOAD` (e.g. GRN photo) | `PLACEHOLDER` (seeded DB placeholder).',
    }),
    __metadata("design:type", String)
], ProductImageType.prototype, "source", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: '`true` if the image has been reviewed and approved by a pharmacist. ' +
            'AI-generated images start as `false` until approved.',
    }),
    __metadata("design:type", Boolean)
], ProductImageType.prototype, "isApproved", void 0);
exports.ProductImageType = ProductImageType = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Product image with CDN URLs and source metadata' })
], ProductImageType);
let InventoryBatchType = class InventoryBatchType {
};
exports.InventoryBatchType = InventoryBatchType;
__decorate([
    (0, graphql_1.Field)({ description: 'Batch/lot number from the supplier GRN' }),
    __metadata("design:type", String)
], InventoryBatchType.prototype, "batchNumber", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Quantity remaining in this batch' }),
    __metadata("design:type", Number)
], InventoryBatchType.prototype, "quantity", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Expiry date in ISO 8601 format. Batches are ordered by expiry (nearest first) for FEFO dispensing.',
    }),
    __metadata("design:type", String)
], InventoryBatchType.prototype, "expiryDate", void 0);
exports.InventoryBatchType = InventoryBatchType = __decorate([
    (0, graphql_1.ObjectType)({ description: 'A single stock batch — used for FEFO (First Expiry First Out) dispensing' })
], InventoryBatchType);
let ProductInventoryType = class ProductInventoryType {
};
exports.ProductInventoryType = ProductInventoryType;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Total units on hand across all batches at this branch' }),
    __metadata("design:type", Number)
], ProductInventoryType.prototype, "quantityOnHand", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        description: 'Reorder threshold. A low-stock alert fires when `quantityOnHand` falls to this level.',
    }),
    __metadata("design:type", Number)
], ProductInventoryType.prototype, "reorderLevel", void 0);
__decorate([
    (0, graphql_1.Field)(() => [InventoryBatchType], {
        description: 'Individual stock batches ordered by expiry date (FEFO). Used for dispensing order.',
    }),
    __metadata("design:type", Array)
], ProductInventoryType.prototype, "batches", void 0);
exports.ProductInventoryType = ProductInventoryType = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Inventory position for a product at the current branch' })
], ProductInventoryType);
let ProductSupplierType = class ProductSupplierType {
};
exports.ProductSupplierType = ProductSupplierType;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the supplier' }),
    __metadata("design:type", String)
], ProductSupplierType.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Supplier trading name' }),
    __metadata("design:type", String)
], ProductSupplierType.prototype, "name", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        nullable: true,
        description: 'AI-computed supplier reliability score (0–100). ' +
            'Based on on-time delivery, quality complaints, and price consistency.',
    }),
    __metadata("design:type", Number)
], ProductSupplierType.prototype, "aiScore", void 0);
exports.ProductSupplierType = ProductSupplierType = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Supplier summary embedded in a product' })
], ProductSupplierType);
let ProductCategoryType = class ProductCategoryType {
};
exports.ProductCategoryType = ProductCategoryType;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the category' }),
    __metadata("design:type", String)
], ProductCategoryType.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Category name. Example: `"Antibiotic"`, `"Analgesic"`, `"Antifungal"`' }),
    __metadata("design:type", String)
], ProductCategoryType.prototype, "name", void 0);
exports.ProductCategoryType = ProductCategoryType = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Product category (e.g. Antibiotic, Analgesic, Antihypertensive)' })
], ProductCategoryType);
let ProductType = class ProductType {
};
exports.ProductType = ProductType;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the product' }),
    __metadata("design:type", String)
], ProductType.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Brand/trade name. Example: `"Paracetamol 500mg"`, `"Amoxil 250mg/5ml"`' }),
    __metadata("design:type", String)
], ProductType.prototype, "name", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Generic/INN name. Example: `"Paracetamol"`, `"Amoxicillin"`' }),
    __metadata("design:type", String)
], ProductType.prototype, "genericName", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true, description: 'Barcode (EAN-13 or custom). Used for barcode scanner at POS.' }),
    __metadata("design:type", String)
], ProductType.prototype, "barcode", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        description: 'Unit selling price in **GHS pesewas** (integer). ' +
            'Example: GH₵12.50 = `1250`. Always GHS — never USD.',
    }),
    __metadata("design:type", Number)
], ProductType.prototype, "unitPrice", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Ghana FDA classification. Values:\n' +
            '- `OTC` — Over the counter, no prescription needed\n' +
            '- `POM` — Prescription Only Medicine, requires approved Rx\n' +
            '- `CONTROLLED` — Controlled drug, requires two pharmacist sign-offs',
    }),
    __metadata("design:type", String)
], ProductType.prototype, "classification", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Which branch type can sell this product. Values: `pharmaceutical` | `chemical` | `both`. ' +
            'Ghana FDA: POM and CONTROLLED products are always `pharmaceutical` only.',
    }),
    __metadata("design:type", String)
], ProductType.prototype, "branchType", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Ghana GRA: `true` if this product is VAT-exempt. ' +
            'Prescription medicines (`requiresRx = true`) are VAT-exempt. ' +
            'OTC products are subject to 15% VAT.',
    }),
    __metadata("design:type", Boolean)
], ProductType.prototype, "vatExempt", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Ghana FDA: `true` if an approved prescription is required before this product can be sold. ' +
            'Attempting to sell without a prescription throws `FDA_POM_VIOLATION`.',
    }),
    __metadata("design:type", Boolean)
], ProductType.prototype, "requiresRx", void 0);
__decorate([
    (0, graphql_1.Field)(() => ProductImageType, {
        nullable: true,
        description: 'Approved image row when present. Null if none; web POS shows a deterministic stock-photo fallback from product id/name/generic/category.',
    }),
    __metadata("design:type", ProductImageType)
], ProductType.prototype, "image", void 0);
__decorate([
    (0, graphql_1.Field)(() => ProductInventoryType, {
        nullable: true,
        description: 'Inventory position at the current branch. Null if queried without branch context.',
    }),
    __metadata("design:type", ProductInventoryType)
], ProductType.prototype, "inventory", void 0);
__decorate([
    (0, graphql_1.Field)(() => ProductSupplierType, {
        nullable: true,
        description: 'Primary supplier. Enables full supply chain traceability per Ghana FDA requirements.',
    }),
    __metadata("design:type", ProductSupplierType)
], ProductType.prototype, "supplier", void 0);
__decorate([
    (0, graphql_1.Field)(() => ProductCategoryType, { nullable: true, description: 'Product category' }),
    __metadata("design:type", ProductCategoryType)
], ProductType.prototype, "category", void 0);
exports.ProductType = ProductType = __decorate([
    (0, graphql_1.ObjectType)({
        description: 'A product in the PharmaPOS catalogue. ' +
            'Products are scoped to an organisation and can be available at `pharmaceutical`, `chemical`, or `both` branch types. ' +
            'When no approved `product_images` row exists, the web POS uses a deterministic Unsplash stock-photo fallback from id, name, generic name, and category.',
    })
], ProductType);
//# sourceMappingURL=product.types.js.map