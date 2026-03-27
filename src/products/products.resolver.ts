import { Resolver, Query, Args, Int, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductType, ProductInventoryType, ProductImageType, ProductSupplierType, ProductCategoryType } from './dto/product.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

type RawRow = Record<string, unknown>;

// Resolvers are thin wrappers — all business logic in ProductsService
@Resolver(() => ProductType)
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsResolver {
  constructor(private readonly productsService: ProductsService) {}

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
}
