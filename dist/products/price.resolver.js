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
exports.PriceResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const price_service_1 = require("./price.service");
const price_types_1 = require("./dto/price.types");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
let PriceResolver = class PriceResolver {
    constructor(priceService) {
        this.priceService = priceService;
    }
    async updateProductPrice(input, actor) {
        return this.priceService.updatePrice(input, actor);
    }
    async bulkUpdateProductPrices(input, actor) {
        return this.priceService.bulkUpdatePrices(input, actor);
    }
    async setUsdExchangeRate(input, actor) {
        return this.priceService.setExchangeRate(input, actor);
    }
    async currentExchangeRate() {
        return this.priceService.getExchangeRate();
    }
    async productPriceHistory(productId, limit) {
        return this.priceService.getPriceHistory(productId, limit);
    }
    async latestProductCosts(productIds, actor) {
        return this.priceService.getLatestProductCosts(productIds, actor.branchId);
    }
};
exports.PriceResolver = PriceResolver;
__decorate([
    (0, graphql_1.Mutation)(() => price_types_1.PriceUpdateResult),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [price_types_1.UpdatePriceInput, Object]),
    __metadata("design:returntype", Promise)
], PriceResolver.prototype, "updateProductPrice", null);
__decorate([
    (0, graphql_1.Mutation)(() => [price_types_1.PriceUpdateResult]),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [price_types_1.BulkUpdatePriceInput, Object]),
    __metadata("design:returntype", Promise)
], PriceResolver.prototype, "bulkUpdateProductPrices", null);
__decorate([
    (0, graphql_1.Mutation)(() => price_types_1.ExchangeRate),
    (0, roles_decorator_1.Roles)('owner', 'se_admin'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [price_types_1.SetExchangeRateInput, Object]),
    __metadata("design:returntype", Promise)
], PriceResolver.prototype, "setUsdExchangeRate", null);
__decorate([
    (0, graphql_1.Query)(() => price_types_1.ExchangeRate, { nullable: true }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'cashier', 'chemical_cashier'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PriceResolver.prototype, "currentExchangeRate", null);
__decorate([
    (0, graphql_1.Query)(() => [price_types_1.PriceHistory]),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, graphql_1.Args)('productId')),
    __param(1, (0, graphql_1.Args)('limit', { type: () => graphql_1.Int, defaultValue: 20 })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], PriceResolver.prototype, "productPriceHistory", null);
__decorate([
    (0, graphql_1.Query)(() => [price_types_1.ProductCostSnapshot], {
        description: 'Latest observed supplier unit costs for a set of products in the current branch. ' +
            'Used by pricing control to prefill cost baselines from GRN/invoice ingestion.',
    }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, graphql_1.Args)('productIds', { type: () => [graphql_1.ID] })),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", Promise)
], PriceResolver.prototype, "latestProductCosts", null);
exports.PriceResolver = PriceResolver = __decorate([
    (0, swagger_1.ApiTags)('products'),
    (0, swagger_1.ApiBearerAuth)('JWT'),
    (0, graphql_1.Resolver)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [price_service_1.PriceService])
], PriceResolver);
//# sourceMappingURL=price.resolver.js.map