export declare class SupplierProductStockSignal {
    productId: string;
    productName: string;
    quantityOnHand: number;
    reorderLevel: number;
    stockStatus: string;
}
export declare class SupplierRestockWatch {
    supplierId: string;
    supplierName: string;
    supplierPhone?: string;
    supplierEmail?: string;
    supplierAiScore?: number;
    totalTrackedProducts: number;
    lowStockCount: number;
    criticalStockCount: number;
    outOfStockCount: number;
    affectedProducts: SupplierProductStockSignal[];
}
