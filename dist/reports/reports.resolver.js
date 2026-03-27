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
exports.ReportsResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const common_1 = require("@nestjs/common");
const reports_service_1 = require("./reports.service");
const reports_types_1 = require("./dto/reports.types");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
let ReportsResolver = class ReportsResolver {
    constructor(reportsService) {
        this.reportsService = reportsService;
    }
    revenueReport(actor, periodStart, periodEnd) {
        return this.reportsService.getRevenueReport(actor.branchId, periodStart, periodEnd);
    }
    topProducts(actor, periodStart, periodEnd, limit) {
        return this.reportsService.getTopProducts(actor.branchId, periodStart, periodEnd, limit);
    }
    dashboardKpis(actor) {
        return this.reportsService.getDashboardKpis(actor.branchId);
    }
};
exports.ReportsResolver = ReportsResolver;
__decorate([
    (0, graphql_1.Query)(() => reports_types_1.RevenueReport, { name: 'revenueReport' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, graphql_1.Args)('periodStart')),
    __param(2, (0, graphql_1.Args)('periodEnd')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ReportsResolver.prototype, "revenueReport", null);
__decorate([
    (0, graphql_1.Query)(() => [reports_types_1.TopProduct], { name: 'topProducts' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, graphql_1.Args)('periodStart')),
    __param(2, (0, graphql_1.Args)('periodEnd')),
    __param(3, (0, graphql_1.Args)('limit', { type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Number]),
    __metadata("design:returntype", Promise)
], ReportsResolver.prototype, "topProducts", null);
__decorate([
    (0, graphql_1.Query)(() => reports_types_1.DashboardKpis, { name: 'dashboardKpis' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReportsResolver.prototype, "dashboardKpis", null);
exports.ReportsResolver = ReportsResolver = __decorate([
    (0, graphql_1.Resolver)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [reports_service_1.ReportsService])
], ReportsResolver);
//# sourceMappingURL=reports.resolver.js.map