import { InventoryService } from './inventory.service';
import { AdjustStockInput, ReceiveStockInput, InventoryItem, StockMovementOutput, LowStockAlert, CreateGRNInput, GRNOutput } from './dto/inventory.types';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { RealtimeStockService, StockChangedEventPayload } from './realtime-stock.service';
export declare class InventoryResolver {
    private readonly inventoryService;
    private readonly realtimeStock;
    constructor(inventoryService: InventoryService, realtimeStock: RealtimeStockService);
    inventory(actor: JwtUser): Promise<InventoryItem[]>;
    lowStockAlerts(actor: JwtUser): Promise<LowStockAlert[]>;
    stockMovements(productId: string, actor: JwtUser, limit?: number): Promise<StockMovementOutput[]>;
    adjustStock(input: AdjustStockInput, actor: JwtUser): Promise<InventoryItem>;
    receiveStock(input: ReceiveStockInput, actor: JwtUser): Promise<InventoryItem>;
    createGRN(input: CreateGRNInput, actor: JwtUser): Promise<GRNOutput>;
    grn(id: string, _actor: JwtUser): Promise<GRNOutput>;
    listGRNs(actor: JwtUser, limit?: number): Promise<GRNOutput[]>;
    stockChanged(_branchId?: string): AsyncIterableIterator<{
        stockChanged: StockChangedEventPayload;
    }>;
}
