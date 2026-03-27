export declare enum PaymentMethod {
    CASH = "CASH",
    MTN_MOMO = "MTN_MOMO",
    VODAFONE_CASH = "VODAFONE_CASH",
    AIRTELTIGO_MONEY = "AIRTELTIGO_MONEY",
    CARD = "CARD",
    SPLIT = "SPLIT"
}
export declare class SaleItemInput {
    productId: string;
    quantity: number;
    prescriptionId?: string;
}
export declare class TenderInput {
    method: PaymentMethod;
    amountPesewas: number;
    momoReference?: string;
}
export declare class CreateSaleInput {
    items: SaleItemInput[];
    tenders: TenderInput[];
    customerId?: string;
    idempotencyKey: string;
    soldAt?: string;
}
export declare class SaleItemOutput {
    id: string;
    productId: string;
    productName: string;
    classification: string;
    quantity: number;
    unitPricePesewas: number;
    vatExempt: boolean;
    supplierId?: string;
    supplierName?: string;
    stockAfterSale: number;
    reorderLevel: number;
    stockStatus: string;
}
export declare class SaleOutput {
    id: string;
    branchId: string;
    cashierId: string;
    branchName: string;
    cashierName: string;
    items: SaleItemOutput[];
    totalPesewas: number;
    vatPesewas: number;
    totalFormatted: string;
    status: string;
    idempotencyKey: string;
    soldAt?: Date | null;
    createdAt: Date;
}
export declare class DailySummary {
    salesCount: number;
    totalRevenuePesewas: number;
    totalRevenueFormatted: string;
    vatCollectedPesewas: number;
    averageSaleGhs: number;
}
