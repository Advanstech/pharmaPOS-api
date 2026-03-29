import { DataSource, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { CreateProductInput } from './dto/product.types';
export declare class ProductsService {
    private readonly productRepo;
    private readonly dataSource;
    private readonly logger;
    constructor(productRepo: Repository<Product>, dataSource: DataSource);
    search(query: string, branchId: string, branchType: 'pharmaceutical' | 'chemical', limit?: number, retries?: number): Promise<Product[]>;
    findById(id: string): Promise<Product | null>;
    createProduct(input: CreateProductInput, actor: JwtUser): Promise<Product>;
    private assertProductCreator;
}
