import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleInput, SaleOutput, DailySummary, RefundRequestOutput } from './dto/sale.types';
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

  @Mutation(() => SaleOutput, {
    name: 'refundSale',
    description: 'Refund a completed sale within 24 hours. Reverses inventory. Requires manager/owner authorization.',
  })
  @Roles('owner', 'se_admin', 'manager')
  refundSale(
    @Args('saleId', { type: () => ID }) saleId: string,
    @Args('reason') reason: string,
    @CurrentUser() actor: JwtUser,
  ): Promise<SaleOutput> {
    return this.salesService.refundSale(saleId, reason, actor);
  }

  // ── Refund Request Flow (cashier → manager approval) ──────────────────────

  @Mutation(() => RefundRequestOutput, {
    name: 'requestRefund',
    description: 'Cashier/pharmacist requests a refund. Manager must approve.',
  })
  @Roles('owner', 'se_admin', 'manager', 'cashier', 'chemical_cashier', 'pharmacist', 'head_pharmacist', 'technician')
  requestRefund(
    @Args('saleId', { type: () => ID }) saleId: string,
    @Args('reason') reason: string,
    @CurrentUser() actor: JwtUser,
  ): Promise<RefundRequestOutput> {
    return this.salesService.requestRefund(saleId, reason, actor);
  }

  @Query(() => [RefundRequestOutput], {
    name: 'refundRequests',
    description: 'List refund requests for the branch. Pending first.',
  })
  @Roles('owner', 'se_admin', 'manager')
  refundRequests(@CurrentUser() actor: JwtUser): Promise<RefundRequestOutput[]> {
    return this.salesService.listRefundRequests(actor);
  }

  @Query(() => RefundRequestOutput, {
    name: 'refundRequest',
    nullable: true,
    description: 'Get a single refund request by ID.',
  })
  @Roles('owner', 'se_admin', 'manager')
  refundRequest(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() actor: JwtUser,
  ): Promise<RefundRequestOutput | null> {
    return this.salesService.getRefundRequest(id, actor);
  }

  @Mutation(() => SaleOutput, {
    name: 'approveRefundRequest',
    description: 'Manager approves a refund request — executes the refund.',
  })
  @Roles('owner', 'se_admin', 'manager')
  approveRefundRequest(
    @Args('requestId', { type: () => ID }) requestId: string,
    @Args('notes', { nullable: true }) notes: string,
    @CurrentUser() actor: JwtUser,
  ): Promise<SaleOutput> {
    return this.salesService.approveRefundRequest(requestId, notes, actor);
  }

  @Mutation(() => Boolean, {
    name: 'rejectRefundRequest',
    description: 'Manager rejects a refund request.',
  })
  @Roles('owner', 'se_admin', 'manager')
  rejectRefundRequest(
    @Args('requestId', { type: () => ID }) requestId: string,
    @Args('notes') notes: string,
    @CurrentUser() actor: JwtUser,
  ): Promise<boolean> {
    return this.salesService.rejectRefundRequest(requestId, notes, actor);
  }
}
