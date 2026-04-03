import { DataSource, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { CreateProductInput } from './dto/product.types';
import { S3UploadService } from './s3-upload.service';
export interface ProductImage {
    id: string;
    productId: string;
    cdnUrl: string;
    urlThumb: string;
    source: string;
    isApproved: boolean;
    createdAt: Date;
}
export declare class ProductsService {
    private readonly productRepo;
    private readonly dataSource;
    private readonly s3Upload;
    private readonly logger;
    constructor(productRepo: Repository<Product>, dataSource: DataSource, s3Upload: S3UploadService);
    search(query: string, branchId: string, branchType: 'pharmaceutical' | 'chemical', limit?: number, retries?: number): Promise<Product[]>;
    findById(id: string): Promise<Product | null>;
    createProduct(input: CreateProductInput, actor: JwtUser): Promise<Product>;
    private assertProductCreator;
    uploadProductImage(productId: string, buffer: Buffer, filename: string, mimetype: string, actor: JwtUser): Promise<ProductImage>;
    getProductImages(productId: string): Promise<ProductImage[]>;
    deleteProductImage(imageId: string, actor: JwtUser): Promise<boolean>;
    setPrimaryImage(productId: string, imageId: string, actor: JwtUser): Promise<boolean>;
    private assertImageManager;
}
