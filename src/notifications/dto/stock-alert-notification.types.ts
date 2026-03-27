import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'In-app stock alert notification for the current user.' })
export class StockAlertNotification {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  productId!: string;

  @Field()
  productName!: string;

  @Field()
  stockStatus!: string;

  @Field(() => Int)
  quantityOnHand!: number;

  @Field(() => Int)
  reorderLevel!: number;

  @Field(() => Int)
  suggestedReorderQty!: number;

  @Field({ nullable: true })
  supplierId?: string;

  @Field({ nullable: true })
  supplierName?: string;

  @Field({ nullable: true })
  supplierPhone?: string;

  @Field(() => [String])
  channels!: string[];

  @Field()
  message!: string;

  @Field()
  createdAt!: Date;
}
