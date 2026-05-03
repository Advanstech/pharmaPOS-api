import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'A low/critical/out stock product linked to a supplier for restock action.' })
export class SupplierProductStockSignal {
  @Field(() => ID)
  productId!: string;

  @Field()
  productName!: string;

  @Field(() => Int)
  quantityOnHand!: number;

  @Field(() => Int)
  reorderLevel!: number;

  @Field({ description: 'Stock status: `ok` | `low` | `critical` | `out`.' })
  stockStatus!: string;

  @Field(() => Int, {
    description: 'Units sold in this branch over the last 7 days. Used for reorder intelligence.',
  })
  recentSoldQuantity7d!: number;

  @Field(() => Int, {
    description: 'Suggested reorder quantity based on stock status, reorder level, and last 7-day sales.',
  })
  suggestedReorderQuantity!: number;
}

@ObjectType({
  description:
    'Supplier restock watch for a branch. Helps managers and pharmacists call suppliers quickly ' +
    'when assigned products fall to low/critical/out stock levels.',
})
export class SupplierRestockWatch {
  @Field(() => ID)
  supplierId!: string;

  @Field()
  supplierName!: string;

  @Field({ nullable: true })
  supplierContactName?: string;

  @Field({ nullable: true })
  supplierAddress?: string;

  @Field({ nullable: true })
  supplierPhone?: string;

  @Field({ nullable: true })
  supplierEmail?: string;

  @Field(() => Int, { nullable: true })
  supplierAiScore?: number;

  @Field(() => Int)
  totalTrackedProducts!: number;

  @Field(() => Int)
  lowStockCount!: number;

  @Field(() => Int)
  criticalStockCount!: number;

  @Field(() => Int)
  outOfStockCount!: number;

  @Field(() => [SupplierProductStockSignal])
  affectedProducts!: SupplierProductStockSignal[];
}

@ObjectType({ description: 'Product detail within a supplier context' })
export class SupplierProductDetail {
  @Field(() => ID) id!: string;
  @Field() name!: string;
  @Field({ nullable: true }) genericName?: string;
  @Field({ nullable: true }) barcode?: string;
  @Field(() => Int) unitPrice!: number;
  @Field() classification!: string;
  @Field() branchType!: string;
  @Field() isActive!: boolean;
  @Field(() => Int) quantityOnHand!: number;
  @Field(() => Int) reorderLevel!: number;
  @Field() stockStatus!: string;
  @Field(() => Int) sold7d!: number;
  @Field(() => Int) sold30d!: number;
}

@ObjectType({ description: 'Supplier with full product catalog' })
export class SupplierWithProducts {
  @Field(() => ID) id!: string;
  @Field() name!: string;
  @Field({ nullable: true }) contactName?: string;
  @Field({ nullable: true }) phone?: string;
  @Field({ nullable: true }) email?: string;
  @Field({ nullable: true }) address?: string;
  @Field(() => Int, { nullable: true }) aiScore?: number;
  @Field() isActive!: boolean;
  @Field(() => Int) totalProducts!: number;
  @Field(() => [SupplierProductDetail]) products!: SupplierProductDetail[];
}
