import { Field, ObjectType, InputType, ID, Int, registerEnumType } from '@nestjs/graphql';
import { IsString, IsUUID, IsArray, IsInt, Min, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// ── Enums ─────────────────────────────────────────────────────────────────────

export enum TransferStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  IN_TRANSIT = 'IN_TRANSIT',
  RECEIVED = 'RECEIVED',
  CANCELLED = 'CANCELLED',
}

registerEnumType(TransferStatus, { name: 'TransferStatus' });

// ── Inputs ────────────────────────────────────────────────────────────────────

@InputType()
export class TransferItemInput {
  @Field(() => ID)
  @IsUUID()
  productId!: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  quantity!: number;
}

@InputType()
export class CreateStockTransferInput {
  @Field(() => ID, { description: 'Destination branch ID' })
  @IsUUID()
  toBranchId!: string;

  @Field(() => [TransferItemInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferItemInput)
  items!: TransferItemInput[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ── Outputs ───────────────────────────────────────────────────────────────────

@ObjectType()
export class StockTransferItemOutput {
  @Field(() => ID) productId!: string;
  @Field() productName!: string;
  @Field(() => Int) quantity!: number;
  @Field(() => Int, { nullable: true }) receivedQuantity?: number;
}

@ObjectType()
export class StockTransferOutput {
  @Field(() => ID) id!: string;
  @Field(() => ID) fromBranchId!: string;
  @Field() fromBranchName!: string;
  @Field(() => ID) toBranchId!: string;
  @Field() toBranchName!: string;
  @Field(() => TransferStatus) status!: string;
  @Field(() => [StockTransferItemOutput]) items!: StockTransferItemOutput[];
  @Field({ nullable: true }) notes?: string;
  @Field() createdByName!: string;
  @Field({ nullable: true }) approvedByName?: string;
  @Field({ nullable: true }) receivedByName?: string;
  @Field() createdAt!: Date;
  @Field({ nullable: true }) approvedAt?: Date;
  @Field({ nullable: true }) receivedAt?: Date;
  @Field(() => Int) totalItems!: number;
  @Field(() => Int) totalQuantity!: number;
}
