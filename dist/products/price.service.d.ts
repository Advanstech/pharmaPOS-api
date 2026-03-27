import { Repository, DataSource } from 'typeorm';
import { Cache } from 'cache-manager';
import { Product } from './entities/product.entity';
import { UpdatePriceInput, BulkUpdatePriceInput, SetExchangeRateInput, PriceDisplay, PriceHistory, ExchangeRate, PriceUpdateResult, ProductCostSnapshot } from './dto/price.types';
import { JwtUser } from '../auth/decorators/current-user.decorator';
export declare class PriceService {
    private readonly products;
    private readonly dataSource;
    private readonly cache;
    private readonly logger;
    constructor(products: Repository<Product>, dataSource: DataSource, cache: Cache);
    formatGhs(pesewas: number): string;
    formatUsd(usd: number): string;
    buildPriceDisplay(pesewas: number): Promise<PriceDisplay>;
    updatePrice(input: UpdatePriceInput, actor: JwtUser): Promise<PriceUpdateResult>;
    bulkUpdatePrices(input: BulkUpdatePriceInput, actor: JwtUser): Promise<PriceUpdateResult[]>;
    setExchangeRate(input: SetExchangeRateInput, actor: JwtUser): Promise<ExchangeRate>;
    getExchangeRate(): Promise<ExchangeRate | null>;
    getPriceHistory(productId: string, limit?: number): Promise<PriceHistory[]>;
    getLatestProductCosts(productIds: string[], branchId: string): Promise<ProductCostSnapshot[]>;
    private assertPriceManager;
    private getUserName;
}
