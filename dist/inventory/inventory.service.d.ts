import { DataSource } from 'typeorm';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { RealtimeStockService } from './realtime-stock.service';
import { AdjustStockInput, ReceiveStockInput, InventoryItem, StockMovementOutput, LowStockAlert } from './dto/inventory.types';
export declare class InventoryService {
    private readonly dataSource;
    private readonly realtimeStock;
    private readonly logger;
    constructor(dataSource: DataSource, realtimeStock: RealtimeStockService);
    listInventory(branchId: string): Promise<InventoryItem[]>;
    getLowStockAlerts(branchId: string): Promise<LowStockAlert[]>;
    adjustStock(input: AdjustStockInput, actor: JwtUser): Promise<InventoryItem>;
    receiveStock(input: ReceiveStockInput, actor: JwtUser): Promise<InventoryItem>;
    getStockMovements(productId: string, branchId: string, limit?: number): Promise<StockMovementOutput[]>;
    createGRN(input: import('./dto/inventory.types').CreateGRNInput, actor: JwtUser): Promise<import('./dto/inventory.types').GRNOutput>;
    getGRN(grnId: string): Promise<import('./dto/inventory.types').GRNOutput>;
    listGRNs(branchId: string, limit?: number): Promise<import('./dto/inventory.types').GRNOutput[]>;
    private calcStatus;
}
