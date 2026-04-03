import { Resolver, Query, Args, Int, ResolveField, Parent, Mutation } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductType, ProductInventoryType, ProductImageType, ProductSupplierType, ProductCategoryType, CreateProductInput } from './dto/product.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

type RawRow = Record<string, unknown>;

// Resolvers are thin wrappers — all business logic in ProductsService
@Resolver(() => ProductType)
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsResolver {
  constructor(private readonly productsService: ProductsService) {}

  @Mutation(() => ProductType)
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist')
  async createProduct(
    @Args('input') input: CreateProductInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<ProductType> {
    return this.productsService.createProduct(input, actor) as unknown as ProductType;
  }

  @Query(() => [ProductType], {
    description: 'Search products by name, generic name, or barcode. Returns up to 20 results ordered by relevance.',
  })
  async searchProducts(
    @Args('query', { description: 'Search term — min 2 characters' }) query: string,
    @Args('branchId', { type: () => String, description: 'Branch UUID for stock filtering' }) branchId: string,
    @Args('limit', { type: () => Int, defaultValue: 20, nullable: true }) limit: number,
    @CurrentUser() user: JwtUser,
  ): Promise<ProductType[]> {
    // Pass branchType from JWT so service can filter correctly without a DB lookup
    return this.productsService.search(query, branchId, user.branchType, limit) as unknown as ProductType[];
  }

  /**
   * Map raw DB snake_case inventory row → camelCase GraphQL type.
   * leftJoinAndMapOne returns raw columns — no TypeORM entity mapping.
   */
  @ResolveField(() => ProductInventoryType, { nullable: true })
  inventory(@Parent() product: ProductType & { inventory: RawRow | null }): ProductInventoryType | null {
    const inv = product.inventory;
    if (!inv) return null;
    return {
      quantityOnHand: (inv['quantity_on_hand'] as number) ?? 0,
      reorderLevel: (inv['reorder_level'] as number) ?? 10,
      batches: [], // Batches fetched separately via stock_movements when needed
    };
  }

  /** Map raw product_images row → camelCase GraphQL type. */
  @ResolveField(() => ProductImageType, { nullable: true })
  image(@Parent() product: ProductType & { image: RawRow | null }): ProductImageType | null {
    const img = product.image;
    if (!img) return null;
    return {
      id: img['id'] as string,
      cdnUrl: img['cdn_url'] as string,
      urlThumb: img['url_thumb'] as string,
      source: img['source'] as string,
      isApproved: img['is_approved'] as boolean,
    };
  }

  /** Map raw suppliers row → camelCase GraphQL type. */
  @ResolveField(() => ProductSupplierType, { nullable: true })
  supplier(@Parent() product: ProductType & { supplier: RawRow | null }): ProductSupplierType | null {
    const sup = product.supplier;
    if (!sup) return null;
    return {
      id: sup['id'] as string,
      name: sup['name'] as string,
      aiScore: (sup['ai_score'] as number | null) ?? undefined,
    };
  }

  /** Map raw product_categories row → camelCase GraphQL type. */
  @ResolveField(() => ProductCategoryType, { nullable: true })
  category(@Parent() product: ProductType & { category: RawRow | null }): ProductCategoryType | null {
    const cat = product.category;
    if (!cat) return null;
    return {
      id: cat['id'] as string,
      name: cat['name'] as string,
    };
  }

  // ── Product Image Management ───────────────────────────────────────────────

  @Query(() => [ProductImageType], {
    description: 'Get all images for a product',
  })
  async getProductImages(
    @Args('productId', { type: () => String }) productId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ProductImageType[]> {
    const images = await this.productsService.getProductImages(productId);
    return images.map((img) => ({
      id: img.id,
      cdnUrl: img.cdnUrl,
      urlThumb: img.urlThumb,
      source: img.source,
      isApproved: img.isApproved,
    })) as ProductImageType[];
  }

  @Mutation(() => ProductImageType)
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'technician')
  async uploadProductImage(
    @Args('productId', { type: () => String }) productId: string,
    @Args('fileBase64', { type: () => String }) fileBase64: string,
    @Args('filename', { type: () => String }) filename: string,
    @Args('mimetype', { type: () => String }) mimetype: string,
    @CurrentUser() actor: JwtUser,
  ): Promise<ProductImageType> {
    const buffer = Buffer.from(fileBase64, 'base64');
    const image = await this.productsService.uploadProductImage(productId, buffer, filename, mimetype, actor);
    return {
      id: image.id,
      cdnUrl: image.cdnUrl,
      urlThumb: image.urlThumb,
      source: image.source,
      isApproved: image.isApproved,
    } as ProductImageType;
  }

  @Mutation(() => Boolean)
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'technician')
  async deleteProductImage(
    @Args('imageId', { type: () => String }) imageId: string,
    @CurrentUser() actor: JwtUser,
  ): Promise<boolean> {
    return this.productsService.deleteProductImage(imageId, actor);
  }

  @Mutation(() => Boolean)
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'technician')
  async setPrimaryProductImage(
    @Args('productId', { type: () => String }) productId: string,
    @Args('imageId', { type: () => String }) imageId: string,
    @CurrentUser() actor: JwtUser,
  ): Promise<boolean> {
    return this.productsService.setPrimaryImage(productId, imageId, actor);
  }
}
