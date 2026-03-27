import { Resolver, Mutation, Query, Args, Int, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PriceService } from './price.service';
import {
  UpdatePriceInput,
  BulkUpdatePriceInput,
  SetExchangeRateInput,
  PriceHistory,
  ExchangeRate,
  PriceUpdateResult,
  ProductCostSnapshot,
} from './dto/price.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@ApiTags('products')
@ApiBearerAuth('JWT')
@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class PriceResolver {
  constructor(private readonly priceService: PriceService) {}

  // ── Mutations ─────────────────────────────────────────────────────────────

  @Mutation(() => PriceUpdateResult)
  // RBAC: owner, se_admin, manager only — cashiers/pharmacists cannot change prices
  @Roles('owner', 'se_admin', 'manager')
  async updateProductPrice(
    @Args('input') input: UpdatePriceInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<PriceUpdateResult> {
    return this.priceService.updatePrice(input, actor);
  }

  @Mutation(() => [PriceUpdateResult])
  // RBAC: owner, se_admin, manager only
  @Roles('owner', 'se_admin', 'manager')
  async bulkUpdateProductPrices(
    @Args('input') input: BulkUpdatePriceInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<PriceUpdateResult[]> {
    return this.priceService.bulkUpdatePrices(input, actor);
  }

  @Mutation(() => ExchangeRate)
  // RBAC: owner, se_admin only — exchange rate is a system-level setting
  @Roles('owner', 'se_admin')
  async setUsdExchangeRate(
    @Args('input') input: SetExchangeRateInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<ExchangeRate> {
    return this.priceService.setExchangeRate(input, actor);
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  @Query(() => ExchangeRate, { nullable: true })
  // RBAC: all authenticated users can view the exchange rate
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'cashier', 'chemical_cashier')
  async currentExchangeRate(): Promise<ExchangeRate | null> {
    return this.priceService.getExchangeRate();
  }

  @Query(() => [PriceHistory])
  // RBAC: owner, se_admin, manager can view price history
  @Roles('owner', 'se_admin', 'manager')
  async productPriceHistory(
    @Args('productId') productId: string,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
  ): Promise<PriceHistory[]> {
    return this.priceService.getPriceHistory(productId, limit);
  }

  @Query(() => [ProductCostSnapshot], {
    description:
      'Latest observed supplier unit costs for a set of products in the current branch. ' +
      'Used by pricing control to prefill cost baselines from GRN/invoice ingestion.',
  })
  @Roles('owner', 'se_admin', 'manager')
  async latestProductCosts(
    @Args('productIds', { type: () => [ID] }) productIds: string[],
    @CurrentUser() actor: JwtUser,
  ): Promise<ProductCostSnapshot[]> {
    return this.priceService.getLatestProductCosts(productIds, actor.branchId);
  }
}
