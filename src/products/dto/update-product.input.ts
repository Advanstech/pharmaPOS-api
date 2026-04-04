import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

@InputType({
  description:
    'Update an existing product. Only provided fields are changed. ' +
    'Price changes are tracked in product_cost_history + audit_log.',
})
export class UpdateProductInput {
  @Field({ nullable: true, description: 'Brand/trade name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @Field({ nullable: true, description: 'Generic/INN name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  genericName?: string;

  @Field({ nullable: true, description: 'Barcode (EAN-13 or custom)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  barcode?: string;

  @Field(() => Int, { nullable: true, description: 'Unit price in GHS pesewas' })
  @IsOptional()
  @IsInt()
  @Min(0)
  unitPrice?: number;

  @Field({ nullable: true, description: 'Classification: OTC | POM | CONTROLLED' })
  @IsOptional()
  @IsIn(['OTC', 'POM', 'CONTROLLED'])
  classification?: string;

  @Field({ nullable: true, description: 'Branch type: pharmaceutical | chemical | both' })
  @IsOptional()
  @IsIn(['pharmaceutical', 'chemical', 'both'])
  branchType?: string;

  @Field({ nullable: true, description: 'VAT exempt flag' })
  @IsOptional()
  @IsBoolean()
  vatExempt?: boolean;

  @Field({ nullable: true, description: 'Requires prescription flag' })
  @IsOptional()
  @IsBoolean()
  requiresRx?: boolean;

  @Field(() => ID, { nullable: true, description: 'Linked supplier UUID' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @Field(() => ID, { nullable: true, description: 'Linked category UUID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @Field(() => Int, { nullable: true, description: 'Reorder level for this branch' })
  @IsOptional()
  @IsInt()
  @Min(1)
  reorderLevel?: number;

  @Field({ nullable: true, description: 'Reason for the change (required for price changes)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
