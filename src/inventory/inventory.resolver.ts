import { Resolver, Query, Mutation, Args, ID, Int, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import {
  AdjustStockInput,
  ReceiveStockInput,
  InventoryItem,
  StockMovementOutput,
  LowStockAlert,
  CreateGRNInput,
  GRNOutput,
  StockChangedEvent,
} from './dto/inventory.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { RealtimeStockService, StockChangedEventPayload } from './realtime-stock.service';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryResolver {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly realtimeStock: RealtimeStockService,
  ) {}

  @Query(() => [InventoryItem], { name: 'inventory' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician')
  inventory(@CurrentUser() actor: JwtUser): Promise<InventoryItem[]> {
    return this.inventoryService.listInventory(actor.branchId);
  }

  @Query(() => [LowStockAlert], { name: 'lowStockAlerts' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist')
  lowStockAlerts(@CurrentUser() actor: JwtUser): Promise<LowStockAlert[]> {
    return this.inventoryService.getLowStockAlerts(actor.branchId);
  }

  @Query(() => [StockMovementOutput], { name: 'stockMovements' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician')
  stockMovements(
    @Args('productId', { type: () => ID }) productId: string,
    @CurrentUser() actor: JwtUser,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<StockMovementOutput[]> {
    return this.inventoryService.getStockMovements(productId, actor.branchId, limit);
  }

  // RBAC: owner, se_admin, manager, head_pharmacist only — cashiers cannot adjust stock
  @Mutation(() => InventoryItem, { name: 'adjustStock' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist')
  adjustStock(
    @Args('input') input: AdjustStockInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<InventoryItem> {
    return this.inventoryService.adjustStock(input, actor);
  }

  @Mutation(() => InventoryItem, { name: 'receiveStock' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician')
  receiveStock(
    @Args('input') input: ReceiveStockInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<InventoryItem> {
    return this.inventoryService.receiveStock(input, actor);
  }

  // ── GRN (Goods Received Note) Workflow ───────────────────────────────────

  // RBAC: owner, se_admin, manager, head_pharmacist, technician — receive stock from supplier
  @Mutation(() => GRNOutput, { name: 'createGRN' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'technician')
  createGRN(
    @Args('input') input: CreateGRNInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<GRNOutput> {
    return this.inventoryService.createGRN(input, actor);
  }

  @Query(() => GRNOutput, { name: 'grn' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist')
  grn(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() _actor: JwtUser,
  ): Promise<GRNOutput> {
    return this.inventoryService.getGRN(id);
  }

  @Query(() => [GRNOutput], { name: 'listGRNs' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist')
  listGRNs(
    @CurrentUser() actor: JwtUser,
    @Args('limit', { type: () => Number, nullable: true }) limit?: number,
  ): Promise<GRNOutput[]> {
    return this.inventoryService.listGRNs(actor.branchId, limit);
  }

  @Subscription(() => StockChangedEvent, {
    name: 'stockChanged',
    filter: (
      payload: { stockChanged: StockChangedEventPayload },
      variables: { branchId?: string },
    ) => !variables.branchId || payload.stockChanged.branchId === variables.branchId,
    resolve: (payload: { stockChanged: StockChangedEventPayload }) => payload.stockChanged,
  })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician', 'cashier', 'chemical_cashier')
  stockChanged(
    @Args('branchId', { type: () => ID, nullable: true }) _branchId?: string,
  ): AsyncIterableIterator<{ stockChanged: StockChangedEventPayload }> {
    return this.realtimeStock.asyncIterator();
  }
}
