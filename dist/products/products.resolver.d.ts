import { ProductsService } from './products.service';
import { ProductType, ProductInventoryType, ProductImageType, ProductSupplierType, ProductCategoryType, CreateProductInput } from './dto/product.types';
import { JwtUser } from '../auth/decorators/current-user.decorator';
type RawRow = Record<string, unknown>;
export declare class ProductsResolver {
    private readonly productsService;
    constructor(productsService: ProductsService);
    createProduct(input: CreateProductInput, actor: JwtUser): Promise<ProductType>;
    searchProducts(query: string, branchId: string, limit: number, user: JwtUser): Promise<ProductType[]>;
    inventory(product: ProductType & {
        inventory: RawRow | null;
    }): ProductInventoryType | null;
    image(product: ProductType & {
        image: RawRow | null;
    }): ProductImageType | null;
    supplier(product: ProductType & {
        supplier: RawRow | null;
    }): ProductSupplierType | null;
    category(product: ProductType & {
        category: RawRow | null;
    }): ProductCategoryType | null;
    getProductImages(productId: string, user: JwtUser): Promise<ProductImageType[]>;
    uploadProductImage(productId: string, fileBase64: string, filename: string, mimetype: string, actor: JwtUser): Promise<ProductImageType>;
    deleteProductImage(imageId: string, actor: JwtUser): Promise<boolean>;
    setPrimaryProductImage(productId: string, imageId: string, actor: JwtUser): Promise<boolean>;
}
export {};
