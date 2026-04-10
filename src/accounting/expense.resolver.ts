import { Resolver, Mutation, Query, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { ExpenseService } from './expense.service';
import {
  CreateStaffExpenseInput,
  ApproveStaffExpenseInput,
  ReimburseExpenseInput,
  StaffExpenseOutput,
  ExpenseAnalyticsOutput,
  ExpenseStatus,
} from './dto/expense.types';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpenseResolver {
  constructor(private readonly expenseService: ExpenseService) {}

  // ── Create Expense ────────────────────────────────────────────────────────

  @Mutation(() => StaffExpenseOutput, { name: 'createStaffExpense' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'technician', 'cashier')
  async createStaffExpense(
    @Args('input') input: CreateStaffExpenseInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<StaffExpenseOutput> {
    let receiptS3Key: string | undefined;

    // Handle receipt upload if provided
    if (input.receiptImage) {
      const file = await input.receiptImage;
      const { createReadStream, filename } = file;

      // Generate S3 key
      const timestamp = Date.now();
      receiptS3Key = `expenses/${actor.branchId}/${timestamp}-${filename}`;

      // Upload to S3 (simplified - in production use proper S3 service)
      const stream = createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // Upload using S3 client
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      });

      const bucket = process.env.AWS_S3_BUCKET || 'pharmapos-images';
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: receiptS3Key,
          Body: buffer,
          ContentType: file.mimetype,
        }),
      );
    }

    return this.expenseService.createExpense(input, actor.branchId, actor.sub, receiptS3Key);
  }

  // ── Get Expense ───────────────────────────────────────────────────────────

  @Query(() => StaffExpenseOutput, { name: 'staffExpense' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'technician', 'cashier')
  async getStaffExpense(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() _actor: JwtUser,
  ): Promise<StaffExpenseOutput> {
    return this.expenseService.getExpenseById(id);
  }

  // ── Get Expenses ──────────────────────────────────────────────────────────

  @Query(() => [StaffExpenseOutput], { name: 'staffExpenses' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'technician', 'cashier')
  async getStaffExpenses(
    @Args('status', { type: () => ExpenseStatus, nullable: true }) status: ExpenseStatus | undefined,
    @Args('startDate', { nullable: true }) startDate: string | undefined,
    @Args('endDate', { nullable: true }) endDate: string | undefined,
    @CurrentUser() actor: JwtUser,
  ): Promise<StaffExpenseOutput[]> {
    return this.expenseService.getExpenses(actor.branchId, status, startDate, endDate);
  }

  // ── Approve Expense ───────────────────────────────────────────────────────

  @Mutation(() => StaffExpenseOutput, { name: 'approveStaffExpense' })
  @Roles('owner', 'se_admin', 'manager')
  async approveStaffExpense(
    @Args('input') input: ApproveStaffExpenseInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<StaffExpenseOutput> {
    return this.expenseService.approveExpense(input, actor.sub, actor.role);
  }

  // ── Reimburse Expense ─────────────────────────────────────────────────────

  @Mutation(() => StaffExpenseOutput, { name: 'reimburseStaffExpense' })
  @Roles('owner', 'se_admin', 'manager')
  async reimburseStaffExpense(
    @Args('input') input: ReimburseExpenseInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<StaffExpenseOutput> {
    return this.expenseService.reimburseExpense(input, actor.sub, actor.role);
  }

  // ── Expense Analytics ─────────────────────────────────────────────────────

  @Query(() => ExpenseAnalyticsOutput, { name: 'expenseAnalytics' })
  @Roles('owner', 'se_admin', 'manager')
  async getExpenseAnalytics(
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
    @CurrentUser() actor: JwtUser,
  ): Promise<ExpenseAnalyticsOutput> {
    return this.expenseService.getExpenseAnalytics(actor.branchId, startDate, endDate);
  }
}
