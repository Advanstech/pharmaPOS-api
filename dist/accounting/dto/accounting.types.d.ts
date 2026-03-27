export declare enum ExpenseCategory {
    UTILITIES = "UTILITIES",
    RENT = "RENT",
    SALARIES = "SALARIES",
    FUEL = "FUEL",
    MAINTENANCE = "MAINTENANCE",
    MARKETING = "MARKETING",
    LICENSES = "LICENSES",
    BANK_CHARGES = "BANK_CHARGES",
    MISCELLANEOUS = "MISCELLANEOUS"
}
export declare enum PaymentStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    PAID = "PAID",
    REJECTED = "REJECTED"
}
export declare class CreateExpenseInput {
    category: ExpenseCategory;
    amountPesewas: number;
    description: string;
    receiptS3Key?: string;
    expenseDate?: string;
}
export declare class ApproveExpenseInput {
    expenseId: string;
    status: PaymentStatus;
    notes?: string;
}
export declare class RecordSupplierPaymentInput {
    invoiceId: string;
    amountPesewas: number;
    paymentMethod: string;
    reference?: string;
}
export declare class MatchSupplierInvoiceInput {
    invoiceId: string;
    grnId: string;
    notes?: string;
}
export declare class SupplierInvoiceOcrLineInput {
    rawText?: string;
    barcode?: string;
    productName?: string;
    productId?: string;
    quantity?: number;
    unitCostPesewas?: number;
    lineTotalPesewas?: number;
}
export declare class IngestSupplierInvoiceOcrInput {
    invoiceId: string;
    lines: SupplierInvoiceOcrLineInput[];
    parser?: string;
}
export declare class OcrColumnMappingPairInput {
    sourceHeader: string;
    targetField: string;
}
export declare class UpsertOcrColumnMappingPresetInput {
    presetId?: string;
    supplierId?: string;
    name: string;
    mappings: OcrColumnMappingPairInput[];
}
export declare class ExpenseOutput {
    id: string;
    branchId: string;
    category: ExpenseCategory;
    amountPesewas: number;
    amountFormatted: string;
    description: string;
    receiptS3Key?: string;
    expenseDate: Date;
    status: PaymentStatus;
    createdBy: string;
    createdByName: string;
    approvedBy?: string;
    approvedByName?: string;
    approvalNotes?: string;
    createdAt: Date;
}
export declare class SupplierCreditSummary {
    supplierId: string;
    supplierName: string;
    outstandingBalancePesewas: number;
    outstandingBalanceFormatted: string;
    overduePesewas: number;
    overdueFormatted: string;
    unpaidInvoiceCount: number;
    overdueInvoiceCount: number;
    nextPaymentDue?: Date;
    creditLimitPesewas: number;
    creditUtilizationPct: number;
}
export declare class SupplierInvoiceOutput {
    id: string;
    supplierId: string;
    supplierName: string;
    branchId: string;
    grnId?: string;
    invoiceNumber: string;
    invoiceDate: Date;
    dueDate?: Date;
    totalAmountPesewas: number;
    totalAmountFormatted: string;
    paidAmountPesewas: number;
    paidAmountFormatted: string;
    balancePesewas: number;
    balanceFormatted: string;
    status: string;
    s3PdfKey?: string;
    createdAt: Date;
}
export declare class CashFlowForecast {
    currentCashPesewas: number;
    currentCashFormatted: string;
    payablesDue7DaysPesewas: number;
    payablesDue7DaysFormatted: string;
    payablesDue30DaysPesewas: number;
    payablesDue30DaysFormatted: string;
    projectedRevenue7DaysPesewas: number;
    projectedRevenue7DaysFormatted: string;
    projectedRevenue30DaysPesewas: number;
    projectedRevenue30DaysFormatted: string;
    cashRunwayDays: number;
    recommendation: string;
    recommendationReason: string;
}
export declare class ProfitLossStatement {
    periodStart: string;
    periodEnd: string;
    revenuePesewas: number;
    revenueFormatted: string;
    cogsPesewas: number;
    cogsFormatted: string;
    grossProfitPesewas: number;
    grossProfitFormatted: string;
    grossProfitMarginPct: number;
    operatingExpensesPesewas: number;
    operatingExpensesFormatted: string;
    netProfitPesewas: number;
    netProfitFormatted: string;
    netProfitMarginPct: number;
}
export declare class InvoiceOcrIngestionResult {
    invoiceId: string;
    totalLines: number;
    matchedLines: number;
    unmatchedLines: number;
    costSnapshotsCreated: number;
    unmatchedHints: string[];
}
export declare class OcrColumnMappingPair {
    sourceHeader: string;
    targetField: string;
}
export declare class OcrColumnMappingPresetOutput {
    id: string;
    branchId: string;
    supplierId?: string;
    supplierName?: string;
    name: string;
    mappings: OcrColumnMappingPair[];
    updatedAt: Date;
}
