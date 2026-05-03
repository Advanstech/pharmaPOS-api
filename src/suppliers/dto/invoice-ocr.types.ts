import { InputType, ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { IsUUID, IsString, IsInt, Min, IsOptional, IsArray, IsDateString, IsDefined } from 'class-validator';
import { GraphQLUpload, FileUpload } from 'graphql-upload-ts';

// ── Enums ─────────────────────────────────────────────────────────────────

export enum OcrStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

registerEnumType(OcrStatus, {
  name: 'OcrStatus',
  description: 'Invoice OCR processing status',
});

export enum PaymentTerms {
  IMMEDIATE = 'IMMEDIATE',
  ON_DELIVERY = 'ON_DELIVERY',
  NET_7 = 'NET_7',
  NET_30 = 'NET_30',
  NET_60 = 'NET_60',
  CUSTOM = 'CUSTOM',
}

registerEnumType(PaymentTerms, {
  name: 'PaymentTerms',
  description: 'Supplier payment terms',
});

export enum PaymentStatus {
  UNPAID = 'UNPAID',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
}

registerEnumType(PaymentStatus, {
  name: 'PaymentStatus',
  description: 'Invoice payment status',
});

// ── Inputs ────────────────────────────────────────────────────────────────

@InputType({ description: 'Upload supplier invoice for OCR processing' })
export class UploadSupplierInvoiceInput {
  @Field(() => ID, { nullable: true, description: 'Supplier UUID (optional - will be matched from invoice)' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @Field(() => GraphQLUpload, { description: 'Invoice file (PDF or Image)' })
  @IsDefined()
  invoiceFile!: Promise<FileUpload>;

  @Field({ nullable: true, description: 'Delivery date (defaults to today)' })
  @IsOptional()
  @IsDateString()
  deliveryDate?: string;
}

@InputType({ description: 'Confirm and create GRN from OCR data' })
export class ConfirmOcrInvoiceInput {
  @Field(() => ID, { description: 'OCR job ID' })
  @IsUUID()
  ocrJobId!: string;

  @Field({ description: 'Confirmed invoice number' })
  @IsString()
  invoiceNumber!: string;

  @Field({ description: 'Confirmed invoice date (YYYY-MM-DD)' })
  @IsDateString()
  invoiceDate!: string;

  @Field({ nullable: true, description: 'Due date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @Field(() => [ConfirmedInvoiceItemInput], { description: 'Confirmed invoice items' })
  @IsArray()
  items!: ConfirmedInvoiceItemInput[];

  @Field(() => Int, { description: 'Total amount in pesewas' })
  @Min(1)
  totalAmountPesewas!: number;

  @Field({ nullable: true, description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType({ description: 'Confirmed invoice item with product match' })
export class ConfirmedInvoiceItemInput {
  @Field({ description: 'Original OCR description' })
  @IsString()
  ocrDescription!: string;

  @Field(() => ID, { description: 'Matched or manually selected product ID' })
  @IsUUID()
  productId!: string;

  @Field(() => Int, { description: 'Quantity received' })
  @Min(1)
  quantity!: number;

  @Field(() => Int, { description: 'Unit price in pesewas' })
  @Min(1)
  unitPricePesewas!: number;

  @Field({ description: 'Batch number' })
  @IsString()
  batchNumber!: string;

  @Field({ description: 'Expiry date (YYYY-MM-DD)' })
  @IsDateString()
  expiryDate!: string;

  @Field({ nullable: true, description: 'Product image URL (if fetched)' })
  @IsOptional()
  @IsString()
  productImageUrl?: string;
}

@InputType({ description: 'Record supplier payment' })
export class RecordSupplierPaymentInput {
  @Field(() => ID, { description: 'Invoice ID' })
  @IsUUID()
  invoiceId!: string;

  @Field(() => Int, { description: 'Payment amount in pesewas' })
  @Min(1)
  amountPesewas!: number;

  @Field({ description: 'Payment method' })
  @IsString()
  paymentMethod!: string;

  @Field({ nullable: true, description: 'Payment reference (MoMo ref, bank ref, cheque no)' })
  @IsOptional()
  @IsString()
  reference?: string;

  @Field({ nullable: true, description: 'Payment notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ── Output Types ──────────────────────────────────────────────────────────

@ObjectType({ description: 'OCR extracted invoice item' })
export class OcrInvoiceItem {
  @Field({ nullable: true, description: 'Product description from invoice' })
  description?: string;

  @Field(() => Int, { nullable: true, description: 'Quantity' })
  quantity?: number;

  @Field(() => Int, { nullable: true, description: 'Unit price in pesewas' })
  unitPrice?: number;

  @Field(() => Int, { nullable: true, description: 'Total price in pesewas' })
  totalPrice?: number;

  @Field({ nullable: true, description: 'Batch number if present on invoice line' })
  batchNumber?: string;

  @Field({ nullable: true, description: 'Expiry date (YYYY-MM-DD) if present on invoice line' })
  expiryDate?: string;

  @Field(() => Int, { nullable: true, description: 'OCR confidence for this item (0-100)' })
  confidence?: number;

  @Field(() => [ProductMatch], { nullable: true, description: 'Matched products from database' })
  matches?: ProductMatch[];

  @Field({ nullable: true, description: 'Suggested product image URL' })
  suggestedImageUrl?: string;

  @Field({ nullable: true, description: 'Image source (RXIMAGE, OPENFDA, etc)' })
  imageSource?: string;

  @Field(() => Int, { nullable: true, description: 'Image confidence score' })
  imageConfidence?: number;
}

@ObjectType({ description: 'Product match result' })
export class ProductMatch {
  @Field(() => ID, { nullable: true, description: 'Product UUID' })
  productId?: string;

  @Field({ nullable: true, description: 'Product name' })
  productName?: string;

  @Field(() => Int, { nullable: true, description: 'Match score (0-100)' })
  matchScore?: number;

  @Field({ nullable: true, description: 'Match reason' })
  matchReason?: string;
}

@ObjectType({ description: 'OCR extracted invoice data' })
export class OcrExtractedData {
  @Field({ nullable: true, description: 'Invoice number' })
  invoiceNumber?: string;

  @Field({ nullable: true, description: 'Invoice date' })
  invoiceDate?: string;

  @Field({ nullable: true, description: 'Due date (YYYY-MM-DD) if present on invoice' })
  dueDate?: string;

  @Field({ nullable: true, description: 'Supplier name' })
  supplierName?: string;

  @Field({ nullable: true, description: 'Supplier address' })
  supplierAddress?: string;

  @Field({ nullable: true, description: 'Supplier phone' })
  supplierPhone?: string;

  @Field(() => [OcrInvoiceItem], { nullable: true, description: 'Invoice items' })
  items?: OcrInvoiceItem[];

  @Field(() => Int, { nullable: true, description: 'Subtotal in pesewas' })
  subtotal?: number;

  @Field(() => Int, { nullable: true, description: 'VAT in pesewas' })
  vat?: number;

  @Field(() => Int, { nullable: true, description: 'Total amount in pesewas' })
  totalAmount?: number;

  @Field(() => Int, { nullable: true, description: 'Overall OCR confidence (0-100)' })
  confidence?: number;

  @Field({ nullable: true, description: 'Raw OCR text' })
  rawText?: string;
}

@ObjectType({ description: 'Invoice OCR job' })
export class InvoiceOcrJob {
  @Field(() => ID, { description: 'Job UUID' })
  id!: string;

  @Field(() => OcrStatus, { description: 'Processing status' })
  status!: OcrStatus;

  @Field(() => Int, { description: 'Processing progress (0-100)' })
  progress!: number;

  @Field({ nullable: true, description: 'OCR provider used' })
  ocrProvider?: string;

  @Field(() => OcrExtractedData, { nullable: true, description: 'Extracted invoice data' })
  extractedData?: OcrExtractedData;

  @Field(() => Int, { nullable: true, description: 'OCR confidence score' })
  confidenceScore?: number;

  @Field({ description: 'Requires manual review', defaultValue: false })
  requiresReview!: boolean;

  @Field({ nullable: true, description: 'Error message if failed' })
  errorMessage?: string;

  @Field({ description: 'File S3 key' })
  fileS3Key!: string;

  @Field({ description: 'File type' })
  fileType!: string;

  @Field(() => Int, { description: 'File size in bytes' })
  fileSizeBytes!: number;

  @Field({ nullable: true, description: 'Supplier name' })
  supplierName?: string;

  @Field(() => ID, { nullable: true, description: 'Matched supplier UUID when available' })
  supplierId?: string;

  @Field({ description: 'Created by user name' })
  createdByName!: string;

  @Field({ description: 'Created at' })
  createdAt!: Date;

  @Field({ nullable: true, description: 'Processing completed at' })
  processingCompletedAt?: Date;
}

@ObjectType({ description: 'Invoice OCR upload response' })
export class UploadInvoiceResponse {
  @Field(() => ID, { description: 'OCR job ID' })
  id!: string;

  @Field(() => OcrStatus, { description: 'Initial status' })
  status!: OcrStatus;

  @Field({ description: 'OCR job ID for polling' })
  ocrJobId!: string;

  @Field({ description: 'Message' })
  message!: string;
}

@ObjectType({ description: 'A single line item on a supplier invoice (from GRN stock movements)' })
export class InvoiceLineItem {
  @Field(() => ID) id!: string;
  @Field() productId!: string;
  @Field() productName!: string;
  @Field({ nullable: true }) genericName?: string;
  @Field(() => Int) quantity!: number;
  @Field(() => Int) unitCostPesewas!: number;
  @Field() unitCostFormatted!: string;
  @Field(() => Int) lineTotalPesewas!: number;
  @Field() lineTotalFormatted!: string;
  @Field({ nullable: true }) batchNumber?: string;
  @Field({ nullable: true }) expiryDate?: string;
  @Field({ nullable: true }) imageUrl?: string;
}

@ObjectType({ description: 'Confirmed invoice response' })
export class ConfirmInvoiceResponse {
  @Field(() => ID, { description: 'Created GRN ID' })
  grnId!: string;

  @Field(() => ID, { description: 'Created supplier invoice ID' })
  supplierInvoiceId!: string;

  @Field({ description: 'Stock updated successfully' })
  stockUpdated!: boolean;

  @Field(() => Int, { description: 'Number of product images processed' })
  imagesProcessed!: number;

  @Field({ description: 'Success message' })
  message!: string;
}

@ObjectType({ description: 'Supplier payment record' })
export class SupplierPayment {
  @Field(() => ID)
  id!: string;

  @Field(() => Int, { description: 'Payment amount in pesewas' })
  amountPesewas!: number;

  @Field({ description: 'Payment amount formatted' })
  amountFormatted!: string;

  @Field({ description: 'Payment method' })
  paymentMethod!: string;

  @Field({ nullable: true, description: 'Payment reference' })
  reference?: string;

  @Field({ nullable: true, description: 'Payment notes' })
  notes?: string;

  @Field({ description: 'Paid by user name' })
  paidByName!: string;

  @Field({ description: 'Payment date' })
  paidAt!: Date;
}

@ObjectType({ description: 'Enhanced supplier invoice with payment tracking' })
export class EnhancedSupplierInvoice {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  supplierId!: string;

  @Field({ description: 'Invoice number' })
  invoiceNumber!: string;

  @Field({ description: 'Invoice date' })
  invoiceDate!: Date;

  @Field({ nullable: true, description: 'Due date' })
  dueDate?: Date;

  @Field(() => Int, { description: 'Total amount in pesewas' })
  totalAmountPesewas!: number;

  @Field({ description: 'Total amount formatted' })
  totalAmountFormatted!: string;

  @Field(() => Int, { description: 'Paid amount in pesewas' })
  paidAmountPesewas!: number;

  @Field({ description: 'Paid amount formatted' })
  paidAmountFormatted!: string;

  @Field(() => Int, { description: 'Balance in pesewas' })
  balancePesewas!: number;

  @Field({ description: 'Balance formatted' })
  balanceFormatted!: string;

  @Field(() => Int, { description: 'Payment progress in percent (0-100)' })
  paymentProgressPct!: number;

  @Field(() => PaymentTerms, { description: 'Payment terms' })
  paymentTerms!: PaymentTerms;

  @Field(() => PaymentStatus, { description: 'Payment status' })
  paymentStatus!: PaymentStatus;

  @Field(() => Int, { description: 'Days outstanding' })
  daysOutstanding!: number;

  @Field({ description: 'Is overdue' })
  isOverdue!: boolean;

  @Field(() => Int, { nullable: true, description: 'Overdue by days' })
  overdueByDays?: number;

  @Field(() => Int, { description: 'Suggested next payment amount in pesewas based on outstanding balance' })
  suggestedNextPaymentPesewas!: number;

  @Field({ description: 'Suggested next payment formatted' })
  suggestedNextPaymentFormatted!: string;

  @Field(() => Int, { description: 'Remaining balance after suggested next payment' })
  remainingAfterSuggestedPesewas!: number;

  @Field({ description: 'Remaining balance after suggested payment formatted' })
  remainingAfterSuggestedFormatted!: string;

  @Field(() => [SupplierPayment], { description: 'Payment history' })
  payments!: SupplierPayment[];

  @Field({ description: 'Supplier name' })
  supplierName!: string;

  @Field({ nullable: true, description: 'S3 key or URL for uploaded invoice PDF/image' })
  s3PdfKey?: string;

  @Field({ nullable: true, description: 'Serialized extracted OCR payload for audit/review' })
  extractedDataJson?: string;

  @Field({ nullable: true, description: 'GRN ID' })
  grnId?: string;
}
