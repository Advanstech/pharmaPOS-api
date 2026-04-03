import { InventoryService } from './inventory.service';
import { AdjustStockInput, ReceiveStockInput, InventoryItem, StockMovementOutput, LowStockAlert, CreateGRNInput, GRNOutput, CreateStockCountInput, UpdateStockCountInput, CompleteStockCountInput, StockCountSessionOutput, StockCountItemOutput } from './dto/inventory.types';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { RealtimeStockService, StockChangedEventPayload } from './realtime-stock.service';
import { StockCountService } from './stock-count.service';
export declare class InventoryResolver {
    private readonly inventoryService;
    private readonly realtimeStock;
    private readonly stockCountService;
    constructor(inventoryService: InventoryService, realtimeStock: RealtimeStockService, stockCountService: StockCountService);
    inventory(actor: JwtUser): Promise<InventoryItem[]>;
    lowStockAlerts(actor: JwtUser): Promise<LowStockAlert[]>;
    stockMovements(productId: string, actor: JwtUser, limit?: number): Promise<StockMovementOutput[]>;
    adjustStock(input: AdjustStockInput, actor: JwtUser): Promise<InventoryItem>;
    receiveStock(input: ReceiveStockInput, actor: JwtUser): Promise<InventoryItem>;
    createGRN(input: CreateGRNInput, actor: JwtUser): Promise<GRNOutput>;
    grn(id: string, _actor: JwtUser): Promise<GRNOutput>;
    listGRNs(actor: JwtUser, limit?: number): Promise<GRNOutput[]>;
    createStockCount(input: CreateStockCountInput, actor: JwtUser): Promise<StockCountSessionOutput>;
    updateStockCounts(input: UpdateStockCountInput, actor: JwtUser): Promise<StockCountItemOutput[]>;
    completeStockCount(input: CompleteStockCountInput, actor: JwtUser): Promise<StockCountSessionOutput>;
    stockCountSession(id: string, actor: JwtUser): Promise<StockCountSessionOutput | null>;
    stockCountItems(sessionId: string, actor: JwtUser): Promise<StockCountItemOutput[]>;
    listStockCounts(actor: JwtUser, limit?: number): Promise<StockCountSessionOutput[]>;
    cancelStockCount(sessionId: string, actor: JwtUser): Promise<boolean>;
    stockChanged(_branchId?: string): AsyncIterableIterator<{
        stockChanged: StockChangedEventPayload;
    }>;
}
