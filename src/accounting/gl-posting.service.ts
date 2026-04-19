import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Centralized General Ledger posting service.
 * All financial transactions flow through here for double-entry bookkeeping.
 *
 * Chart of Accounts (Ghana Pharmacy):
 * ─────────────────────────────────────
 * ASSETS (1xxx)
 *   1000  Cash & Bank
 *   1100  Accounts Receivable
 *   1200  Inventory (Pharmaceutical Stock)
 *   1300  Prepaid Expenses
 *
 * LIABILITIES (2xxx)
 *   2100  Accounts Payable (Supplier Balances)
 *   2200  VAT Payable (Ghana GRA — 15%)
 *   2300  NHIL Payable (2.5%)
 *   2400  Accrued Expenses
 *   2500  Withholding Tax Payable
 *
 * EQUITY (3xxx)
 *   3000  Owner's Capital
 *   3100  Retained Earnings
 *
 * REVENUE (4xxx)
 *   4000  Sales Revenue — Pharmaceutical
 *   4100  Sales Revenue — OTC / Chemical
 *   4200  Other Income
 *
 * COGS (5000–5099)
 *   5000  Cost of Goods Sold
 *   5010  Inventory Shrinkage
 *   5020  Expired Stock Write-off
 *
 * OPERATING EXPENSES (5100–5999)
 *   5100  Utilities
 *   5200  Rent
 *   5300  Salaries & Wages
 *   5400  Fuel & Transport
 *   5500  Maintenance & Repairs
 *   5600  Marketing & Advertising
 *   5700  Licenses & Permits (FDA, GMDC, GRA)
 *   5800  Bank Charges & MoMo Fees
 *   5900  Miscellaneous / Office Supplies
 *   5050  Taxes & Levies
 */
@Injectable()
export class GLPostingService {
  private readonly logger = new Logger(GLPostingService.name);

  constructor(private readonly dataSource: DataSource) {}

  // ── Core GL posting ───────────────────────────────────────────────────────

  /**
   * Post a single GL entry (one side of a double-entry).
   */
  async postEntry(entry: GLEntry): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO general_ledger (
        id, branch_id, account_code, account_name, debit, credit,
        description, reference_type, reference_id, posted_at
      ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        entry.branchId,
        entry.accountCode,
        entry.accountName,
        entry.debit,
        entry.credit,
        entry.description,
        entry.referenceType,
        entry.referenceId,
      ],
    );
  }

  /**
   * Post a balanced double-entry (debit + credit must match).
   */
  async postDoubleEntry(entries: GLEntry[]): Promise<void> {
    let totalDebit = 0;
    let totalCredit = 0;
    for (const e of entries) {
      totalDebit += e.debit;
      totalCredit += e.credit;
    }
    if (Math.abs(totalDebit - totalCredit) > 1) {
      this.logger.error(
        'GL imbalance: debit=' + totalDebit + ' credit=' + totalCredit +
        ' ref=' + entries[0]?.referenceType + '/' + entries[0]?.referenceId,
      );
      return; // Don't post unbalanced entries
    }

    for (const entry of entries) {
      await this.postEntry(entry);
    }
  }

  // ── Sale completed ────────────────────────────────────────────────────────

  /**
   * Post GL entries when a sale is completed:
   *   Debit  1000 Cash          (total including VAT)
   *   Credit 4000 Sales Revenue (subtotal excl. VAT)
   *   Credit 2200 VAT Payable   (VAT amount)
   *   Debit  5000 COGS          (cost of goods)
   *   Credit 1200 Inventory     (cost of goods)
   */
  async postSaleCompleted(params: {
    branchId: string;
    saleId: string;
    subtotalPesewas: number;
    vatPesewas: number;
    totalPesewas: number;
    cogsPesewas: number;
  }): Promise<void> {
    try {
      const entries: GLEntry[] = [];
      const desc = 'Sale ' + params.saleId.substring(0, 8);

      // Revenue recognition
      entries.push({
        branchId: params.branchId,
        accountCode: '1000', accountName: 'Cash & Bank',
        debit: params.totalPesewas, credit: 0,
        description: desc, referenceType: 'SALE', referenceId: params.saleId,
      });
      entries.push({
        branchId: params.branchId,
        accountCode: '4000', accountName: 'Sales Revenue',
        debit: 0, credit: params.subtotalPesewas,
        description: desc, referenceType: 'SALE', referenceId: params.saleId,
      });

      if (params.vatPesewas > 0) {
        entries.push({
          branchId: params.branchId,
          accountCode: '2200', accountName: 'VAT Payable',
          debit: 0, credit: params.vatPesewas,
          description: desc + ' — VAT 15%', referenceType: 'SALE', referenceId: params.saleId,
        });
      }

      // COGS recognition (if we have cost data)
      if (params.cogsPesewas > 0) {
        entries.push({
          branchId: params.branchId,
          accountCode: '5000', accountName: 'Cost of Goods Sold',
          debit: params.cogsPesewas, credit: 0,
          description: desc + ' — COGS', referenceType: 'SALE', referenceId: params.saleId,
        });
        entries.push({
          branchId: params.branchId,
          accountCode: '1200', accountName: 'Inventory',
          debit: 0, credit: params.cogsPesewas,
          description: desc + ' — COGS', referenceType: 'SALE', referenceId: params.saleId,
        });
      }

      await this.postDoubleEntry(entries);
      this.logger.log('GL posted: SALE ' + params.saleId.substring(0, 8) +
        ' revenue=' + params.subtotalPesewas + ' vat=' + params.vatPesewas + ' cogs=' + params.cogsPesewas);
    } catch (err) {
      this.logger.warn('GL posting failed for sale ' + params.saleId + ': ' + err);
    }
  }

  // ── Sale refunded ─────────────────────────────────────────────────────────

  /**
   * Reverse GL entries when a sale is refunded.
   * Mirror image of postSaleCompleted.
   */
  async postSaleRefunded(params: {
    branchId: string;
    saleId: string;
    subtotalPesewas: number;
    vatPesewas: number;
    totalPesewas: number;
    cogsPesewas: number;
  }): Promise<void> {
    try {
      const entries: GLEntry[] = [];
      const desc = 'Refund — Sale ' + params.saleId.substring(0, 8);

      // Reverse revenue
      entries.push({
        branchId: params.branchId,
        accountCode: '1000', accountName: 'Cash & Bank',
        debit: 0, credit: params.totalPesewas,
        description: desc, referenceType: 'REFUND', referenceId: params.saleId,
      });
      entries.push({
        branchId: params.branchId,
        accountCode: '4000', accountName: 'Sales Revenue',
        debit: params.subtotalPesewas, credit: 0,
        description: desc, referenceType: 'REFUND', referenceId: params.saleId,
      });

      if (params.vatPesewas > 0) {
        entries.push({
          branchId: params.branchId,
          accountCode: '2200', accountName: 'VAT Payable',
          debit: params.vatPesewas, credit: 0,
          description: desc + ' — VAT reversal', referenceType: 'REFUND', referenceId: params.saleId,
        });
      }

      // Reverse COGS
      if (params.cogsPesewas > 0) {
        entries.push({
          branchId: params.branchId,
          accountCode: '5000', accountName: 'Cost of Goods Sold',
          debit: 0, credit: params.cogsPesewas,
          description: desc + ' — COGS reversal', referenceType: 'REFUND', referenceId: params.saleId,
        });
        entries.push({
          branchId: params.branchId,
          accountCode: '1200', accountName: 'Inventory',
          debit: params.cogsPesewas, credit: 0,
          description: desc + ' — COGS reversal', referenceType: 'REFUND', referenceId: params.saleId,
        });
      }

      await this.postDoubleEntry(entries);
      this.logger.log('GL posted: REFUND ' + params.saleId.substring(0, 8));
    } catch (err) {
      this.logger.warn('GL posting failed for refund ' + params.saleId + ': ' + err);
    }
  }

  // ── Stock received ────────────────────────────────────────────────────────

  /**
   * Post GL when stock is received from supplier:
   *   Debit  1200 Inventory
   *   Credit 2100 Accounts Payable
   */
  async postStockReceived(params: {
    branchId: string;
    productId: string;
    productName: string;
    quantity: number;
    costPesewas: number;
    referenceId?: string;
  }): Promise<void> {
    if (params.costPesewas <= 0) return; // No cost data, skip

    try {
      const totalCost = params.costPesewas * params.quantity;
      const desc = 'Stock received: ' + params.productName + ' x' + params.quantity;
      const refId = params.referenceId || params.productId;

      await this.postDoubleEntry([
        {
          branchId: params.branchId,
          accountCode: '1200', accountName: 'Inventory',
          debit: totalCost, credit: 0,
          description: desc, referenceType: 'STOCK_RECEIVED', referenceId: refId,
        },
        {
          branchId: params.branchId,
          accountCode: '2100', accountName: 'Accounts Payable',
          debit: 0, credit: totalCost,
          description: desc, referenceType: 'STOCK_RECEIVED', referenceId: refId,
        },
      ]);
      this.logger.log('GL posted: STOCK_RECEIVED ' + params.productName + ' cost=' + totalCost);
    } catch (err) {
      this.logger.warn('GL posting failed for stock received: ' + err);
    }
  }

  // ── Stock adjustment ──────────────────────────────────────────────────────

  /**
   * Post GL for stock adjustments (write-offs, shrinkage, corrections):
   *   Debit  5010 Inventory Shrinkage (or 5020 Expired Write-off)
   *   Credit 1200 Inventory
   */
  async postStockAdjustment(params: {
    branchId: string;
    productName: string;
    quantity: number;
    costPesewas: number;
    reason: string;
    referenceId: string;
  }): Promise<void> {
    if (params.costPesewas <= 0 || params.quantity >= 0) return; // Only post for negative adjustments

    try {
      const totalCost = Math.abs(params.quantity) * params.costPesewas;
      const isExpiry = params.reason.toLowerCase().includes('expir');
      const accountCode = isExpiry ? '5020' : '5010';
      const accountName = isExpiry ? 'Expired Stock Write-off' : 'Inventory Shrinkage';
      const desc = 'Stock adjustment: ' + params.productName + ' (' + params.reason + ')';

      await this.postDoubleEntry([
        {
          branchId: params.branchId,
          accountCode, accountName,
          debit: totalCost, credit: 0,
          description: desc, referenceType: 'STOCK_ADJUSTMENT', referenceId: params.referenceId,
        },
        {
          branchId: params.branchId,
          accountCode: '1200', accountName: 'Inventory',
          debit: 0, credit: totalCost,
          description: desc, referenceType: 'STOCK_ADJUSTMENT', referenceId: params.referenceId,
        },
      ]);
      this.logger.log('GL posted: STOCK_ADJUSTMENT ' + params.productName + ' cost=' + totalCost);
    } catch (err) {
      this.logger.warn('GL posting failed for stock adjustment: ' + err);
    }
  }

  // ── Trial Balance ─────────────────────────────────────────────────────────

  /**
   * Generate trial balance from GL — all account balances.
   */
  async getTrialBalance(branchId: string, asOfDate?: string): Promise<TrialBalanceRow[]> {
    const dateFilter = asOfDate
      ? " AND posted_at <= '" + asOfDate + "'::date + INTERVAL '1 day'"
      : '';

    const rows = await this.dataSource.query(
      `SELECT
        account_code,
        account_name,
        COALESCE(SUM(debit), 0)::int AS total_debit,
        COALESCE(SUM(credit), 0)::int AS total_credit,
        (COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0))::int AS balance
      FROM general_ledger
      WHERE branch_id = $1` + dateFilter + `
      GROUP BY account_code, account_name
      ORDER BY account_code`,
      [branchId],
    );

    return rows.map((r: any) => ({
      accountCode: r.account_code,
      accountName: r.account_name,
      totalDebit: parseInt(r.total_debit),
      totalCredit: parseInt(r.total_credit),
      balance: parseInt(r.balance),
      balanceFormatted: this.fmt(Math.abs(parseInt(r.balance))),
      balanceType: parseInt(r.balance) >= 0 ? 'DEBIT' : 'CREDIT',
    }));
  }

  // ── Balance Sheet ─────────────────────────────────────────────────────────

  /**
   * Generate balance sheet from GL.
   * Assets = Liabilities + Equity (must balance)
   */
  async getBalanceSheet(branchId: string, asOfDate?: string): Promise<BalanceSheet> {
    const trial = await this.getTrialBalance(branchId, asOfDate);

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalRevenue = 0;
    let totalExpenses = 0;

    const assets: BalanceSheetLine[] = [];
    const liabilities: BalanceSheetLine[] = [];
    const equity: BalanceSheetLine[] = [];

    for (const row of trial) {
      const code = row.accountCode;
      const line: BalanceSheetLine = {
        accountCode: code,
        accountName: row.accountName,
        balancePesewas: Math.abs(row.balance),
        balanceFormatted: row.balanceFormatted,
      };

      if (code.startsWith('1')) {
        // Assets — debit balance is positive
        assets.push(line);
        totalAssets += row.balance;
      } else if (code.startsWith('2')) {
        // Liabilities — credit balance is positive
        liabilities.push(line);
        totalLiabilities += Math.abs(row.balance);
      } else if (code.startsWith('3')) {
        // Equity
        equity.push(line);
        totalEquity += Math.abs(row.balance);
      } else if (code.startsWith('4')) {
        // Revenue (credit balance)
        totalRevenue += Math.abs(row.balance);
      } else if (code.startsWith('5')) {
        // Expenses (debit balance)
        totalExpenses += row.balance;
      }
    }

    // Retained earnings = Revenue - Expenses (current period)
    const retainedEarnings = totalRevenue - totalExpenses;
    if (retainedEarnings !== 0) {
      equity.push({
        accountCode: '3100',
        accountName: 'Retained Earnings (Current Period)',
        balancePesewas: Math.abs(retainedEarnings),
        balanceFormatted: this.fmt(Math.abs(retainedEarnings)),
      });
      totalEquity += retainedEarnings;
    }

    const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) <= 1;

    return {
      asOfDate: asOfDate || new Date().toISOString().split('T')[0],
      assets,
      totalAssetsPesewas: totalAssets,
      totalAssetsFormatted: this.fmt(totalAssets),
      liabilities,
      totalLiabilitiesPesewas: totalLiabilities,
      totalLiabilitiesFormatted: this.fmt(totalLiabilities),
      equity,
      totalEquityPesewas: totalEquity,
      totalEquityFormatted: this.fmt(totalEquity),
      isBalanced,
    };
  }

  // ── GL Ledger Detail ──────────────────────────────────────────────────────

  /**
   * Get GL transaction detail for a specific account or all accounts.
   */
  async getGLDetail(branchId: string, accountCode?: string, startDate?: string, endDate?: string): Promise<GLDetailRow[]> {
    const conditions = ['branch_id = $1'];
    const params: any[] = [branchId];
    let idx = 2;

    if (accountCode) {
      conditions.push('account_code = $' + idx);
      params.push(accountCode);
      idx++;
    }
    if (startDate) {
      conditions.push('posted_at >= $' + idx + '::date');
      params.push(startDate);
      idx++;
    }
    if (endDate) {
      conditions.push('posted_at < ($' + idx + '::date + INTERVAL \'1 day\')');
      params.push(endDate);
      idx++;
    }

    const rows = await this.dataSource.query(
      `SELECT id, account_code, account_name, debit, credit, description,
              reference_type, reference_id, posted_at
       FROM general_ledger
       WHERE ${conditions.join(' AND ')}
       ORDER BY posted_at DESC
       LIMIT 500`,
      params,
    );

    return rows.map((r: any) => ({
      id: r.id,
      accountCode: r.account_code,
      accountName: r.account_name,
      debit: parseInt(r.debit),
      credit: parseInt(r.credit),
      description: r.description,
      referenceType: r.reference_type,
      referenceId: r.reference_id,
      postedAt: r.posted_at,
    }));
  }

  private fmt(pesewas: number): string {
    return 'GH\u20B5' + (pesewas / 100).toFixed(2);
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GLEntry {
  branchId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
  referenceType: string;
  referenceId: string;
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
  balanceFormatted: string;
  balanceType: 'DEBIT' | 'CREDIT';
}

export interface BalanceSheetLine {
  accountCode: string;
  accountName: string;
  balancePesewas: number;
  balanceFormatted: string;
}

export interface BalanceSheet {
  asOfDate: string;
  assets: BalanceSheetLine[];
  totalAssetsPesewas: number;
  totalAssetsFormatted: string;
  liabilities: BalanceSheetLine[];
  totalLiabilitiesPesewas: number;
  totalLiabilitiesFormatted: string;
  equity: BalanceSheetLine[];
  totalEquityPesewas: number;
  totalEquityFormatted: string;
  isBalanced: boolean;
}

export interface GLDetailRow {
  id: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
  referenceType: string;
  referenceId: string;
  postedAt: Date;
}
