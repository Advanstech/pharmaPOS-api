import { ReportsService } from './reports.service';
import { RevenueReport, TopProduct, DashboardKpis } from './dto/reports.types';
import { JwtUser } from '../auth/decorators/current-user.decorator';
export declare class ReportsResolver {
    private readonly reportsService;
    constructor(reportsService: ReportsService);
    revenueReport(actor: JwtUser, periodStart: string, periodEnd: string): Promise<RevenueReport>;
    topProducts(actor: JwtUser, periodStart: string, periodEnd: string, limit?: number): Promise<TopProduct[]>;
    dashboardKpis(actor: JwtUser): Promise<DashboardKpis>;
}
