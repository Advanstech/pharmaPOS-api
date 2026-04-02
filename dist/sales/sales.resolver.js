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
exports.SalesResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const common_1 = require("@nestjs/common");
const sales_service_1 = require("./sales.service");
const sale_types_1 = require("./dto/sale.types");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const pom_enforcement_guard_1 = require("../auth/guards/pom-enforcement.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
let SalesResolver = class SalesResolver {
    constructor(salesService) {
        this.salesService = salesService;
    }
    createSale(input, actor) {
        return this.salesService.createSale(input, actor);
    }
    sale(id, actor) {
        return this.salesService.getSale(id, actor);
    }
    recentSales(actor, limit) {
        return this.salesService.getRecentSales(actor, limit);
    }
    dailySummary(actor, date) {
        return this.salesService.getDailySummary(actor, date);
    }
};
exports.SalesResolver = SalesResolver;
__decorate([
    (0, graphql_1.Mutation)(() => sale_types_1.SaleOutput, { name: 'createSale' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'cashier', 'chemical_cashier', 'pharmacist', 'head_pharmacist', 'technician'),
    (0, common_1.UseGuards)(pom_enforcement_guard_1.PomEnforcementGuard),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sale_types_1.CreateSaleInput, Object]),
    __metadata("design:returntype", Promise)
], SalesResolver.prototype, "createSale", null);
__decorate([
    (0, graphql_1.Query)(() => sale_types_1.SaleOutput, { name: 'sale' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'cashier', 'chemical_cashier', 'pharmacist', 'head_pharmacist', 'technician'),
    __param(0, (0, graphql_1.Args)('id', { type: () => graphql_1.ID })),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SalesResolver.prototype, "sale", null);
__decorate([
    (0, graphql_1.Query)(() => [sale_types_1.SaleOutput], { name: 'recentSales' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'cashier', 'chemical_cashier', 'pharmacist', 'head_pharmacist'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, graphql_1.Args)('limit', { type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], SalesResolver.prototype, "recentSales", null);
__decorate([
    (0, graphql_1.Query)(() => sale_types_1.DailySummary, { name: 'dailySummary' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'cashier', 'chemical_cashier', 'pharmacist', 'head_pharmacist', 'technician'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, graphql_1.Args)('date', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SalesResolver.prototype, "dailySummary", null);
exports.SalesResolver = SalesResolver = __decorate([
    (0, graphql_1.Resolver)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [sales_service_1.SalesService])
], SalesResolver);
//# sourceMappingURL=sales.resolver.js.map