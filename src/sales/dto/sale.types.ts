import { InputType, ObjectType, Field, ID, Int, Float, GraphQLISODateTime } from '@nestjs/graphql';
import { IsUUID, IsArray, IsEnum, IsOptional, Min, ValidateNested, IsString, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';

// ── Enums ─────────────────────────────────────────────────────────────────

export enum PaymentMethod {
  CASH = 'CASH',
  MTN_MOMO = 'MTN_MOMO',
  VODAFONE_CASH = 'VODAFONE_CASH',
  AIRTELTIGO_MONEY = 'AIRTELTIGO_MONEY',
  CARD = 'CARD',
  SPLIT = 'SPLIT',
}

// ── Inputs ────────────────────────────────────────────────────────────────

@InputType({ description: 'A single line item in a sale' })
export class SaleItemInput {
  @Field(() => ID, { description: 'UUID of the product being sold' })
  @IsUUID()
  productId!: string;

  @Field(() => Int, { description: 'Number of units to sell. Must be ≥ 1.' })
  @Min(1)
  quantity!: number;

  @Field({
    nullable: true,
    description:
      'UUID of the approved prescription. **Required** when the product has `requiresRx = true`. ' +
      'Ghana FDA: omitting this for a POM product throws `FDA_POM_VIOLATION`.',
  })
  @IsOptional()
  @IsUUID()
  prescriptionId?: string;
}

@InputType({ description: 'A payment tender — one sale can have multiple tenders (split payment)' })
export class TenderInput {
  @Field(() => String, {
    description:
      'Payment method. Ghana-native options: `MTN_MOMO`, `VODAFONE_CASH`, `AIRTELTIGO_MONEY`. ' +
      'Also supports `CASH`, `CARD`, `SPLIT`.',
  })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @Field(() => Int, {
    description:
      'Amount tendered in **GHS pesewas** (integer). Example: GH₵50.00 = `5000`. ' +
      'All monetary values are GHS — never USD.',
  })
  @Min(1)
  amountPesewas!: number;

  @Field({
    nullable: true,
    description:
      'MoMo transaction reference from Hubtel/MTN. Required when method is `MTN_MOMO` or `VODAFONE_CASH`.',
  })
  @IsOptional()
  @IsString()
  momoReference?: string;
}

@InputType({
  description:
    'Create a completed sale at the POS terminal. ' +
    'Ghana FDA: POM items are validated by `PomEnforcementGuard` before this mutation runs. ' +
    'Idempotency key prevents duplicate records during offline sync.',
})
export class CreateSaleInput {
  @Field(() => [SaleItemInput], { description: 'One or more products being sold. Must not be empty.' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemInput)
  items!: SaleItemInput[];

  @Field(() => [TenderInput], {
    description:
      'Payment tenders. Total tendered amount must be ≥ total sale amount. ' +
      'Multiple tenders allowed for split payments.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TenderInput)
  tenders!: TenderInput[];

  @Field({
    nullable: true,
    description: 'UUID of the customer. Optional for walk-in sales.',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @Field(() => ID, {
    description:
      'Client-generated UUID v4 idempotency key. ' +
      'If a sale with this key already exists, the existing sale is returned without creating a duplicate. ' +
      'Generate once per checkout attempt — reuse on retry after network failure.',
  })
  @IsUUID()
  idempotencyKey!: string;

  @Field(() => String, {
    nullable: true,
    description:
      'When the customer completed checkout (ISO 8601). **Offline POS** should send the local checkout time so ' +
      'reports and VAT periods attribute revenue to the correct business day after sync. Omit for online checkout — server `createdAt` is used.',
  })
  @IsOptional()
  @IsISO8601()
  soldAt?: string;
}

// ── Output types ──────────────────────────────────────────────────────────

@ObjectType({ description: 'A single line item within a completed sale' })
export class SaleItemOutput {
  @Field(() => ID, { description: 'UUID of this sale item record' })
  id!: string;

  @Field(() => ID, { description: 'UUID of the product sold' })
  productId!: string;

  @Field({ description: 'Product name at time of sale (snapshot)' })
  productName!: string;

  @Field({
    description: 'Ghana FDA classification at read time (`OTC` | `POM` | `CONTROLLED`) — joined from product record.',
  })
  classification!: string;

  @Field(() => Int, { description: 'Quantity sold' })
  quantity!: number;

  @Field(() => Int, {
    description: 'Unit price in GHS pesewas at time of sale (snapshot). Example: `2500` = GH₵25.00',
  })
  unitPricePesewas!: number;

  @Field({
    description:
      'Ghana GRA: `true` if this item is VAT-exempt (prescription medicines). ' +
      '`false` if 15% VAT applies.',
  })
  vatExempt!: boolean;

  @Field({
    nullable: true,
    description: 'UUID of the supplier — enables full supply chain traceability per Ghana FDA requirements',
  })
  supplierId?: string;

  @Field({
    nullable: true,
    description: 'Supplier trading name at time of reporting (joined for receipts and audit views)',
  })
  supplierName?: string;

  @Field(() => Int, {
    description:
      'Inventory units remaining immediately after this sale line is committed. ' +
      'Used by POS UI for real-time stock sync.',
  })
  stockAfterSale!: number;

  @Field(() => Int, {
    description: 'Reorder threshold configured for this product at the selling branch.',
  })
  reorderLevel!: number;

  @Field({
    description: 'Post-sale stock health status: `ok` | `low` | `critical` | `out`.',
  })
  stockStatus!: string;
}

@ObjectType({ description: 'A payment tender line on a completed sale' })
export class TenderOutput {
  @Field(() => String, { description: 'Payment method: CASH | MTN_MOMO | VODAFONE_CASH | AIRTELTIGO_MONEY | CARD | SPLIT' })
  method!: string;

  @Field(() => Int, { description: 'Amount tendered in GHS pesewas' })
  amountPesewas!: number;

  @Field({ description: 'Human-readable amount. Example: GH₵21.85' })
  amountFormatted!: string;

  @Field({ nullable: true, description: 'MoMo transaction reference (if applicable)' })
  momoReference?: string;
}

@ObjectType({ description: 'Compact refund request info embedded in a SaleOutput' })
export class RefundSummary {
  @Field(() => ID) id!: string;
  @Field(() => String) status!: string;
  @Field(() => String) reason!: string;
  @Field(() => String, { nullable: true }) reviewedByName?: string | null;
  @Field(() => String, { nullable: true }) reviewNotes?: string | null;
  @Field(() => GraphQLISODateTime) createdAt!: Date;
  @Field(() => GraphQLISODateTime, { nullable: true }) reviewedAt?: Date | null;
}

@ObjectType({ description: 'A completed sale record' })
export class SaleOutput {
  @Field(() => ID, { description: 'UUID of the sale' })
  id!: string;

  @Field(() => ID, { description: 'UUID of the branch where the sale occurred' })
  branchId!: string;

  @Field(() => ID, { description: 'UUID of the cashier who processed the sale' })
  cashierId!: string;

  @Field({ description: 'Branch display name where the sale was recorded' })
  branchName!: string;

  @Field({ description: 'Cashier display name from staff record' })
  cashierName!: string;

  @Field(() => [SaleItemOutput], { description: 'Line items in this sale' })
  items!: SaleItemOutput[];

  @Field(() => [TenderOutput], { description: 'Payment tenders used for this sale' })
  tenders!: TenderOutput[];

  @Field(() => Int, {
    description: 'Total sale amount in GHS pesewas (subtotal + VAT). Example: `11500` = GH₵115.00',
  })
  totalPesewas!: number;

  @Field(() => Int, {
    description:
      'VAT collected in GHS pesewas. Ghana GRA: 15% on non-exempt items (12.5% VAT + 2.5% NHIL).',
  })
  vatPesewas!: number;

  @Field({ description: 'Human-readable total. Always GH₵ — never USD. Example: `GH₵115.00`' })
  totalFormatted!: string;

  @Field({ description: 'Sale status. Values: `COMPLETED` | `REFUNDED` | `VOID`' })
  status!: string;

  @Field(() => ID, { description: 'Idempotency key used to create this sale' })
  idempotencyKey!: string;

  @Field(() => GraphQLISODateTime, {
    nullable: true,
    description:
      'Checkout wall time when provided (e.g. offline queue). Null when only server record time applies.',
  })
  soldAt?: Date | null;

  @Field(() => GraphQLISODateTime, {
    description:
      'When the sale row was persisted on the server. For reporting, the API uses `soldAt` when set, else this.',
  })
  createdAt!: Date;

  @Field(() => RefundSummary, {
    nullable: true,
    description: 'Inline refund request summary if one exists for this sale',
  })
  refundRequest?: RefundSummary | null;
}

@ObjectType({ description: 'Aggregated sales summary for a single day' })
export class DailySummary {
  @Field(() => Int, { description: 'Number of completed sales' })
  salesCount!: number;

  @Field(() => Int, { description: 'Total revenue in GHS pesewas' })
  totalRevenuePesewas!: number;

  @Field({ description: 'Formatted total revenue. Example: `GH₵4,250.00`' })
  totalRevenueFormatted!: string;

  @Field(() => Int, { description: 'Total VAT collected in GHS pesewas (Ghana GRA reporting)' })
  vatCollectedPesewas!: number;

  @Field(() => Float, { description: 'Average sale value in GHS (not pesewas). Example: `42.50`' })
  averageSaleGhs!: number;
}


// ── Refund Request Types ──────────────────────────────────────────────────────

@ObjectType({ description: 'A single line item within a refund request (mirrors the original sale item)' })
export class RefundItemOutput {
  @Field(() => ID) productId!: string;
  @Field() productName!: string;
  @Field(() => Int) quantity!: number;
  @Field(() => Int) unitPricePesewas!: number;
  @Field() vatExempt!: boolean;
}

@ObjectType({ description: 'A refund request from a cashier/pharmacist awaiting manager approval' })
export class RefundRequestOutput {
  @Field(() => ID) id!: string;
  @Field(() => ID) saleId!: string;
  @Field() saleTotalFormatted!: string;
  @Field() reason!: string;
  @Field() status!: string;
  @Field() requestedByName!: string;
  @Field({ nullable: true }) reviewedByName?: string;
  @Field({ nullable: true }) reviewNotes?: string;
  @Field({ nullable: true }) reviewedAt?: Date;
  @Field() createdAt!: Date;
  @Field(() => Int) saleItemCount!: number;

  // ── Detail-view fields (populated by getRefundRequest) ──
  @Field({ nullable: true }) cashierName?: string;
  @Field({ nullable: true }) branchName?: string;
  @Field(() => Int, { nullable: true }) vatPesewas?: number;
  @Field(() => Int, { nullable: true }) subtotalPesewas?: number;
  @Field(() => [RefundItemOutput], { nullable: true }) items?: RefundItemOutput[];
}
