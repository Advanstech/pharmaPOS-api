import { DataSource } from 'typeorm';
import { RevenueReport, TopProduct, DashboardKpis } from './dto/reports.types';
import { SalesEffectiveAtService } from '../sales/sales-effective-at.service';
export declare class ReportsService {
    private readonly dataSource;
    private readonly effectiveSaleAt;
    private readonly logger;
    constructor(dataSource: DataSource, effectiveSaleAt: SalesEffectiveAtService);
    getRevenueReport(branchId: string, periodStart: string, periodEnd: string): Promise<RevenueReport>;
    getTopProducts(branchId: string, periodStart: string, periodEnd: string, limit?: number): Promise<TopProduct[]>;
    getDashboardKpis(branchId: string): Promise<DashboardKpis>;
    private fmt;
}
