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
exports.RequireFeature = exports.SubscriptionGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const graphql_1 = require("@nestjs/graphql");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const constants_1 = require("../../config/constants");
const subscription_entity_1 = require("../entities/subscription.entity");
const sales_effective_at_service_1 = require("../../sales/sales-effective-at.service");
let SubscriptionGuard = class SubscriptionGuard {
    constructor(reflector, subscriptionRepo, dataSource, effectiveSaleAt) {
        this.reflector = reflector;
        this.subscriptionRepo = subscriptionRepo;
        this.dataSource = dataSource;
        this.effectiveSaleAt = effectiveSaleAt;
    }
    async canActivate(context) {
        var _a, _b;
        const ctx = graphql_1.GqlExecutionContext.create(context);
        const gqlCtx = ctx.getContext();
        const user = (_a = gqlCtx === null || gqlCtx === void 0 ? void 0 : gqlCtx.req) === null || _a === void 0 ? void 0 : _a.user;
        if ((user === null || user === void 0 ? void 0 : user.role) === 'se_admin') {
            return true;
        }
        if (!(user === null || user === void 0 ? void 0 : user.branchId)) {
            throw new common_1.ForbiddenException('No branch context');
        }
        const requiredFeature = this.reflector.get('subscription_feature', context.getHandler());
        if (!requiredFeature) {
            return true;
        }
        const organizationId = await this.resolveOrganizationId(user.branchId);
        if (!organizationId) {
            throw new common_1.ForbiddenException('No organization context');
        }
        const subscription = await this.subscriptionRepo.findOne({
            where: { organizationId },
            order: { updatedAt: 'DESC' },
        });
        if (subscription && subscription.status !== 'ACTIVE') {
            throw new common_1.ForbiddenException({
                code: 'SUBSCRIPTION_INACTIVE',
                message: 'Your subscription is not active. Please update your payment method.',
            });
        }
        const tier = ((_b = subscription === null || subscription === void 0 ? void 0 : subscription.tier) !== null && _b !== void 0 ? _b : 'FREE');
        const tierConfig = constants_1.SUBSCRIPTION_TIERS[tier];
        if (!tierConfig.features.includes(requiredFeature)) {
            throw new common_1.ForbiddenException({
                code: 'FEATURE_NOT_AVAILABLE',
                message: `This feature requires ${requiredFeature.replace(/_/g, ' ')} which is not available in your ${tierConfig.name} plan.`,
                upgradeUrl: '/settings/subscription',
            });
        }
        await this.assertUsageWithinLimits(organizationId, tier);
        return true;
    }
    async resolveOrganizationId(branchId) {
        var _a;
        const [row] = (await this.dataSource.query(`SELECT organization_id FROM branches WHERE id = $1 AND is_active = true`, [branchId]));
        return (_a = row === null || row === void 0 ? void 0 : row.organization_id) !== null && _a !== void 0 ? _a : null;
    }
    async assertUsageWithinLimits(organizationId, tier) {
        const limits = constants_1.SUBSCRIPTION_TIERS[tier];
        const [row] = (await this.dataSource.query(`
      SELECT
        (SELECT COUNT(*)::int FROM branches WHERE organization_id = $1 AND is_active = true) AS branches,
        (SELECT COUNT(*)::int FROM users u
          INNER JOIN branches b ON b.id = u.branch_id
          WHERE b.organization_id = $1 AND u.is_active = true) AS users,
        (SELECT COUNT(DISTINCT p.id)::int
          FROM products p
          INNER JOIN inventory i ON i.product_id = p.id
          INNER JOIN branches b ON b.id = i.branch_id
          WHERE b.organization_id = $1 AND p.is_active = true) AS products,
        (SELECT COUNT(*)::int FROM sales s
          INNER JOIN branches b ON b.id = s.branch_id
          WHERE b.organization_id = $1
            AND s.status = 'COMPLETED'
            AND (${this.effectiveSaleAt.sql('s')}) >= date_trunc('month', NOW() AT TIME ZONE 'Africa/Accra')) AS sales_month
    `, [organizationId]));
        const u = row;
        if (!u)
            return;
        if (u.branches > limits.maxBranches) {
            throw new common_1.ForbiddenException({
                code: 'SUBSCRIPTION_LIMIT_BRANCHES',
                message: `Your plan allows ${limits.maxBranches} branch(es). Remove a branch or upgrade.`,
                upgradeUrl: '/settings/subscription',
            });
        }
        if (u.users > limits.maxUsers) {
            throw new common_1.ForbiddenException({
                code: 'SUBSCRIPTION_LIMIT_USERS',
                message: `Your plan allows ${limits.maxUsers} user(s). Deactivate users or upgrade.`,
                upgradeUrl: '/settings/subscription',
            });
        }
        if (u.products > limits.maxProducts) {
            throw new common_1.ForbiddenException({
                code: 'SUBSCRIPTION_LIMIT_PRODUCTS',
                message: `Your plan allows ${limits.maxProducts} stocked product(s). Archive products or upgrade.`,
                upgradeUrl: '/settings/subscription',
            });
        }
        if (u.sales_month > limits.maxSalesPerMonth) {
            throw new common_1.ForbiddenException({
                code: 'SUBSCRIPTION_LIMIT_SALES',
                message: `Your plan allows ${limits.maxSalesPerMonth} completed sales this month. Upgrade for a higher limit.`,
                upgradeUrl: '/settings/subscription',
            });
        }
    }
};
exports.SubscriptionGuard = SubscriptionGuard;
exports.SubscriptionGuard = SubscriptionGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(subscription_entity_1.Subscription)),
    __metadata("design:paramtypes", [core_1.Reflector,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        sales_effective_at_service_1.SalesEffectiveAtService])
], SubscriptionGuard);
const RequireFeature = (feature) => Reflect.metadata('subscription_feature', feature);
exports.RequireFeature = RequireFeature;
//# sourceMappingURL=subscription.guard.js.map