import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import {
  RevenueReport, TopProduct, DashboardKpis,
  DailyRevenuePoint, HourlySalesPoint, CategoryBreakdown, StaffPerformance,
  PaymentMethodBreakdown,
} from './dto/reports.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsResolver {
  constructor(private readonly reportsService: ReportsService) {}

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

  @Query(() => DashboardKpis, { name: 'dashboardKpis' })
  @Roles('owner', 'se_admin', 'manager')
  dashboardKpis(@CurrentUser() actor: JwtUser): Promise<DashboardKpis> {
    return this.reportsService.getDashboardKpis(actor.branchId);
  }

  @Query(() => [DailyRevenuePoint], { name: 'dailyRevenueTrend' })
  @Roles('owner', 'se_admin', 'manager')
  dailyRevenueTrend(
    @CurrentUser() actor: JwtUser,
    @Args('periodStart') periodStart: string,
    @Args('periodEnd') periodEnd: string,
  ): Promise<DailyRevenuePoint[]> {
    return this.reportsService.getDailyRevenueTrend(actor.branchId, periodStart, periodEnd);
  }

  @Query(() => [HourlySalesPoint], { name: 'hourlySales' })
  @Roles('owner', 'se_admin', 'manager')
  hourlySales(
    @CurrentUser() actor: JwtUser,
    @Args('periodStart') periodStart: string,
    @Args('periodEnd') periodEnd: string,
  ): Promise<HourlySalesPoint[]> {
    return this.reportsService.getHourlySales(actor.branchId, periodStart, periodEnd);
  }

  @Query(() => [CategoryBreakdown], { name: 'categoryBreakdown' })
  @Roles('owner', 'se_admin', 'manager')
  categoryBreakdown(
    @CurrentUser() actor: JwtUser,
    @Args('periodStart') periodStart: string,
    @Args('periodEnd') periodEnd: string,
  ): Promise<CategoryBreakdown[]> {
    return this.reportsService.getCategoryBreakdown(actor.branchId, periodStart, periodEnd);
  }

  @Query(() => [StaffPerformance], { name: 'staffPerformance' })
  @Roles('owner', 'se_admin', 'manager')
  staffPerformance(
    @CurrentUser() actor: JwtUser,
    @Args('periodStart') periodStart: string,
    @Args('periodEnd') periodEnd: string,
  ): Promise<StaffPerformance[]> {
    return this.reportsService.getStaffPerformance(actor.branchId, periodStart, periodEnd);
  }

  @Query(() => [PaymentMethodBreakdown], { name: 'paymentMethodBreakdown', description: 'Revenue breakdown by payment method (Cash, MoMo, Card) for a period.' })
  @Roles('owner', 'se_admin', 'manager')
  paymentMethodBreakdown(
    @CurrentUser() actor: JwtUser,
    @Args('periodStart') periodStart: string,
    @Args('periodEnd') periodEnd: string,
  ): Promise<PaymentMethodBreakdown[]> {
    return this.reportsService.getPaymentMethodBreakdown(actor.branchId, periodStart, periodEnd);
  }
}
