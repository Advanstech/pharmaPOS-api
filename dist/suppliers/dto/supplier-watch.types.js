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
exports.SupplierRestockWatch = exports.SupplierProductStockSignal = void 0;
const graphql_1 = require("@nestjs/graphql");
let SupplierProductStockSignal = class SupplierProductStockSignal {
};
exports.SupplierProductStockSignal = SupplierProductStockSignal;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], SupplierProductStockSignal.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], SupplierProductStockSignal.prototype, "productName", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], SupplierProductStockSignal.prototype, "quantityOnHand", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], SupplierProductStockSignal.prototype, "reorderLevel", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Stock status: `ok` | `low` | `critical` | `out`.' }),
    __metadata("design:type", String)
], SupplierProductStockSignal.prototype, "stockStatus", void 0);
exports.SupplierProductStockSignal = SupplierProductStockSignal = __decorate([
    (0, graphql_1.ObjectType)({ description: 'A low/critical/out stock product linked to a supplier for restock action.' })
], SupplierProductStockSignal);
let SupplierRestockWatch = class SupplierRestockWatch {
};
exports.SupplierRestockWatch = SupplierRestockWatch;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], SupplierRestockWatch.prototype, "supplierId", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], SupplierRestockWatch.prototype, "supplierName", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], SupplierRestockWatch.prototype, "supplierPhone", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], SupplierRestockWatch.prototype, "supplierEmail", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { nullable: true }),
    __metadata("design:type", Number)
], SupplierRestockWatch.prototype, "supplierAiScore", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], SupplierRestockWatch.prototype, "totalTrackedProducts", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], SupplierRestockWatch.prototype, "lowStockCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], SupplierRestockWatch.prototype, "criticalStockCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], SupplierRestockWatch.prototype, "outOfStockCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => [SupplierProductStockSignal]),
    __metadata("design:type", Array)
], SupplierRestockWatch.prototype, "affectedProducts", void 0);
exports.SupplierRestockWatch = SupplierRestockWatch = __decorate([
    (0, graphql_1.ObjectType)({
        description: 'Supplier restock watch for a branch. Helps managers and pharmacists call suppliers quickly ' +
            'when assigned products fall to low/critical/out stock levels.',
    })
], SupplierRestockWatch);
//# sourceMappingURL=supplier-watch.types.js.map