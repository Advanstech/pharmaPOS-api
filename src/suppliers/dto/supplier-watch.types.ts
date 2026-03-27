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
