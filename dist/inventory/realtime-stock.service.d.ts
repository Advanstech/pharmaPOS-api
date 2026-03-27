export interface StockChangedEventPayload {
    productId: string;
    branchId: string;
    quantityOnHand: number;
    reorderLevel: number;
    stockStatus: string;
    changedAt: Date;
}
interface StockChangedSeed {
    productId: string;
    branchId: string;
    quantityOnHand: number;
    reorderLevel: number;
}
export declare class RealtimeStockService {
    private static readonly EVENT_NAME;
    private readonly emitter;
    publishStockChanged(seed: StockChangedSeed): void;
    onStockChanged(listener: (payload: StockChangedEventPayload) => void): () => void;
    asyncIterator(): AsyncIterableIterator<{
        stockChanged: StockChangedEventPayload;
    }>;
    private calcStockStatus;
}
export {};
