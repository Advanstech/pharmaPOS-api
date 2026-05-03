import { ObjectType, Field, ID, Int, InputType } from '@nestjs/graphql';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

@InputType()
export class CloseRegisterInput {
  @Field({ description: 'Business date YYYY-MM-DD (Accra calendar day)' })
  @IsDateString()
  businessDate!: string;

  @Field(() => Int, { description: 'Cash physically counted in pesewas' })
  @IsInt()
  @Min(0)
  cashCountedPesewas!: number;

  @Field(() => Int, { description: 'MoMo received in pesewas' })
  @IsInt()
  @Min(0)
  momoCountedPesewas!: number;

  @Field({ nullable: true, description: 'Closing notes from cashier' })
  @IsOptional()
  @IsString()
  closingNotes?: string;

  @Field({ nullable: true, description: 'Required explanation when counted total is less than system expected' })
  @IsOptional()
  @IsString()
  discrepancyReason?: string;
}

@ObjectType()
export class EodRecordOutput {
  @Field(() => ID) id!: string;
  @Field() branchId!: string;
  @Field() branchName!: string;
  @Field() cashierName!: string;
  @Field() businessDate!: string;

  @Field(() => Int) totalSalesCount!: number;
  @Field(() => Int) grossRevenuePesewas!: number;
  @Field() grossRevenueFormatted!: string;
  @Field(() => Int) vatCollectedPesewas!: number;
  @Field() vatCollectedFormatted!: string;
  @Field(() => Int) refundsCount!: number;
  @Field(() => Int) refundsPesewas!: number;
  @Field() refundsFormatted!: string;
  @Field(() => Int) expensesCount!: number;
  @Field(() => Int) expensesPesewas!: number;
  @Field() expensesFormatted!: string;
  @Field(() => Int) netRevenuePesewas!: number;
  @Field() netRevenueFormatted!: string;

  @Field(() => Int) expectedCashPesewas!: number;
  @Field() expectedCashFormatted!: string;
  @Field(() => Int, { defaultValue: 0 }) expectedMomoPesewas!: number;
  @Field({ defaultValue: 'GH₵0.00' }) expectedMomoFormatted!: string;
  @Field(() => Int) cashCountedPesewas!: number;
  @Field() cashCountedFormatted!: string;
  @Field(() => Int) momoCountedPesewas!: number;
  @Field() momoCountedFormatted!: string;
  @Field(() => Int) totalCountedPesewas!: number;
  @Field() totalCountedFormatted!: string;
  @Field(() => Int) variancePesewas!: number;
  @Field() varianceFormatted!: string;
  @Field() isBalanced!: boolean;

  @Field({ nullable: true }) closingNotes?: string;
  @Field({ nullable: true }) discrepancyReason?: string;
  @Field() closedAt!: Date;

  @Field({ description: 'PENDING | APPROVED | DECLINED' }) approvalStatus!: string;
  @Field({ nullable: true }) approvedByName?: string;
  @Field({ nullable: true }) approvedAt?: Date;
  @Field({ nullable: true }) managerNotes?: string;
}

@ObjectType()
export class EodPreviewOutput {
  @Field(() => Int) salesCount!: number;
  @Field(() => Int) grossRevenuePesewas!: number;
  @Field() grossRevenueFormatted!: string;
  @Field(() => Int) vatCollectedPesewas!: number;
  @Field() vatCollectedFormatted!: string;
  @Field(() => Int) refundsCount!: number;
  @Field(() => Int) refundsPesewas!: number;
  @Field() refundsFormatted!: string;
  @Field(() => Int) expensesCount!: number;
  @Field(() => Int) expensesPesewas!: number;
  @Field() expensesFormatted!: string;
  @Field(() => Int) netRevenuePesewas!: number;
  @Field() netRevenueFormatted!: string;
  @Field(() => Int) expectedCashPesewas!: number;
  @Field() expectedCashFormatted!: string;
  @Field(() => Int) expectedMomoPesewas!: number;
  @Field() expectedMomoFormatted!: string;
  @Field({ description: 'Source scope for preview totals: CASHIER or BRANCH_FALLBACK' })
  sourceScope!: string;
  @Field() isClosed!: boolean;
}

@InputType()
export class ApproveEodInput {
  @Field() eodId!: string;
  @Field({ nullable: true }) managerNotes?: string;
}

@ObjectType()
export class TodayEodStatus {
  @Field() isClosed!: boolean;
  @Field(() => EodRecordOutput, { nullable: true }) record?: EodRecordOutput;
}
