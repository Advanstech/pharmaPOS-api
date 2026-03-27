import { DataSource } from 'typeorm';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { RealtimeStockService } from '../inventory/realtime-stock.service';
import { CreateSaleInput, SaleOutput, DailySummary } from './dto/sale.types';
import { SalesEffectiveAtService } from './sales-effective-at.service';
import { PharmacyService } from '../pharmacy/pharmacy.service';
export declare class SalesService {
    private readonly dataSource;
    private readonly realtimeStock;
    private readonly effectiveSaleAt;
    private readonly pharmacy;
    private readonly logger;
    constructor(dataSource: DataSource, realtimeStock: RealtimeStockService, effectiveSaleAt: SalesEffectiveAtService, pharmacy: PharmacyService);
    createSale(input: CreateSaleInput, actor: JwtUser): Promise<SaleOutput>;
    getSale(saleId: string, actor: JwtUser): Promise<SaleOutput>;
    getDailySummary(branchId: string, date?: string): Promise<DailySummary>;
    getRecentSales(actor: JwtUser, limit?: number): Promise<SaleOutput[]>;
    private parseOptionalSoldAt;
    private mapSaleOutput;
    private formatGhs;
    private calcStockStatus;
}
