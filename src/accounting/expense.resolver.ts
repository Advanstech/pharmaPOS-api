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
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician', 'cashier', 'chemical_cashier')
  async createStaffExpense(
    @Args('input') input: CreateStaffExpenseInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<StaffExpenseOutput> {
    return this.expenseService.createExpense(input, actor.branchId, actor.sub, input.receiptS3Key);
  }

  // ── Get Expense ───────────────────────────────────────────────────────────

  @Query(() => StaffExpenseOutput, { name: 'staffExpense' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician', 'cashier', 'chemical_cashier')
  async getStaffExpense(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() _actor: JwtUser,
  ): Promise<StaffExpenseOutput> {
    return this.expenseService.getExpenseById(id);
  }

  // ── Get Expenses ──────────────────────────────────────────────────────────

  @Query(() => [StaffExpenseOutput], { name: 'staffExpenses' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician', 'cashier', 'chemical_cashier')
  async getStaffExpenses(
    @Args('status', { type: () => ExpenseStatus, nullable: true }) status: ExpenseStatus | undefined,
    @Args('startDate', { type: () => String, nullable: true }) startDate: string | undefined,
    @Args('endDate', { type: () => String, nullable: true }) endDate: string | undefined,
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
