export declare class CreateProductInput {
    name: string;
    genericName?: string;
    barcode?: string;
    unitPrice: number;
    classification: string;
    branchType: string;
    vatExempt?: boolean;
    requiresRx?: boolean;
    categoryId?: string;
    supplierId?: string;
    reorderLevel?: number;
}
export declare class ProductImageType {
    id: string;
    cdnUrl: string;
    urlThumb: string;
    source: string;
    isApproved: boolean;
}
export declare class InventoryBatchType {
    batchNumber: string;
    quantity: number;
    expiryDate: string;
}
export declare class ProductInventoryType {
    quantityOnHand: number;
    reorderLevel: number;
    batches: InventoryBatchType[];
}
export declare class ProductSupplierType {
    id: string;
    name: string;
    aiScore?: number;
}
export declare class ProductCategoryType {
    id: string;
    name: string;
}
export declare class ProductType {
    id: string;
    name: string;
    genericName?: string;
    barcode?: string;
    unitPrice: number;
    classification: string;
    branchType: string;
    vatExempt: boolean;
    requiresRx: boolean;
    image?: ProductImageType;
    inventory?: ProductInventoryType;
    supplier?: ProductSupplierType;
    category?: ProductCategoryType;
}
