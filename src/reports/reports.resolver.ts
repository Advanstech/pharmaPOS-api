import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { RevenueReport, TopProduct, DashboardKpis } from './dto/reports.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsResolver {
  constructor(private readonly reportsService: ReportsService) {}

  // RBAC: owner, se_admin, manager only
  @Query(() => RevenueReport, { name: 'revenueReport' })
  @Roles('owner', 'se_admin', 'manager')
  revenueReport(
    @CurrentUser() actor: JwtUser,
    @Args('periodStart') periodStart: string,
    @Args('periodEnd') periodEnd: string,
  ): Promise<RevenueReport> {
    return this.reportsService.getRevenueReport(actor.branchId, periodStart, periodEnd);
  }

  @Query(() => [TopProduct], { name: 'topProducts' })
  @Roles('owner', 'se_admin', 'manager')
  topProducts(
    @CurrentUser() actor: JwtUser,
    @Args('periodStart') periodStart: string,
    @Args('periodEnd') periodEnd: string,
    @Args('limit', { type: () => Number, nullable: true }) limit?: number,
  ): Promise<TopProduct[]> {
    return this.reportsService.getTopProducts(actor.branchId, periodStart, periodEnd, limit);
  }

  // Dashboard KPIs — used by /dashboard overview page
  @Query(() => DashboardKpis, { name: 'dashboardKpis' })
  @Roles('owner', 'se_admin', 'manager')
  dashboardKpis(@CurrentUser() actor: JwtUser): Promise<DashboardKpis> {
    return this.reportsService.getDashboardKpis(actor.branchId);
  }
}
