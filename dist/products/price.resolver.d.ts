import { PriceService } from './price.service';
import { UpdatePriceInput, BulkUpdatePriceInput, SetExchangeRateInput, PriceHistory, ExchangeRate, PriceUpdateResult, ProductCostSnapshot } from './dto/price.types';
import { JwtUser } from '../auth/decorators/current-user.decorator';
export declare class PriceResolver {
    private readonly priceService;
    constructor(priceService: PriceService);
    updateProductPrice(input: UpdatePriceInput, actor: JwtUser): Promise<PriceUpdateResult>;
    bulkUpdateProductPrices(input: BulkUpdatePriceInput, actor: JwtUser): Promise<PriceUpdateResult[]>;
    setUsdExchangeRate(input: SetExchangeRateInput, actor: JwtUser): Promise<ExchangeRate>;
    currentExchangeRate(): Promise<ExchangeRate | null>;
    productPriceHistory(productId: string, limit: number): Promise<PriceHistory[]>;
    latestProductCosts(productIds: string[], actor: JwtUser): Promise<ProductCostSnapshot[]>;
}
