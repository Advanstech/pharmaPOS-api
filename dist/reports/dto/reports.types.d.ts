export declare class RevenueReport {
    periodStart: string;
    periodEnd: string;
    totalRevenuePesewas: number;
    totalRevenueFormatted: string;
    vatCollectedPesewas: number;
    vatFormatted: string;
    salesCount: number;
    averageSaleGhs: number;
    refundsPesewas: number;
}
export declare class TopProduct {
    productId: string;
    productName: string;
    unitsSold: number;
    revenuePesewas: number;
    revenueFormatted: string;
}
export declare class DashboardKpis {
    todayRevenuePesewas: number;
    todayRevenueFormatted: string;
    todaySalesCount: number;
    monthRevenuePesewas: number;
    monthRevenueFormatted: string;
    monthSalesCount: number;
    lowStockCount: number;
    activeStaffCount: number;
    revenueDeltaPct: number;
}
