import { InputType, ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import { IsUUID, IsString, IsInt, IsPositive, IsOptional, IsDateString, IsEnum, Min, IsArray, IsNotEmpty } from 'class-validator';

// ── Enums ─────────────────────────────────────────────────────────────────

export enum ExpenseCategory {
  UTILITIES = 'UTILITIES',           // Electricity, water, internet
  RENT = 'RENT',                     // Shop rent
  SALARIES = 'SALARIES',             // Staff salaries
  FUEL = 'FUEL',                     // Delivery vehicle fuel
  MAINTENANCE = 'MAINTENANCE',       // Equipment repairs
  MARKETING = 'MARKETING',           // Advertising, promotions
  LICENSES = 'LICENSES',             // FDA, GRA, GMDC renewals
  BANK_CHARGES = 'BANK_CHARGES',     // MoMo fees, bank charges
  MISCELLANEOUS = 'MISCELLANEOUS',   // Other
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  REJECTED = 'REJECTED',
}

// ── Inputs ────────────────────────────────────────────────────────────────

@InputType({ description: 'Record a staff expense — requires manager/owner approval before payment' })
export class CreateExpenseInput {
  @Field(() => String, { description: 'Expense category' })
  @IsEnum(ExpenseCategory)
  category!: ExpenseCategory;

  @Field(() => Int, { description: 'Amount in GHS pesewas' })
  @IsInt()
  @IsPositive()
  amountPesewas!: number;

  @Field({ description: 'Description of the expense. Example: "Electricity bill — March 2026"' })
  @IsString()
  description!: string;

  @Field({
    nullable: true,
    description: 'S3 key of the uploaded receipt/invoice PDF or image',
  })
  @IsOptional()
  @IsString()
  receiptS3Key?: string;

  @Field({
    nullable: true,
    description: 'Date the expense was incurred (ISO 8601). Defaults to today.',
  })
  @IsOptional()
  @IsDateString()
  expenseDate?: string;
}

@InputType({ description: 'Approve or reject a pending expense' })
export class ApproveExpenseInput {
  @Field(() => ID, { description: 'UUID of the expense to approve/reject' })
  @IsUUID()
  expenseId!: string;

  @Field(() => String, { description: 'APPROVED or REJECTED' })
  @IsEnum(PaymentStatus)
  status!: PaymentStatus;

  @Field({
    nullable: true,
    description: 'Optional notes from the approver',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType({ description: 'Record a payment to a supplier against an invoice' })
export class RecordSupplierPaymentInput {
  @Field(() => ID, { description: 'UUID of the supplier invoice being paid' })
  @IsUUID()
  invoiceId!: string;

  @Field(() => Int, { description: 'Amount paid in GHS pesewas' })
  @IsInt()
  @IsPositive()
  amountPesewas!: number;

  @Field({ description: 'Payment method. Example: CASH, MTN_MOMO, BANK_TRANSFER' })
  @IsString()
  paymentMethod!: string;

  @Field({
    nullable: true,
    description: 'Payment reference (MoMo transaction ID, bank reference, cheque number)',
  })
  @IsOptional()
  @IsString()
  reference?: string;
}

@InputType({ description: 'Match a supplier invoice to a GRN (3-way match: PO → GRN → Invoice)' })
export class MatchSupplierInvoiceInput {
  @Field(() => ID, { description: 'UUID of the supplier invoice' })
  @IsUUID()
  invoiceId!: string;

  @Field(() => ID, { description: 'UUID of the GRN (Goods Received Note) to match against' })
  @IsUUID()
  grnId!: string;

  @Field({
    nullable: true,
    description: 'Optional notes about the match (e.g., discrepancies found)',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType({ description: 'A single OCR-extracted supplier invoice line item.' })
export class SupplierInvoiceOcrLineInput {
  @Field({ nullable: true, description: 'Raw OCR line text for audit/reference.' })
  @IsOptional()
  @IsString()
  rawText?: string;

  @Field({ nullable: true, description: 'Supplier barcode/pack code parsed from OCR.' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @Field({ nullable: true, description: 'Parsed product name from invoice line.' })
  @IsOptional()
  @IsString()
  productName?: string;

  @Field(() => ID, { nullable: true, description: 'Resolved product UUID when OCR pipeline already matched catalog.' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @Field(() => Int, { nullable: true, description: 'Quantity parsed from the line.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @Field(() => Int, { nullable: true, description: 'Unit cost in GHS pesewas parsed from OCR.' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  unitCostPesewas?: number;

  @Field(() => Int, { nullable: true, description: 'Line total in GHS pesewas (used to infer unit cost when missing).' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  lineTotalPesewas?: number;
}

@InputType({
  description:
    'Persist OCR extracted invoice lines and ingest matched unit costs into product cost history ' +
    'for pricing autofill.',
})
export class IngestSupplierInvoiceOcrInput {
  @Field(() => ID, { description: 'Supplier invoice UUID to enrich.' })
  @IsUUID()
  invoiceId!: string;

  @Field(() => [SupplierInvoiceOcrLineInput], { description: 'OCR extracted line items.' })
  @IsArray()
  lines!: SupplierInvoiceOcrLineInput[];

  @Field({ nullable: true, description: 'OCR engine identifier/version. Example: azure-form-recognizer-v4.' })
  @IsOptional()
  @IsString()
  parser?: string;
}

@InputType({ description: 'Single column mapping from spreadsheet source header to OCR target field.' })
export class OcrColumnMappingPairInput {
  @Field({ description: 'Source column header (normalized server-side).' })
  @IsString()
  @IsNotEmpty()
  sourceHeader!: string;

  @Field({
    description:
      'Target field key. Allowed values: productName | barcode | productId | quantity | unitCostGhs | unitCostPesewas | lineTotalGhs | lineTotalPesewas | rawText | ignore',
  })
  @IsString()
  @IsNotEmpty()
  targetField!: string;
}

@InputType({
  description:
    'Create or update a branch-shared OCR column mapping preset for spreadsheet imports.',
})
export class UpsertOcrColumnMappingPresetInput {
  @Field(() => ID, { nullable: true, description: 'Preset UUID to update; omit to create.' })
  @IsOptional()
  @IsUUID()
  presetId?: string;

  @Field(() => ID, { nullable: true, description: 'Optional supplier UUID for supplier-specific presets.' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @Field({ description: 'Preset display name.' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field(() => [OcrColumnMappingPairInput], { description: 'Column mapping pairs.' })
  @IsArray()
  mappings!: OcrColumnMappingPairInput[];
}

// ── Output types ──────────────────────────────────────────────────────────

@ObjectType({ description: 'An expense record — staff expenses requiring approval' })
export class ExpenseOutput {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  branchId!: string;

  @Field(() => String)
  category!: ExpenseCategory;

  @Field(() => Int, { description: 'Amount in GHS pesewas' })
  amountPesewas!: number;

  @Field({ description: 'Formatted amount. Example: GH₵150.00' })
  amountFormatted!: string;

  @Field()
  description!: string;

  @Field({ nullable: true })
  receiptS3Key?: string;

  @Field()
  expenseDate!: Date;

  @Field(() => String)
  status!: PaymentStatus;

  @Field(() => ID)
  createdBy!: string;

  @Field()
  createdByName!: string;

  @Field(() => ID, { nullable: true })
  approvedBy?: string;

  @Field({ nullable: true })
  approvedByName?: string;

  @Field({ nullable: true })
  approvalNotes?: string;

  @Field()
  createdAt!: Date;
}

@ObjectType({ description: 'Supplier credit balance and aging summary' })
export class SupplierCreditSummary {
  @Field(() => ID)
  supplierId!: string;

  @Field()
  supplierName!: string;

  @Field(() => Int, { description: 'Total outstanding balance in GHS pesewas' })
  outstandingBalancePesewas!: number;

  @Field({ description: 'Formatted balance. Example: GH₵12,500.00' })
  outstandingBalanceFormatted!: string;

  @Field(() => Int, { description: 'Amount overdue (past due date) in GHS pesewas' })
  overduePesewas!: number;

  @Field({ description: 'Formatted overdue amount' })
  overdueFormatted!: string;

  @Field(() => Int, { description: 'Number of unpaid invoices' })
  unpaidInvoiceCount!: number;

  @Field(() => Int, { description: 'Number of overdue invoices' })
  overdueInvoiceCount!: number;

  @Field({ nullable: true, description: 'Next payment due date (earliest unpaid invoice)' })
  nextPaymentDue?: Date;

  @Field(() => Int, { description: 'Credit limit in GHS pesewas (from supplier record)' })
  creditLimitPesewas!: number;

  @Field(() => Float, { description: 'Credit utilization % (outstanding / credit_limit * 100)' })
  creditUtilizationPct!: number;
}

@ObjectType({ description: 'Supplier invoice with payment status' })
export class SupplierInvoiceOutput {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  supplierId!: string;

  @Field()
  supplierName!: string;

  @Field(() => ID)
  branchId!: string;

  @Field(() => ID, { nullable: true })
  grnId?: string;

  @Field()
  invoiceNumber!: string;

  @Field()
  invoiceDate!: Date;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field(() => Int)
  totalAmountPesewas!: number;

  @Field()
  totalAmountFormatted!: string;

  @Field(() => Int)
  paidAmountPesewas!: number;

  @Field()
  paidAmountFormatted!: string;

  @Field(() => Int, { description: 'Remaining balance = total - paid' })
  balancePesewas!: number;

  @Field()
  balanceFormatted!: string;

  @Field(() => String, { description: 'PENDING | MATCHED | PARTIAL | PAID | OVERDUE' })
  status!: string;

  @Field({ nullable: true })
  s3PdfKey?: string;

  @Field()
  createdAt!: Date;
}

@ObjectType({ description: 'Cash flow intelligence — predict when to pay suppliers based on sales velocity' })
export class CashFlowForecast {
  @Field(() => Int, { description: 'Current cash on hand in GHS pesewas' })
  currentCashPesewas!: number;

  @Field()
  currentCashFormatted!: string;

  @Field(() => Int, { description: 'Total supplier payables due in next 7 days' })
  payablesDue7DaysPesewas!: number;

  @Field()
  payablesDue7DaysFormatted!: string;

  @Field(() => Int, { description: 'Total supplier payables due in next 30 days' })
  payablesDue30DaysPesewas!: number;

  @Field()
  payablesDue30DaysFormatted!: string;

  @Field(() => Int, { description: 'Projected revenue in next 7 days (based on 30-day avg daily sales)' })
  projectedRevenue7DaysPesewas!: number;

  @Field()
  projectedRevenue7DaysFormatted!: string;

  @Field(() => Int, { description: 'Projected revenue in next 30 days' })
  projectedRevenue30DaysPesewas!: number;

  @Field()
  projectedRevenue30DaysFormatted!: string;

  @Field(() => Float, { description: 'Cash runway in days (current cash / avg daily expenses)' })
  cashRunwayDays!: number;

  @Field({
    description:
      'Recommendation: PAY_NOW | WAIT_7_DAYS | WAIT_30_DAYS | NEGOTIATE_EXTENSION | CRITICAL_LOW_CASH',
  })
  recommendation!: string;

  @Field({ description: 'Human-readable explanation of the recommendation' })
  recommendationReason!: string;
}

@ObjectType({ description: 'Profit & Loss statement for a period' })
export class ProfitLossStatement {
  @Field()
  periodStart!: string;

  @Field()
  periodEnd!: string;

  @Field(() => Int, { description: 'Total revenue (sales) in GHS pesewas' })
  revenuePesewas!: number;

  @Field()
  revenueFormatted!: string;

  @Field(() => Int, { description: 'Cost of goods sold (COGS) — supplier invoices matched to sales' })
  cogsPesewas!: number;

  @Field()
  cogsFormatted!: string;

  @Field(() => Int, { description: 'Gross profit = revenue - COGS' })
  grossProfitPesewas!: number;

  @Field()
  grossProfitFormatted!: string;

  @Field(() => Float, { description: 'Gross profit margin % = (gross profit / revenue) * 100' })
  grossProfitMarginPct!: number;

  @Field(() => Int, { description: 'Total operating expenses (salaries, rent, utilities, etc.)' })
  operatingExpensesPesewas!: number;

  @Field()
  operatingExpensesFormatted!: string;

  @Field(() => Int, { description: 'Net profit = gross profit - operating expenses' })
  netProfitPesewas!: number;

  @Field()
  netProfitFormatted!: string;

  @Field(() => Float, { description: 'Net profit margin % = (net profit / revenue) * 100' })
  netProfitMarginPct!: number;
}

@ObjectType({
  description:
    'Excel workbook export payload for accounting. `base64Content` should be decoded and saved as .xlsx on the client.',
})
export class AccountingWorkbookExport {
  @Field({ description: 'Suggested file name for the exported workbook' })
  fileName!: string;

  @Field({ description: 'MIME type for Excel workbook' })
  mimeType!: string;

  @Field({ description: 'Base64 encoded XLSX binary content' })
  base64Content!: string;
}

@ObjectType({ description: 'Summary after ingesting OCR supplier invoice lines.' })
export class InvoiceOcrIngestionResult {
  @Field(() => ID)
  invoiceId!: string;

  @Field(() => Int)
  totalLines!: number;

  @Field(() => Int)
  matchedLines!: number;

  @Field(() => Int)
  unmatchedLines!: number;

  @Field(() => Int, { description: 'Number of product_cost_history rows created from OCR invoice lines.' })
  costSnapshotsCreated!: number;

  @Field(() => [String], {
    description:
      'Unmatched line hints so web can show user review actions (e.g. map product manually).',
  })
  unmatchedHints!: string[];
}

@ObjectType({ description: 'Single mapped column rule in an OCR preset.' })
export class OcrColumnMappingPair {
  @Field()
  sourceHeader!: string;

  @Field()
  targetField!: string;
}

@ObjectType({ description: 'Branch-shared OCR spreadsheet mapping preset.' })
export class OcrColumnMappingPresetOutput {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  branchId!: string;

  @Field(() => ID, { nullable: true })
  supplierId?: string;

  @Field({ nullable: true })
  supplierName?: string;

  @Field()
  name!: string;

  @Field(() => [OcrColumnMappingPair])
  mappings!: OcrColumnMappingPair[];

  @Field()
  updatedAt!: Date;
}
