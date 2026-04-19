import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CreateStaffExpenseInput,
  ApproveStaffExpenseInput,
  ReimburseExpenseInput,
  StaffExpenseOutput,
  ExpenseAnalyticsOutput,
  ExpenseCategoryBreakdown,
  ExpenseStaffBreakdown,
} from './dto/expense.types';

@Injectable()
export class ExpenseService {
  private readonly logger = new Logger(ExpenseService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Create staff expense claim
   */
  async createExpense(
    input: CreateStaffExpenseInput,
    branchId: string,
    userId: string,
    receiptS3Key?: string,
  ): Promise<StaffExpenseOutput> {
    const [expense] = await this.dataSource.query(
      `INSERT INTO staff_expenses (
        id, branch_id, category, amount_pesewas, description, merchant_name,
        expense_date, receipt_s3_key, payment_method, status, created_by
      )
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6::date, $7, $8, 'PENDING', $9)
      RETURNING id`,
      [
        branchId,
        input.category,
        input.amountPesewas,
        input.description,
        input.merchantName || null,
        input.expenseDate,
        receiptS3Key || null,
        input.paymentMethod,
        userId,
      ],
    );

    this.logger.log(`Expense created: ${expense.id} by user ${userId}`);

    return this.getExpenseById(expense.id);
  }

  /**
   * Get expense by ID
   */
  async getExpenseById(expenseId: string): Promise<StaffExpenseOutput> {
    const [expense] = await this.dataSource.query(
      `SELECT
        e.*,
        creator.name as created_by_name,
        approver.name as approved_by_name,
        reimburser.name as reimbursed_by_name
      FROM staff_expenses e
      JOIN users creator ON creator.id = e.created_by
      LEFT JOIN users approver ON approver.id = e.approved_by
      LEFT JOIN users reimburser ON reimburser.id = e.reimbursed_by
      WHERE e.id = $1`,
      [expenseId],
    );

    if (!expense) {
      throw new NotFoundException(`Expense ${expenseId} not found`);
    }

    return this.formatExpense(expense);
  }

  /**
   * Get expenses for a branch with filters
   */
  async getExpenses(
    branchId: string,
    status?: string,
    startDate?: string,
    endDate?: string,
    createdByFilter?: string,
  ): Promise<StaffExpenseOutput[]> {
    const conditions = ['e.branch_id = $1'];
    const params: any[] = [branchId];
    let idx = 2;

    if (status) {
      conditions.push('e.status = $' + idx);
      params.push(status);
      idx++;
    }

    if (startDate) {
      conditions.push('e.expense_date >= $' + idx + '::date');
      params.push(startDate);
      idx++;
    }

    if (endDate) {
      conditions.push('e.expense_date <= $' + idx + '::date');
      params.push(endDate);
      idx++;
    }

    // Non-managers only see their own expenses
    if (createdByFilter) {
      conditions.push('e.created_by = $' + idx);
      params.push(createdByFilter);
      idx++;
    }

    const query = `SELECT
      e.*,
      creator.name as created_by_name,
      approver.name as approved_by_name,
      reimburser.name as reimbursed_by_name
    FROM staff_expenses e
    JOIN users creator ON creator.id = e.created_by
    LEFT JOIN users approver ON approver.id = e.approved_by
    LEFT JOIN users reimburser ON reimburser.id = e.reimbursed_by
    WHERE ${conditions.join(' AND ')}
    ORDER BY e.expense_date DESC, e.created_at DESC`;

    const expenses = await this.dataSource.query(query, params);

    return expenses.map((e: any) => this.formatExpense(e));
  }

  /**
   * Approve or reject expense
   */
  async approveExpense(
    input: ApproveStaffExpenseInput,
    approverId: string,
    approverRole: string,
  ): Promise<StaffExpenseOutput> {
    // Only managers and owners can approve
    if (!['owner', 'se_admin', 'manager'].includes(approverRole)) {
      throw new ForbiddenException('Only managers and owners can approve expenses');
    }

    const newStatus = input.approve ? 'APPROVED' : 'REJECTED';

    await this.dataSource.query(
      `UPDATE staff_expenses
      SET
        status = $2,
        approved_by = $3,
        approved_at = NOW(),
        approval_notes = $4,
        reimbursement_method = $5,
        updated_at = NOW()
      WHERE id = $1 AND status = 'PENDING'`,
      [input.expenseId, newStatus, approverId, input.notes || null, input.reimbursementMethod || null],
    );

    this.logger.log(`Expense ${input.expenseId} ${newStatus} by ${approverId}`);

    // Post to general ledger when approved
    if (newStatus === 'APPROVED') {
      try {
        const rows = await this.dataSource.query(
          `SELECT branch_id, category, amount_pesewas, description FROM staff_expenses WHERE id = $1`,
          [input.expenseId],
        );
        const expense = rows[0];

        if (expense) {
          // Map category to GL account code
          const categoryAccounts: Record<string, { code: string; name: string }> = {
            FUEL: { code: '5400', name: 'Fuel Expense' },
            UTILITIES: { code: '5100', name: 'Utilities Expense' },
            SUPPLIES: { code: '5900', name: 'Office Supplies' },
            TRANSPORT: { code: '5400', name: 'Transport Expense' },
            MEALS: { code: '5900', name: 'Meals & Entertainment' },
            RENT: { code: '5200', name: 'Rent Expense' },
            SALARIES: { code: '5300', name: 'Salaries Expense' },
            MARKETING: { code: '5600', name: 'Marketing Expense' },
            TRAINING: { code: '5700', name: 'Training Expense' },
            MAINTENANCE: { code: '5500', name: 'Maintenance Expense' },
            INSURANCE: { code: '5800', name: 'Insurance Expense' },
            TAXES: { code: '5050', name: 'Taxes & Levies' },
            OTHER: { code: '5900', name: 'Miscellaneous Expense' },
          };
          const acct = categoryAccounts[expense.category] ?? categoryAccounts.OTHER;

          // Double-entry: Debit expense account, Credit cash
          await this.dataSource.query(
            `INSERT INTO general_ledger (id, branch_id, account_code, account_name, debit, credit, description, reference_type, reference_id, posted_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, 0, $5, 'EXPENSE', $6, NOW()),
                   (gen_random_uuid(), $1, '1000', 'Cash', 0, $4, $5, 'EXPENSE', $6, NOW())`,
            [expense.branch_id, acct.code, acct.name, expense.amount_pesewas, expense.description, input.expenseId],
          );

          this.logger.log(`GL posted for expense ${input.expenseId}: ${acct.code} debit ${expense.amount_pesewas}`);
        }
      } catch (glError) {
        this.logger.warn(`GL posting failed for expense ${input.expenseId}: ${glError}`);
        // Don't fail the approval if GL posting fails
      }
    }

    return this.getExpenseById(input.expenseId);
  }

  /**
   * Reimburse approved expense
   */
  async reimburseExpense(
    input: ReimburseExpenseInput,
    reimburserId: string,
    reimburserRole: string,
  ): Promise<StaffExpenseOutput> {
    // Only managers and owners can reimburse
    if (!['owner', 'se_admin', 'manager'].includes(reimburserRole)) {
      throw new ForbiddenException('Only managers and owners can reimburse expenses');
    }

    await this.dataSource.query(
      `UPDATE staff_expenses
      SET
        status = 'REIMBURSED',
        reimbursement_method = $2,
        reimbursed_by = $3,
        reimbursed_at = NOW(),
        reimbursement_reference = $4,
        updated_at = NOW()
      WHERE id = $1 AND status = 'APPROVED'`,
      [input.expenseId, input.reimbursementMethod, reimburserId, input.reference || null],
    );

    this.logger.log(`Expense ${input.expenseId} reimbursed by ${reimburserId}`);

    return this.getExpenseById(input.expenseId);
  }

  /**
   * Get expense analytics for a period
   */
  async getExpenseAnalytics(
    branchId: string,
    startDate: string,
    endDate: string,
  ): Promise<ExpenseAnalyticsOutput> {
    // Total expenses
    const [totals] = await this.dataSource.query(
      `SELECT
        COALESCE(SUM(amount_pesewas), 0) as total_pesewas,
        COUNT(*) as total_count
      FROM staff_expenses
      WHERE branch_id = $1
        AND expense_date >= $2::date
        AND expense_date <= $3::date
        AND status != 'REJECTED'`,
      [branchId, startDate, endDate],
    );

    // By category
    const byCategory = await this.dataSource.query(
      `SELECT
        category,
        SUM(amount_pesewas) as amount_pesewas,
        COUNT(*) as count
      FROM staff_expenses
      WHERE branch_id = $1
        AND expense_date >= $2::date
        AND expense_date <= $3::date
        AND status != 'REJECTED'
      GROUP BY category
      ORDER BY amount_pesewas DESC`,
      [branchId, startDate, endDate],
    );

    // By staff
    const byStaff = await this.dataSource.query(
      `SELECT
        e.created_by as staff_id,
        u.name as staff_name,
        SUM(e.amount_pesewas) as amount_pesewas,
        COUNT(*) as count
      FROM staff_expenses e
      JOIN users u ON u.id = e.created_by
      WHERE e.branch_id = $1
        AND e.expense_date >= $2::date
        AND e.expense_date <= $3::date
        AND e.status != 'REJECTED'
      GROUP BY e.created_by, u.name
      ORDER BY amount_pesewas DESC`,
      [branchId, startDate, endDate],
    );

    // Pending approval count
    const [pending] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM staff_expenses WHERE branch_id = $1 AND status = 'PENDING'`,
      [branchId],
    );

    // Pending reimbursement
    const [pendingReimbursement] = await this.dataSource.query(
      `SELECT COALESCE(SUM(amount_pesewas), 0) as amount FROM staff_expenses WHERE branch_id = $1 AND status = 'APPROVED'`,
      [branchId],
    );

    const totalPesewas = parseInt(totals.total_pesewas);

    return {
      totalExpensesPesewas: totalPesewas,
      totalExpensesFormatted: this.formatCurrency(totalPesewas),
      byCategory: byCategory.map((c: any) => ({
        category: c.category,
        amountPesewas: parseInt(c.amount_pesewas),
        amountFormatted: this.formatCurrency(parseInt(c.amount_pesewas)),
        count: parseInt(c.count),
        percentOfTotal: totalPesewas > 0 ? (parseInt(c.amount_pesewas) / totalPesewas) * 100 : 0,
      })),
      byStaff: byStaff.map((s: any) => ({
        staffId: s.staff_id,
        staffName: s.staff_name,
        amountPesewas: parseInt(s.amount_pesewas),
        amountFormatted: this.formatCurrency(parseInt(s.amount_pesewas)),
        count: parseInt(s.count),
      })),
      pendingApprovalCount: parseInt(pending.count),
      pendingReimbursementPesewas: parseInt(pendingReimbursement.amount),
      pendingReimbursementFormatted: this.formatCurrency(parseInt(pendingReimbursement.amount)),
    };
  }

  /**
   * Format expense for output
   */
  private formatExpense(expense: any): StaffExpenseOutput {
    return {
      id: expense.id,
      category: expense.category,
      amountPesewas: parseInt(expense.amount_pesewas),
      amountFormatted: this.formatCurrency(parseInt(expense.amount_pesewas)),
      description: expense.description,
      merchantName: expense.merchant_name,
      expenseDate: expense.expense_date,
      receiptUrl: expense.receipt_s3_key
        ? 'https://' + (process.env.AWS_S3_BUCKET || 'receipts') + '.s3.amazonaws.com/' + expense.receipt_s3_key
        : undefined,
      ocrExtractedAmount: expense.ocr_extracted_amount ? parseInt(expense.ocr_extracted_amount) : undefined,
      paymentMethod: expense.payment_method,
      status: expense.status,
      approvedByName: expense.approved_by_name,
      approvedAt: expense.approved_at,
      approvalNotes: expense.approval_notes,
      reimbursementMethod: expense.reimbursement_method,
      reimbursedByName: expense.reimbursed_by_name,
      reimbursedAt: expense.reimbursed_at,
      reimbursementReference: expense.reimbursement_reference,
      createdByName: expense.created_by_name,
      createdAt: expense.created_at,
    };
  }

  /**
   * Format currency (pesewas to GHS)
   */
  private formatCurrency(pesewas: number): string {
    return 'GH\u20B5' + (pesewas / 100).toFixed(2);
  }
}
