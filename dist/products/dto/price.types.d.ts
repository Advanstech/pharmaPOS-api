export declare enum Currency {
    GHS = "GHS",
    USD = "USD"
}
export declare class UpdatePriceInput {
    productId: string;
    unitPriceGhsPesewas: number;
    reason?: string;
}
export declare class BulkUpdatePriceInput {
    updates: UpdatePriceInput[];
}
export declare class SetExchangeRateInput {
    usdToGhsRate: number;
}
export declare class PriceDisplay {
    ghsPesewas: number;
    ghsFormatted: string;
    usdEquivalent?: number;
    usdFormatted?: string;
    exchangeRate?: number;
}
export declare class PriceHistory {
    id: string;
    productId: string;
    productName: string;
    oldPriceGhsPesewas: number;
    oldPriceFormatted: string;
    newPriceGhsPesewas: number;
    newPriceFormatted: string;
    reason?: string;
    changedByName: string;
    changedAt: Date;
}
export declare class ExchangeRate {
    usdToGhsRate: number;
    updatedAt: Date;
    updatedByName: string;
}
export declare class PriceUpdateResult {
    productId: string;
    productName: string;
    price: PriceDisplay;
    updatedAt: Date;
}
export declare class ProductCostSnapshot {
    productId: string;
    latestCostPesewas: number;
    latestCostFormatted: string;
    supplierId?: string;
    supplierName?: string;
    sourceType: string;
    observedAt: Date;
}
