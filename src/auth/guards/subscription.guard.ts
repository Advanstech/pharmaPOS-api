import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SUBSCRIPTION_TIERS, type SubscriptionTier } from '../../config/constants';
import { Subscription } from '../entities/subscription.entity';
import { SalesEffectiveAtService } from '../../sales/sales-effective-at.service';

/**
 * SaaS subscription enforcement guard.
 * Resolves organization from the user's branch, loads subscription tier, and (when
 * `@RequireFeature('…')` is set) checks tier features and usage limits.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    private readonly dataSource: DataSource,
    private readonly effectiveSaleAt: SalesEffectiveAtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const gqlCtx = ctx.getContext() as { req?: { user?: unknown } } | undefined;
    const user = gqlCtx?.req?.user as { branchId?: string; role?: string } | undefined;

    // Platform admins must not be blocked by missing/legacy JWT `branchId` (DB user still has branch_id).
    if (user?.role === 'se_admin') {
      return true;
    }

    if (!user?.branchId) {
      throw new ForbiddenException('No branch context');
    }

    const requiredFeature = this.reflector.get<string>('subscription_feature', context.getHandler());
    if (!requiredFeature) {
      return true;
    }

    const organizationId = await this.resolveOrganizationId(user.branchId);
    if (!organizationId) {
      throw new ForbiddenException('No organization context');
    }

    const subscription = await this.subscriptionRepo.findOne({
      where: { organizationId },
      order: { updatedAt: 'DESC' },
    });

    if (subscription && subscription.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_INACTIVE',
        message: 'Your subscription is not active. Please update your payment method.',
      });
    }

    const tier = (subscription?.tier ?? 'FREE') as SubscriptionTier;
    const tierConfig = SUBSCRIPTION_TIERS[tier];

    if (!tierConfig.features.includes(requiredFeature as never)) {
      throw new ForbiddenException({
        code: 'FEATURE_NOT_AVAILABLE',
        message: `This feature requires ${requiredFeature.replace(/_/g, ' ')} which is not available in your ${tierConfig.name} plan.`,
        upgradeUrl: '/settings/subscription',
      });
    }

    await this.assertUsageWithinLimits(organizationId, tier);

    return true;
  }

  private async resolveOrganizationId(branchId: string): Promise<string | null> {
    const [row] = (await this.dataSource.query(
      `SELECT organization_id FROM branches WHERE id = $1 AND is_active = true`,
      [branchId],
    )) as Array<{ organization_id: string }>;
    return row?.organization_id ?? null;
  }

  private async assertUsageWithinLimits(organizationId: string, tier: SubscriptionTier): Promise<void> {
    const limits = SUBSCRIPTION_TIERS[tier];

    const [row] = (await this.dataSource.query(
      `
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
    `,
      [organizationId],
    )) as Array<{
      branches: number;
      users: number;
      products: number;
      sales_month: number;
    }>;

    const u = row;
    if (!u) return;

    if (u.branches > limits.maxBranches) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_LIMIT_BRANCHES',
        message: `Your plan allows ${limits.maxBranches} branch(es). Remove a branch or upgrade.`,
        upgradeUrl: '/settings/subscription',
      });
    }
    if (u.users > limits.maxUsers) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_LIMIT_USERS',
        message: `Your plan allows ${limits.maxUsers} user(s). Deactivate users or upgrade.`,
        upgradeUrl: '/settings/subscription',
      });
    }
    if (u.products > limits.maxProducts) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_LIMIT_PRODUCTS',
        message: `Your plan allows ${limits.maxProducts} stocked product(s). Archive products or upgrade.`,
        upgradeUrl: '/settings/subscription',
      });
    }
    if (u.sales_month > limits.maxSalesPerMonth) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_LIMIT_SALES',
        message: `Your plan allows ${limits.maxSalesPerMonth} completed sales this month. Upgrade for a higher limit.`,
        upgradeUrl: '/settings/subscription',
      });
    }
  }
}

/**
 * Decorator to require a subscription feature
 * Usage: @RequireFeature('ai_insights')
 */
export const RequireFeature = (feature: string) =>
  Reflect.metadata('subscription_feature', feature);
