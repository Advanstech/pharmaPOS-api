import { ObjectType, Field, InputType, Float, Int, registerEnumType } from '@nestjs/graphql';
import { IsInt, IsPositive, IsString, IsOptional } from 'class-validator';

export enum Currency {
  GHS = 'GHS',
  USD = 'USD',
}

registerEnumType(Currency, {
  name: 'Currency',
  description:
    'Supported display currencies. GHS is the canonical storage currency used for all transactions. ' +
    'USD is display-only for reference — never used in transactions.',
});

// ── Inputs ────────────────────────────────────────────────────────────────

@InputType({
  description:
    'Update the unit price of a single product. ' +
    'Price is stored in GHS pesewas (integer). Previous price is recorded in price_history for audit. ' +
    'Requires role: owner or manager.',
})
export class UpdatePriceInput {
  @Field({ description: 'UUID of the product to reprice' })
  @IsString()
  productId!: string;

  @Field(() => Int, {
    description:
      'New unit price in GHS pesewas (integer). ' +
      'Example: GH 25.00 = 2500. GH 1.50 = 150. All prices are GHS — never USD.',
  })
  @IsInt()
  @IsPositive()
  unitPriceGhsPesewas!: number;

  @Field({
    nullable: true,
    description:
      'Reason for the price change. Recorded in price_history audit trail. ' +
      'Examples: Supplier price increase, Promotional discount, Annual review.',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

@InputType({
  description:
    'Update prices for multiple products in a single atomic transaction. ' +
    'All updates succeed or all fail. Requires role: owner or manager.',
})
export class BulkUpdatePriceInput {
  @Field(() => [UpdatePriceInput], {
    description: 'Array of price updates. Maximum 100 products per bulk update.',
  })
  updates!: UpdatePriceInput[];
}

@InputType({
  description:
    'Set the USD/GHS exchange rate used for display-only USD price conversion. ' +
    'Cached in Redis. Used only for informational display — all transactions are always in GHS. ' +
    'Requires role: owner or se_admin.',
})
export class SetExchangeRateInput {
  @Field(() => Float, {
    description:
      'USD to GHS exchange rate. Example: 15.50 means GH 15.50 = $1.00. ' +
      'Bank of Ghana official rate recommended.',
  })
  @IsPositive()
  usdToGhsRate!: number;
}

// ── Output types ──────────────────────────────────────────────────────────

@ObjectType({
  description:
    'Price display object. GHS is canonical — always present. ' +
    'USD fields are optional display-only reference values.',
})
export class PriceDisplay {
  @Field(() => Int, {
    description:
      'Price in GHS pesewas (canonical storage format). ' +
      'Example: 2500 = GH 25.00. Use this for all calculations.',
  })
  ghsPesewas!: number;

  @Field({ description: 'Human-readable GHS price. Example: GH 25.00' })
  ghsFormatted!: string;

  @Field(() => Float, {
    nullable: true,
    description:
      'USD equivalent for display only. Calculated using the current exchange rate. ' +
      'Never use this for transactions — GHS only.',
  })
  usdEquivalent?: number;

  @Field({ nullable: true, description: 'Human-readable USD price. Example: $1.61' })
  usdFormatted?: string;

  @Field(() => Float, {
    nullable: true,
    description: 'Exchange rate used for the USD conversion. Example: 15.50',
  })
  exchangeRate?: number;
}

@ObjectType({ description: 'A single entry in the price change audit trail' })
export class PriceHistory {
  @Field({ description: 'UUID of this price history record' })
  id!: string;

  @Field({ description: 'UUID of the product' })
  productId!: string;

  @Field({ description: 'Product name at time of change' })
  productName!: string;

  @Field(() => Int, { description: 'Previous price in GHS pesewas' })
  oldPriceGhsPesewas!: number;

  @Field({ description: 'Previous price formatted. Example: GH 20.00' })
  oldPriceFormatted!: string;

  @Field(() => Int, { description: 'New price in GHS pesewas' })
  newPriceGhsPesewas!: number;

  @Field({ description: 'New price formatted. Example: GH 25.00' })
  newPriceFormatted!: string;

  @Field({ nullable: true, description: 'Reason for the price change' })
  reason?: string;

  @Field({ description: 'Name of the user who made the change' })
  changedByName!: string;

  @Field({ description: 'ISO 8601 timestamp of the price change' })
  changedAt!: Date;
}

@ObjectType({ description: 'Current USD/GHS exchange rate configuration' })
export class ExchangeRate {
  @Field(() => Float, {
    description: 'Current USD to GHS rate. Example: 15.50 means GH 15.50 = $1.00',
  })
  usdToGhsRate!: number;

  @Field({ description: 'ISO 8601 timestamp when the rate was last updated' })
  updatedAt!: Date;

  @Field({ description: 'Name of the user who last updated the rate' })
  updatedByName!: string;
}

@ObjectType({ description: 'Result of a successful price update' })
export class PriceUpdateResult {
  @Field({ description: 'UUID of the updated product' })
  productId!: string;

  @Field({ description: 'Product name' })
  productName!: string;

  @Field(() => PriceDisplay, { description: 'New price with GHS and optional USD display' })
  price!: PriceDisplay;

  @Field({ description: 'ISO 8601 timestamp of the update' })
  updatedAt!: Date;
}

@ObjectType({
  description:
    'Latest observed supplier unit cost per product for a branch. ' +
    'Sourced from GRN/invoice ingestion and used to prefill pricing controls.',
})
export class ProductCostSnapshot {
  @Field({ description: 'UUID of the product' })
  productId!: string;

  @Field(() => Int, { description: 'Latest supplier unit cost in GHS pesewas' })
  latestCostPesewas!: number;

  @Field({ description: 'Formatted cost display. Example: GH₵4.00' })
  latestCostFormatted!: string;

  @Field({ nullable: true, description: 'Supplier UUID associated with this cost observation' })
  supplierId?: string;

  @Field({ nullable: true, description: 'Supplier name associated with this cost observation' })
  supplierName?: string;

  @Field({ description: 'Cost source type. Example: GRN | INVOICE | MANUAL' })
  sourceType!: string;

  @Field({ description: 'Timestamp when this supplier cost was observed' })
  observedAt!: Date;
}
