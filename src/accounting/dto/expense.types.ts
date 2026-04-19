import { Field, ObjectType, InputType, registerEnumType, ID, Int } from '@nestjs/graphql';
import { IsString, IsEnum, IsInt, IsOptional, Min, IsDateString, IsBoolean } from 'class-validator';

// ── Enums ────────────────────────────────────────────────────────────────────

export enum ExpenseCategory {
  FUEL = 'FUEL',
  UTILITIES = 'UTILITIES',
  SUPPLIES = 'SUPPLIES',
  TRANSPORT = 'TRANSPORT',
  MEALS = 'MEALS',
  OTHER = 'OTHER',
}

export enum ExpenseStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REIMBURSED = 'REIMBURSED',
}

export enum ExpensePaymentMethod {
  CASH = 'CASH',
  MOMO = 'MOMO',
  PERSONAL_CARD = 'PERSONAL_CARD',
}

export enum ReimbursementMethod {
  CASH = 'CASH',
  MOMO = 'MOMO',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

registerEnumType(ExpenseCategory, { name: 'ExpenseCategory' });
registerEnumType(ExpenseStatus, { name: 'ExpenseStatus' });
registerEnumType(ExpensePaymentMethod, { name: 'ExpensePaymentMethod' });
registerEnumType(ReimbursementMethod, { name: 'ReimbursementMethod' });

// ── Input Types ──────────────────────────────────────────────────────────────

@InputType()
export class CreateStaffExpenseInput {
  @Field(() => ExpenseCategory)
  @IsEnum(ExpenseCategory)
  category!: ExpenseCategory;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  amountPesewas!: number;

  @Field()
  @IsString()
  description!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  merchantName?: string;

  @Field()
  @IsString()
  expenseDate!: string;

  @Field({ nullable: true, description: 'Receipt S3 key (uploaded separately)' })
  @IsOptional()
  @IsString()
  receiptS3Key?: string;

  @Field(() => ExpensePaymentMethod)
  @IsEnum(ExpensePaymentMethod)
  paymentMethod!: ExpensePaymentMethod;
}

@InputType()
export class ApproveStaffExpenseInput {
  @Field(() => ID)
  @IsString()
  expenseId!: string;

  @Field()
  @IsBoolean()
  approve!: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field(() => ReimbursementMethod, { nullable: true })
  @IsOptional()
  @IsEnum(ReimbursementMethod)
  reimbursementMethod?: ReimbursementMethod;
}

@InputType()
export class ReimburseExpenseInput {
  @Field(() => ID)
  expenseId!: string;

  @Field(() => ReimbursementMethod)
  reimbursementMethod!: ReimbursementMethod;

  @Field({ nullable: true })
  reference?: string;
}

// ── Output Types ─────────────────────────────────────────────────────────────

@ObjectType()
export class StaffExpenseOutput {
  @Field(() => ID)
  id!: string;

  @Field(() => ExpenseCategory)
  category!: string;

  @Field(() => Int)
  amountPesewas!: number;

  @Field()
  amountFormatted!: string;

  @Field()
  description!: string;

  @Field({ nullable: true })
  merchantName?: string;

  @Field()
  expenseDate!: string;

  @Field({ nullable: true })
  receiptUrl?: string;

  @Field(() => Int, { nullable: true })
  ocrExtractedAmount?: number;

  @Field(() => ExpensePaymentMethod)
  paymentMethod!: string;

  @Field(() => ExpenseStatus)
  status!: string;

  @Field({ nullable: true })
  approvedByName?: string;

  @Field({ nullable: true })
  approvedAt?: Date;

  @Field({ nullable: true })
  approvalNotes?: string;

  @Field(() => ReimbursementMethod, { nullable: true })
  reimbursementMethod?: string;

  @Field({ nullable: true })
  reimbursedByName?: string;

  @Field({ nullable: true })
  reimbursedAt?: Date;

  @Field({ nullable: true })
  reimbursementReference?: string;

  @Field()
  createdByName!: string;

  @Field()
  createdAt!: Date;
}

@ObjectType()
export class ExpenseCategoryBreakdown {
  @Field(() => ExpenseCategory)
  category!: string;

  @Field(() => Int)
  amountPesewas!: number;

  @Field()
  amountFormatted!: string;

  @Field(() => Int)
  count!: number;

  @Field()
  percentOfTotal!: number;
}

@ObjectType()
export class ExpenseStaffBreakdown {
  @Field(() => ID)
  staffId!: string;

  @Field()
  staffName!: string;

  @Field(() => Int)
  amountPesewas!: number;

  @Field()
  amountFormatted!: string;

  @Field(() => Int)
  count!: number;
}

@ObjectType()
export class ExpenseAnalyticsOutput {
  @Field(() => Int)
  totalExpensesPesewas!: number;

  @Field()
  totalExpensesFormatted!: string;

  @Field(() => [ExpenseCategoryBreakdown])
  byCategory!: ExpenseCategoryBreakdown[];

  @Field(() => [ExpenseStaffBreakdown])
  byStaff!: ExpenseStaffBreakdown[];

  @Field(() => Int)
  pendingApprovalCount!: number;

  @Field(() => Int)
  pendingReimbursementPesewas!: number;

  @Field()
  pendingReimbursementFormatted!: string;
}
