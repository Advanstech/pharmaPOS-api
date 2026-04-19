import { ObjectType, Field, ID, Int, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

// ── Trial Balance ─────────────────────────────────────────────────────────────

@ObjectType()
export class TrialBalanceRowOutput {
  @Field() accountCode!: string;
  @Field() accountName!: string;
  @Field(() => Int) totalDebit!: number;
  @Field(() => Int) totalCredit!: number;
  @Field(() => Int) balance!: number;
  @Field() balanceFormatted!: string;
  @Field() balanceType!: string; // DEBIT or CREDIT
}

// ── Balance Sheet ─────────────────────────────────────────────────────────────

@ObjectType()
export class BalanceSheetLineOutput {
  @Field() accountCode!: string;
  @Field() accountName!: string;
  @Field(() => Int) balancePesewas!: number;
  @Field() balanceFormatted!: string;
}

@ObjectType()
export class BalanceSheetOutput {
  @Field() asOfDate!: string;

  @Field(() => [BalanceSheetLineOutput]) assets!: BalanceSheetLineOutput[];
  @Field(() => Int) totalAssetsPesewas!: number;
  @Field() totalAssetsFormatted!: string;

  @Field(() => [BalanceSheetLineOutput]) liabilities!: BalanceSheetLineOutput[];
  @Field(() => Int) totalLiabilitiesPesewas!: number;
  @Field() totalLiabilitiesFormatted!: string;

  @Field(() => [BalanceSheetLineOutput]) equity!: BalanceSheetLineOutput[];
  @Field(() => Int) totalEquityPesewas!: number;
  @Field() totalEquityFormatted!: string;

  @Field() isBalanced!: boolean;
}

// ── GL Detail ─────────────────────────────────────────────────────────────────

@ObjectType()
export class GLDetailRowOutput {
  @Field(() => ID) id!: string;
  @Field() accountCode!: string;
  @Field() accountName!: string;
  @Field(() => Int) debit!: number;
  @Field(() => Int) credit!: number;
  @Field() description!: string;
  @Field() referenceType!: string;
  @Field() referenceId!: string;
  @Field() postedAt!: Date;
}

// ── Chart of Accounts ─────────────────────────────────────────────────────────

@ObjectType()
export class ChartOfAccountsEntry {
  @Field() accountCode!: string;
  @Field() accountName!: string;
  @Field() accountType!: string; // ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
  @Field() category!: string;    // Current Assets, Fixed Assets, etc.
  @Field(() => Int) balancePesewas!: number;
  @Field() balanceFormatted!: string;
}

// ── Financial Summary (for dashboard) ─────────────────────────────────────────

@ObjectType()
export class FinancialSummaryOutput {
  @Field() periodStart!: string;
  @Field() periodEnd!: string;

  // Revenue
  @Field(() => Int) revenuePesewas!: number;
  @Field() revenueFormatted!: string;

  // COGS
  @Field(() => Int) cogsPesewas!: number;
  @Field() cogsFormatted!: string;

  // Gross Profit
  @Field(() => Int) grossProfitPesewas!: number;
  @Field() grossProfitFormatted!: string;
  @Field() grossMarginPct!: number;

  // Operating Expenses
  @Field(() => Int) operatingExpensesPesewas!: number;
  @Field() operatingExpensesFormatted!: string;

  // Net Profit
  @Field(() => Int) netProfitPesewas!: number;
  @Field() netProfitFormatted!: string;
  @Field() netMarginPct!: number;

  // Cash Position
  @Field(() => Int) cashBalancePesewas!: number;
  @Field() cashBalanceFormatted!: string;

  // Payables
  @Field(() => Int) accountsPayablePesewas!: number;
  @Field() accountsPayableFormatted!: string;

  // VAT
  @Field(() => Int) vatPayablePesewas!: number;
  @Field() vatPayableFormatted!: string;

  // Inventory
  @Field(() => Int) inventoryValuePesewas!: number;
  @Field() inventoryValueFormatted!: string;

  // Transactions
  @Field(() => Int) totalTransactions!: number;
  @Field(() => Int) totalExpenses!: number;
  @Field(() => Int) pendingExpenses!: number;
}
