import { ObjectType, Field, ID, Int, InputType } from '@nestjs/graphql';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

@InputType({
  description:
    'Create a new product in the catalogue. The product is created as active and can immediately receive stock in inventory.',
})
export class CreateProductInput {
  @Field({ description: 'Brand/trade name. Example: "Paracetamol 500mg"' })
  @IsString()
  @MaxLength(255)
  name!: string;

  @Field({ nullable: true, description: 'Generic/INN name. Example: "Paracetamol"' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  genericName?: string;

  @Field({ nullable: true, description: 'Optional barcode (EAN-13 or custom branch code)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  barcode?: string;

  @Field(() => Int, {
    description: 'Unit selling price in GHS pesewas (integer). Example: GH¢12.50 = 1250.',
  })
  @IsInt()
  @Min(0)
  unitPrice!: number;

  @Field({
    description: 'Product classification. Values: OTC | POM | CONTROLLED.',
    defaultValue: 'OTC',
  })
  @IsIn(['OTC', 'POM', 'CONTROLLED'])
  classification!: string;

  @Field({
    description: 'Allowed branch type for sale. Values: pharmaceutical | chemical | both.',
    defaultValue: 'both',
  })
  @IsIn(['pharmaceutical', 'chemical', 'both'])
  branchType!: string;

  @Field({
    nullable: true,
    description: 'Whether VAT is exempt. Defaults based on classification when omitted.',
  })
  @IsOptional()
  @IsBoolean()
  vatExempt?: boolean;

  @Field({
    nullable: true,
    description: 'Whether prescription is required. Defaults based on classification when omitted.',
  })
  @IsOptional()
  @IsBoolean()
  requiresRx?: boolean;

  @Field(() => ID, { nullable: true, description: 'Optional linked product category UUID.' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @Field(() => ID, { nullable: true, description: 'Optional linked supplier UUID.' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @Field(() => Int, {
    nullable: true,
    description: 'Initial branch reorder level for this product. Defaults to 10.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  reorderLevel?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Initial unit cost price in GHS pesewas (integer).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  costPrice?: number;
}

@ObjectType({ description: 'Product image with CDN URLs and source metadata' })
export class ProductImageType {
  @Field(() => ID, { description: 'UUID of the image record' })
  id!: string;

  @Field({ description: 'Full-size CDN URL. Use for product detail pages.' })
  cdnUrl!: string;

  @Field({ description: 'Thumbnail CDN URL (200×200px). Use for search result cards.' })
  urlThumb!: string;

  @Field({
    description:
      'Image source. Values: `DRUG_DB` | `DALLE3` (reserved for future automated pipelines) | ' +
      '`MANUAL_UPLOAD` (e.g. GRN photo) | `PLACEHOLDER` (seeded DB placeholder).',
  })
  source!: string;

  @Field({
    description:
      '`true` if the image has been reviewed and approved by a pharmacist. ' +
      'AI-generated images start as `false` until approved.',
  })
  isApproved!: boolean;
}

@ObjectType({ description: 'A single stock batch — used for FEFO (First Expiry First Out) dispensing' })
export class InventoryBatchType {
  @Field({ description: 'Batch/lot number from the supplier GRN' })
  batchNumber!: string;

  @Field(() => Int, { description: 'Quantity remaining in this batch' })
  quantity!: number;

  @Field({
    description:
      'Expiry date in ISO 8601 format. Batches are ordered by expiry (nearest first) for FEFO dispensing.',
  })
  expiryDate!: string;
}

@ObjectType({ description: 'Inventory position for a product at the current branch' })
export class ProductInventoryType {
  @Field(() => Int, { description: 'Total units on hand across all batches at this branch' })
  quantityOnHand!: number;

  @Field(() => Int, {
    description:
      'Reorder threshold. A low-stock alert fires when `quantityOnHand` falls to this level.',
  })
  reorderLevel!: number;

  @Field(() => [InventoryBatchType], {
    description: 'Individual stock batches ordered by expiry date (FEFO). Used for dispensing order.',
  })
  batches!: InventoryBatchType[];
}

@ObjectType({ description: 'Supplier summary embedded in a product' })
export class ProductSupplierType {
  @Field(() => ID, { description: 'UUID of the supplier' })
  id!: string;

  @Field({ description: 'Supplier trading name' })
  name!: string;

  @Field(() => Int, {
    nullable: true,
    description:
      'AI-computed supplier reliability score (0–100). ' +
      'Based on on-time delivery, quality complaints, and price consistency.',
  })
  aiScore?: number;
}

@ObjectType({ description: 'Product category (e.g. Antibiotic, Analgesic, Antihypertensive)' })
export class ProductCategoryType {
  @Field(() => ID, { description: 'UUID of the category' })
  id!: string;

  @Field({ description: 'Category name. Example: `"Antibiotic"`, `"Analgesic"`, `"Antifungal"`' })
  name!: string;
}

@ObjectType({
  description:
    'A product in the Azzay Pharmacy catalogue. ' +
    'Products are scoped to an organisation and can be available at `pharmaceutical`, `chemical`, or `both` branch types. ' +
    'When no approved `product_images` row exists, the web POS uses a deterministic Unsplash stock-photo fallback from id, name, generic name, and category.',
})
export class ProductType {
  @Field(() => ID, { description: 'UUID of the product' })
  id!: string;

  @Field({ description: 'Brand/trade name. Example: `"Paracetamol 500mg"`, `"Amoxil 250mg/5ml"`' })
  name!: string;

  @Field({ nullable: true, description: 'Generic/INN name. Example: `"Paracetamol"`, `"Amoxicillin"`' })
  genericName?: string;

  @Field({ nullable: true, description: 'Barcode (EAN-13 or custom). Used for barcode scanner at POS.' })
  barcode?: string;

  @Field(() => Int, {
    description:
      'Unit selling price in **GHS pesewas** (integer). ' +
      'Example: GH₵12.50 = `1250`. Always GHS — never USD.',
  })
  unitPrice!: number;

  @Field({
    description:
      'Ghana FDA classification. Values:\n' +
      '- `OTC` — Over the counter, no prescription needed\n' +
      '- `POM` — Prescription Only Medicine, requires approved Rx\n' +
      '- `CONTROLLED` — Controlled drug, requires two pharmacist sign-offs',
  })
  classification!: string;

  @Field({
    description:
      'Which branch type can sell this product. Values: `pharmaceutical` | `chemical` | `both`. ' +
      'Ghana FDA: POM and CONTROLLED products are always `pharmaceutical` only.',
  })
  branchType!: string;

  @Field({
    description:
      'Ghana GRA: `true` if this product is VAT-exempt. ' +
      'Prescription medicines (`requiresRx = true`) are VAT-exempt. ' +
      'OTC products are subject to 15% VAT.',
  })
  vatExempt!: boolean;

  @Field({
    description:
      'Ghana FDA: `true` if an approved prescription is required before this product can be sold. ' +
      'Attempting to sell without a prescription throws `FDA_POM_VIOLATION`.',
  })
  requiresRx!: boolean;

  @Field(() => ProductImageType, {
    nullable: true,
    description:
      'Approved image row when present. Null if none; web POS shows a deterministic stock-photo fallback from product id/name/generic/category.',
  })
  image?: ProductImageType;

  @Field(() => ProductInventoryType, {
    nullable: true,
    description: 'Inventory position at the current branch. Null if queried without branch context.',
  })
  inventory?: ProductInventoryType;

  @Field(() => ProductSupplierType, {
    nullable: true,
    description: 'Primary supplier. Enables full supply chain traceability per Ghana FDA requirements.',
  })
  supplier?: ProductSupplierType;

  @Field(() => ProductCategoryType, { nullable: true, description: 'Product category' })
  category?: ProductCategoryType;
}
