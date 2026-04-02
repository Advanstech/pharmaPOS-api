import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleInput, SaleOutput, DailySummary } from './dto/sale.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PomEnforcementGuard } from '../auth/guards/pom-enforcement.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesResolver {
  constructor(private readonly salesService: SalesService) {}

  // Ghana FDA: PomEnforcementGuard runs BEFORE createSale — cannot be bypassed
  @Mutation(() => SaleOutput, { name: 'createSale' })
  @Roles('owner', 'se_admin', 'manager', 'cashier', 'chemical_cashier', 'pharmacist', 'head_pharmacist', 'technician')
  @UseGuards(PomEnforcementGuard)
  createSale(
    @Args('input') input: CreateSaleInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<SaleOutput> {
    return this.salesService.createSale(input, actor);
  }

  @Query(() => SaleOutput, { name: 'sale' })
  @Roles('owner', 'se_admin', 'manager', 'cashier', 'chemical_cashier', 'pharmacist', 'head_pharmacist', 'technician')
  sale(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() actor: JwtUser,
  ): Promise<SaleOutput> {
    return this.salesService.getSale(id, actor);
  }

  @Query(() => [SaleOutput], { name: 'recentSales' })
  @Roles('owner', 'se_admin', 'manager', 'cashier', 'chemical_cashier', 'pharmacist', 'head_pharmacist')
  recentSales(
    @CurrentUser() actor: JwtUser,
    @Args('limit', { type: () => Number, nullable: true }) limit?: number,
  ): Promise<SaleOutput[]> {
    return this.salesService.getRecentSales(actor, limit);
  }

  @Query(() => DailySummary, { name: 'dailySummary' })
  @Roles('owner', 'se_admin', 'manager', 'cashier', 'chemical_cashier', 'pharmacist', 'head_pharmacist', 'technician')
  dailySummary(
    @CurrentUser() actor: JwtUser,
    @Args('date', { nullable: true }) date?: string,
  ): Promise<DailySummary> {
    return this.salesService.getDailySummary(actor, date);
  }
}
