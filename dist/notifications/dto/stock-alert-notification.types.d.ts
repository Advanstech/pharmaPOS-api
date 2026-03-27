export declare class StockAlertNotification {
    id: string;
    productId: string;
    productName: string;
    stockStatus: string;
    quantityOnHand: number;
    reorderLevel: number;
    suggestedReorderQty: number;
    supplierId?: string;
    supplierName?: string;
    supplierPhone?: string;
    channels: string[];
    message: string;
    createdAt: Date;
}
