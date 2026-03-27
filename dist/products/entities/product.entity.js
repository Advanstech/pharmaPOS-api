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
exports.Product = void 0;
const typeorm_1 = require("typeorm");
let Product = class Product {
};
exports.Product = Product;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Product.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 255 }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], Product.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'generic_name', length: 255, nullable: true }),
    __metadata("design:type", String)
], Product.prototype, "genericName", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100, nullable: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], Product.prototype, "barcode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'unit_price', type: 'integer' }),
    __metadata("design:type", Number)
], Product.prototype, "unitPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['OTC', 'POM', 'CONTROLLED'], default: 'OTC' }),
    __metadata("design:type", String)
], Product.prototype, "classification", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'branch_type', type: 'enum', enum: ['pharmaceutical', 'chemical', 'both'], default: 'both' }),
    __metadata("design:type", String)
], Product.prototype, "branchType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'vat_exempt', default: false }),
    __metadata("design:type", Boolean)
], Product.prototype, "vatExempt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'requires_rx', default: false }),
    __metadata("design:type", Boolean)
], Product.prototype, "requiresRx", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'image_id', nullable: true }),
    __metadata("design:type", String)
], Product.prototype, "imageId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'category_id', nullable: true }),
    __metadata("design:type", String)
], Product.prototype, "categoryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'supplier_id', nullable: true }),
    __metadata("design:type", String)
], Product.prototype, "supplierId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', default: true }),
    __metadata("design:type", Boolean)
], Product.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Product.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Product.prototype, "updatedAt", void 0);
exports.Product = Product = __decorate([
    (0, typeorm_1.Entity)('products')
], Product);
//# sourceMappingURL=product.entity.js.map