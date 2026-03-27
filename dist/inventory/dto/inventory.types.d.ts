export declare class AdjustStockInput {
    productId: string;
    quantityDelta: number;
    reason: string;
    batchNumber?: string;
    expiryDate?: string;
}
export declare class ReceiveStockInput {
    productId: string;
    quantity: number;
    batchNumber?: string;
    expiryDate?: string;
    purchaseOrderId?: string;
}
export declare class InventoryItem {
    productId: string;
    productName: string;
    classification: string;
    quantityOnHand: number;
    reorderLevel: number;
    stockStatus: string;
    nearestExpiry?: Date;
    supplierId?: string;
    supplierName?: string;
}
export declare class StockMovementOutput {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    movementType: string;
    batchNumber?: string;
    expiryDate?: Date;
    createdAt: Date;
}
export declare class LowStockAlert {
    productId: string;
    productName: string;
    quantityOnHand: number;
    reorderLevel: number;
    status: string;
}
export declare class StockChangedEvent {
    productId: string;
    branchId: string;
    quantityOnHand: number;
    reorderLevel: number;
    stockStatus: string;
    changedAt: Date;
}
export declare class GRNItemInput {
    productId: string;
    quantity: number;
    batchNumber: string;
    expiryDate: string;
    imageS3Key?: string;
    unitCostPesewas?: number;
}
export declare class CreateGRNInput {
    supplierId: string;
    purchaseOrderId?: string;
    supplierInvoiceNumber: string;
    invoiceDate: string;
    dueDate?: string;
    totalAmountPesewas: number;
    invoicePdfS3Key?: string;
    items: GRNItemInput[];
    notes?: string;
}
export declare class GRNItemOutput {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    batchNumber: string;
    expiryDate: Date;
    imageS3Key?: string;
    unitCostPesewas?: number;
}
export declare class GRNOutput {
    id: string;
    branchId: string;
    supplierId: string;
    supplierName: string;
    purchaseOrderId?: string;
    supplierInvoiceNumber: string;
    invoiceDate: Date;
    dueDate?: Date;
    totalAmountPesewas: number;
    totalAmountFormatted: string;
    invoicePdfS3Key?: string;
    items: GRNItemOutput[];
    notes?: string;
    receivedBy: string;
    receivedByName: string;
    receivedAt: Date;
    isMatched: boolean;
}
