import { SalesService } from './sales.service';
import { CreateSaleInput, SaleOutput, DailySummary } from './dto/sale.types';
import { JwtUser } from '../auth/decorators/current-user.decorator';
export declare class SalesResolver {
    private readonly salesService;
    constructor(salesService: SalesService);
    createSale(input: CreateSaleInput, actor: JwtUser): Promise<SaleOutput>;
    sale(id: string, actor: JwtUser): Promise<SaleOutput>;
    recentSales(actor: JwtUser, limit?: number): Promise<SaleOutput[]>;
    dailySummary(actor: JwtUser, date?: string): Promise<DailySummary>;
}
