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
exports.ProductsResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const common_1 = require("@nestjs/common");
const products_service_1 = require("./products.service");
const product_types_1 = require("./dto/product.types");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
let ProductsResolver = class ProductsResolver {
    constructor(productsService) {
        this.productsService = productsService;
    }
    async searchProducts(query, branchId, limit, user) {
        return this.productsService.search(query, branchId, user.branchType, limit);
    }
    inventory(product) {
        var _a, _b;
        const inv = product.inventory;
        if (!inv)
            return null;
        return {
            quantityOnHand: (_a = inv['quantity_on_hand']) !== null && _a !== void 0 ? _a : 0,
            reorderLevel: (_b = inv['reorder_level']) !== null && _b !== void 0 ? _b : 10,
            batches: [],
        };
    }
    image(product) {
        const img = product.image;
        if (!img)
            return null;
        return {
            id: img['id'],
            cdnUrl: img['cdn_url'],
            urlThumb: img['url_thumb'],
            source: img['source'],
            isApproved: img['is_approved'],
        };
    }
    supplier(product) {
        var _a;
        const sup = product.supplier;
        if (!sup)
            return null;
        return {
            id: sup['id'],
            name: sup['name'],
            aiScore: (_a = sup['ai_score']) !== null && _a !== void 0 ? _a : undefined,
        };
    }
    category(product) {
        const cat = product.category;
        if (!cat)
            return null;
        return {
            id: cat['id'],
            name: cat['name'],
        };
    }
};
exports.ProductsResolver = ProductsResolver;
__decorate([
    (0, graphql_1.Query)(() => [product_types_1.ProductType], {
        description: 'Search products by name, generic name, or barcode. Returns up to 20 results ordered by relevance.',
    }),
    __param(0, (0, graphql_1.Args)('query', { description: 'Search term — min 2 characters' })),
    __param(1, (0, graphql_1.Args)('branchId', { type: () => String, description: 'Branch UUID for stock filtering' })),
    __param(2, (0, graphql_1.Args)('limit', { type: () => graphql_1.Int, defaultValue: 20, nullable: true })),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number, Object]),
    __metadata("design:returntype", Promise)
], ProductsResolver.prototype, "searchProducts", null);
__decorate([
    (0, graphql_1.ResolveField)(() => product_types_1.ProductInventoryType, { nullable: true }),
    __param(0, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], ProductsResolver.prototype, "inventory", null);
__decorate([
    (0, graphql_1.ResolveField)(() => product_types_1.ProductImageType, { nullable: true }),
    __param(0, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], ProductsResolver.prototype, "image", null);
__decorate([
    (0, graphql_1.ResolveField)(() => product_types_1.ProductSupplierType, { nullable: true }),
    __param(0, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], ProductsResolver.prototype, "supplier", null);
__decorate([
    (0, graphql_1.ResolveField)(() => product_types_1.ProductCategoryType, { nullable: true }),
    __param(0, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], ProductsResolver.prototype, "category", null);
exports.ProductsResolver = ProductsResolver = __decorate([
    (0, graphql_1.Resolver)(() => product_types_1.ProductType),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [products_service_1.ProductsService])
], ProductsResolver);
//# sourceMappingURL=products.resolver.js.map