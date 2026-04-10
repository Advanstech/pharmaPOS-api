import { Field, ObjectType, InputType, registerEnumType, ID, Int } from '@nestjs/graphql';
import { GraphQLUpload, FileUpload } from 'graphql-upload-ts';

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
  category: ExpenseCategory;

  @Field(() => Int)
  amountPesewas: number;

  @Field()
  description: string;

  @Field({ nullable: true })
  merchantName?: string;

  @Field()
  expenseDate: string; // YYYY-MM-DD

  @Field(() => GraphQLUpload, { nullable: true })
  receiptImage?: Promise<FileUpload>;

  @Field(() => ExpensePaymentMethod)
  paymentMethod: ExpensePaymentMethod;
}

@InputType()
export class ApproveStaffExpenseInput {
  @Field(() => ID)
  expenseId: string;

  @Field()
  approve: boolean; // true = APPROVE, false = REJECT

  @Field({ nullable: true })
  notes?: string;

  @Field(() => ReimbursementMethod, { nullable: true })
  reimbursementMethod?: ReimbursementMethod;
}

@InputType()
export class ReimburseExpenseInput {
  @Field(() => ID)
  expenseId: string;

  @Field(() => ReimbursementMethod)
  reimbursementMethod: ReimbursementMethod;

  @Field({ nullable: true })
  reference?: string;
}

// ── Output Types ─────────────────────────────────────────────────────────────

@ObjectType()
export class StaffExpenseOutput {
  @Field(() => ID)
  id: string;

  @Field(() => ExpenseCategory)
  category: string;

  @Field(() => Int)
  amountPesewas: number;

  @Field()
  amountFormatted: string;

  @Field()
  description: string;

  @Field({ nullable: true })
  merchantName?: string;

  @Field()
  expenseDate: string;

  @Field({ nullable: true })
  receiptUrl?: string;

  @Field(() => Int, { nullable: true })
  ocrExtractedAmount?: number;

  @Field(() => ExpensePaymentMethod)
  paymentMethod: string;

  @Field(() => ExpenseStatus)
  status: string;

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
  createdByName: string;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class ExpenseCategoryBreakdown {
  @Field(() => ExpenseCategory)
  category: string;

  @Field(() => Int)
  amountPesewas: number;

  @Field()
  amountFormatted: string;

  @Field(() => Int)
  count: number;

  @Field()
  percentOfTotal: number;
}

@ObjectType()
export class ExpenseStaffBreakdown {
  @Field(() => ID)
  staffId: string;

  @Field()
  staffName: string;

  @Field(() => Int)
  amountPesewas: number;

  @Field()
  amountFormatted: string;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class ExpenseAnalyticsOutput {
  @Field(() => Int)
  totalExpensesPesewas: number;

  @Field()
  totalExpensesFormatted: string;

  @Field(() => [ExpenseCategoryBreakdown])
  byCategory: ExpenseCategoryBreakdown[];

  @Field(() => [ExpenseStaffBreakdown])
  byStaff: ExpenseStaffBreakdown[];

  @Field(() => Int)
  pendingApprovalCount: number;

  @Field(() => Int)
  pendingReimbursementPesewas: number;

  @Field()
  pendingReimbursementFormatted: string;
}
