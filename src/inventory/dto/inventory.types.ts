import { InputType, ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { IsUUID, IsInt, IsOptional, IsString, Min, IsDateString, IsArray, IsPositive } from 'class-validator';

// ── Inputs ────────────────────────────────────────────────────────────────

@InputType({
  description:
    'Manually adjust stock for a product at the current branch. ' +
    'Use positive delta to add stock (e.g. found items, returns) and negative to remove (e.g. damage, expiry write-off). ' +
    'Every adjustment is recorded in `stock_movements` for audit purposes.',
})
export class AdjustStockInput {
  @Field(() => ID, { description: 'UUID of the product to adjust' })
  @IsUUID()
  productId!: string;

  @Field(() => Int, {
    description:
      'Stock change amount. Positive = add, negative = remove. ' +
      'Example: `10` adds 10 units; `-3` removes 3 units.',
  })
  @IsInt()
  quantityDelta!: number;

  @Field({
    description:
      'Reason for the adjustment. Shown in audit trail. ' +
      'Examples: `"Damaged goods"`, `"Stock count correction"`, `"Customer return"`.',
  })
  @IsString()
  reason!: string;

  @Field({
    nullable: true,
    description: 'Batch number from the supplier GRN. Used for FEFO (First Expiry First Out) tracking.',
  })
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @Field({
    nullable: true,
    description: 'Expiry date of this batch in ISO 8601 format. Example: `"2027-06-30"`.',
  })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}

@InputType({
  description:
    'Record stock received from a supplier (Goods Received Note). ' +
    'Increments `quantity_on_hand` and creates a `RECEIVE` stock movement record. ' +
    'Optionally links to a purchase order for reconciliation.',
})
export class ReceiveStockInput {
  @Field(() => ID, { description: 'UUID of the product being received' })
  @IsUUID()
  productId!: string;

  @Field(() => Int, { description: 'Quantity received. Must be ≥ 1.' })
  @Min(1)
  quantity!: number;

  @Field({
    nullable: true,
    description: 'Batch/lot number from the supplier invoice or GRN document.',
  })
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @Field({
    nullable: true,
    description:
      'Expiry date of this batch in ISO 8601 format. ' +
      'Required for medicines — used for FEFO dispensing order.',
  })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @Field({
    nullable: true,
    description: 'UUID of the purchase order this receipt is fulfilling. Optional.',
  })
  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;
}

// ── Output types ──────────────────────────────────────────────────────────

@ObjectType({ description: 'Current inventory position for a product at a branch' })
export class InventoryItem {
  @Field(() => ID, { description: 'UUID of the product' })
  productId!: string;

  @Field({ description: 'Product name' })
  productName!: string;

  @Field({
    description: 'Ghana FDA classification. Values: `OTC` | `POM` | `CONTROLLED`',
  })
  classification!: string;

  @Field(() => Int, { description: 'Current units on hand at this branch' })
  quantityOnHand!: number;

  @Field(() => Int, {
    description:
      'Reorder threshold. When `quantityOnHand` falls to or below this level, ' +
      'a low-stock alert is triggered and the product appears in the reorder list.',
  })
  reorderLevel!: number;

  @Field({
    description:
      'Stock health status. Values: `ok` (above reorder) | `low` (at reorder) | ' +
      '`critical` (≤20% of reorder level) | `out` (zero stock).',
  })
  stockStatus!: string;

  @Field({
    nullable: true,
    description:
      'Expiry date of the nearest-expiring batch (FEFO). ' +
      'Null if no expiry date is recorded for this product.',
  })
  nearestExpiry?: Date;

  @Field({
    nullable: true,
    description: 'UUID of the primary supplier — enables supply chain traceability',
  })
  supplierId?: string;

  @Field({ nullable: true, description: 'Supplier trading name' })
  supplierName?: string;
}

@ObjectType({ description: 'A single stock movement event (sale, receive, adjustment, return)' })
export class StockMovementOutput {
  @Field(() => ID, { description: 'UUID of this movement record' })
  id!: string;

  @Field(() => ID, { description: 'UUID of the product' })
  productId!: string;

  @Field({ description: 'Product name at time of movement' })
  productName!: string;

  @Field(() => Int, {
    description:
      'Quantity changed. Negative for outbound movements (sales, write-offs). ' +
      'Positive for inbound (receive, return, adjustment).',
  })
  quantity!: number;

  @Field({
    description:
      'Movement type. Values: `SALE` | `RECEIVE` | `ADJUSTMENT` | `RETURN` | `WRITE_OFF` | `TRANSFER`',
  })
  movementType!: string;

  @Field({ nullable: true, description: 'Batch number associated with this movement' })
  batchNumber?: string;

  @Field({ nullable: true, description: 'Expiry date of the batch involved' })
  expiryDate?: Date;

  @Field({ description: 'ISO 8601 timestamp of the movement (Africa/Accra timezone)' })
  createdAt!: Date;
}

@ObjectType({
  description:
    'A product that has fallen to or below its reorder level. ' +
    'Used to populate the reorder list and trigger staff SMS alerts via Hubtel.',
})
export class LowStockAlert {
  @Field(() => ID, { description: 'UUID of the product' })
  productId!: string;

  @Field({ description: 'Product name' })
  productName!: string;

  @Field(() => Int, { description: 'Current units on hand' })
  quantityOnHand!: number;

  @Field(() => Int, { description: 'Configured reorder threshold' })
  reorderLevel!: number;

  @Field({
    description: 'Alert severity. Values: `low` | `critical` | `out`',
  })
  status!: string;
}

@ObjectType({
  description:
    'Real-time stock update event emitted after successful sale, stock receive, GRN intake, or manual adjustment.',
})
export class StockChangedEvent {
  @Field(() => ID)
  productId!: string;

  @Field(() => ID)
  branchId!: string;

  @Field(() => Int)
  quantityOnHand!: number;

  @Field(() => Int)
  reorderLevel!: number;

  @Field({ description: 'Stock health status: `ok` | `low` | `critical` | `out`.' })
  stockStatus!: string;

  @Field({ description: 'Server timestamp for this stock event (Africa/Accra timezone).' })
  changedAt!: Date;
}

// ── GRN (Goods Received Note) Workflow ───────────────────────────────────

@InputType({ description: 'A single product line on a GRN' })
export class GRNItemInput {
  @Field(() => ID, { description: 'UUID of the product being received' })
  @IsUUID()
  productId!: string;

  @Field(() => Int, { description: 'Quantity received' })
  @Min(1)
  quantity!: number;

  @Field({ description: 'Batch/lot number from supplier' })
  @IsString()
  batchNumber!: string;

  @Field({ description: 'Expiry date in ISO 8601 format' })
  @IsDateString()
  expiryDate!: string;

  @Field({
    nullable: true,
    description: 'S3 key of uploaded product image (photo taken during stock receiving)',
  })
  @IsOptional()
  @IsString()
  imageS3Key?: string;

  @Field(() => Int, {
    nullable: true,
    description:
      'Supplier unit cost in GHS pesewas for this received product line. ' +
      'If omitted, the system infers a weighted average cost from invoice total and quantities.',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  unitCostPesewas?: number;
}

@InputType({
  description:
    'Create a Goods Received Note — records stock arrival from supplier with their invoice. ' +
    'Ghana workflow: Supplier delivers goods with invoice → Staff receives and stocks → ' +
    'Manager matches invoice to GRN → Owner pays supplier on credit terms (NET_30/NET_60).',
})
export class CreateGRNInput {
  @Field(() => ID, { description: 'UUID of the supplier delivering the goods' })
  @IsUUID()
  supplierId!: string;

  @Field({
    nullable: true,
    description: 'UUID of the purchase order this GRN is fulfilling (optional)',
  })
  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @Field({
    description: 'Supplier invoice number from their delivery note',
  })
  @IsString()
  supplierInvoiceNumber!: string;

  @Field({
    description: 'Invoice date from supplier document (ISO 8601)',
  })
  @IsDateString()
  invoiceDate!: string;

  @Field({
    nullable: true,
    description: 'Due date for payment (ISO 8601). Calculated from payment terms if not provided.',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @Field(() => Int, {
    description: 'Total invoice amount in GHS pesewas (from supplier invoice)',
  })
  @Min(1)
  totalAmountPesewas!: number;

  @Field({
    nullable: true,
    description: 'S3 key of uploaded supplier invoice PDF/image',
  })
  @IsOptional()
  @IsString()
  invoicePdfS3Key?: string;

  @Field(() => [GRNItemInput], {
    description: 'Products received — each with batch, expiry, optional image',
  })
  @IsArray()
  items!: GRNItemInput[];

  @Field({
    nullable: true,
    description: 'Optional notes from the receiving staff',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

@ObjectType({ description: 'A single product line on a GRN' })
export class GRNItemOutput {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  productId!: string;

  @Field()
  productName!: string;

  @Field(() => Int)
  quantity!: number;

  @Field()
  batchNumber!: string;

  @Field()
  expiryDate!: Date;

  @Field({ nullable: true })
  imageS3Key?: string;

  @Field(() => Int, {
    nullable: true,
    description: 'Observed supplier unit cost captured at receiving time, in GHS pesewas.',
  })
  unitCostPesewas?: number;
}

@ObjectType({
  description:
    'Goods Received Note — records stock arrival from supplier. ' +
    'Links to supplier invoice for 3-way match (PO → GRN → Invoice) and payment tracking.',
})
export class GRNOutput {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  branchId!: string;

  @Field(() => ID)
  supplierId!: string;

  @Field()
  supplierName!: string;

  @Field(() => ID, { nullable: true })
  purchaseOrderId?: string;

  @Field()
  supplierInvoiceNumber!: string;

  @Field()
  invoiceDate!: Date;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field(() => Int)
  totalAmountPesewas!: number;

  @Field()
  totalAmountFormatted!: string;

  @Field({ nullable: true })
  invoicePdfS3Key?: string;

  @Field(() => [GRNItemOutput])
  items!: GRNItemOutput[];

  @Field({ nullable: true })
  notes?: string;

  @Field(() => ID)
  receivedBy!: string;

  @Field()
  receivedByName!: string;

  @Field()
  receivedAt!: Date;

  @Field({
    description: 'true if this GRN has been matched to a supplier_invoice record',
  })
  isMatched!: boolean;
}
