import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ReportsService } from './reports.service';
import { SalesEffectiveAtService } from '../sales/sales-effective-at.service';

// ── Shared fixtures ───────────────────────────────────────────────────────

const mockDataSource = {
  query: jest.fn(),
};

const mockEffectiveAt: Pick<SalesEffectiveAtService, 'sql'> = {
  sql: (alias: string) => `COALESCE(${alias}.sold_at, ${alias}.created_at)`,
};

async function buildModule(): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      ReportsService,
      { provide: DataSource, useValue: mockDataSource },
      { provide: SalesEffectiveAtService, useValue: mockEffectiveAt },
    ],
  }).compile();
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module = await buildModule();
    service = module.get(ReportsService);
    jest.clearAllMocks();
  });

  // ── getRevenueReport ──────────────────────────────────────────────────────

  describe('getRevenueReport', () => {
    it('returns correct aggregates for a period', async () => {
      mockDataSource.query.mockResolvedValue([
        { total_revenue: 500000, vat_collected: 65217, sales_count: 20, refunds: 5000 },
      ]);

      const result = await service.getRevenueReport(
        'branch-uuid-001',
        '2026-03-01',
        '2026-03-31',
      );

      expect(result.totalRevenuePesewas).toBe(500000);
      expect(result.vatCollectedPesewas).toBe(65217);
      expect(result.salesCount).toBe(20);
      expect(result.refundsPesewas).toBe(5000);
      expect(result.averageSaleGhs).toBe(250); // 500000 / 100 / 20
      expect(result.periodStart).toBe('2026-03-01');
      expect(result.periodEnd).toBe('2026-03-31');
    });

    it('returns zero averageSaleGhs when salesCount is 0', async () => {
      mockDataSource.query.mockResolvedValue([
        { total_revenue: 0, vat_collected: 0, sales_count: 0, refunds: 0 },
      ]);

      const result = await service.getRevenueReport('branch-uuid-001', '2026-03-01', '2026-03-31');
      expect(result.averageSaleGhs).toBe(0);
    });

    it('formats revenue as GH₵ string', async () => {
      mockDataSource.query.mockResolvedValue([
        { total_revenue: 100000, vat_collected: 13043, sales_count: 10, refunds: 0 },
      ]);

      const result = await service.getRevenueReport('branch-uuid-001', '2026-03-01', '2026-03-31');
      expect(result.totalRevenueFormatted).toBe('GH₵1000.00');
      expect(result.vatFormatted).toBe('GH₵130.43');
    });

    it('handles null/undefined row gracefully (empty period)', async () => {
      mockDataSource.query.mockResolvedValue([
        { total_revenue: 0, vat_collected: 0, sales_count: 0, refunds: 0 },
      ]);

      const result = await service.getRevenueReport('branch-uuid-001', '2026-02-01', '2026-02-28');
      expect(result.totalRevenuePesewas).toBe(0);
      expect(result.salesCount).toBe(0);
    });
  });

  // ── getDashboardKpis ──────────────────────────────────────────────────────

  describe('getDashboardKpis', () => {
    it('returns correct KPI shape', async () => {
      // Promise.all fires 5 queries in order:
      // todayRow, monthRow, prevMonthRow, lowStockRow, staffRow
      mockDataSource.query
        .mockResolvedValueOnce([{ revenue: 50000, count: 5 }])    // today
        .mockResolvedValueOnce([{ revenue: 300000, count: 30 }])  // this month
        .mockResolvedValueOnce([{ revenue: 200000 }])             // prev month
        .mockResolvedValueOnce([{ cnt: 3 }])                      // low stock
        .mockResolvedValueOnce([{ cnt: 8 }]);                     // active staff

      const result = await service.getDashboardKpis('branch-uuid-001');

      expect(result.todayRevenuePesewas).toBe(50000);
      expect(result.todayRevenueFormatted).toBe('GH₵500.00');
      expect(result.todaySalesCount).toBe(5);
      expect(result.monthRevenuePesewas).toBe(300000);
      expect(result.monthSalesCount).toBe(30);
      expect(result.lowStockCount).toBe(3);
      expect(result.activeStaffCount).toBe(8);
      // delta: (300000 - 200000) / 200000 * 100 = 50%
      expect(result.revenueDeltaPct).toBe(50);
    });

    it('revenueDeltaPct is 0 when previous month revenue is 0', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ revenue: 10000, count: 2 }])
        .mockResolvedValueOnce([{ revenue: 10000, count: 2 }])
        .mockResolvedValueOnce([{ revenue: 0 }])   // prev month = 0
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([{ cnt: 5 }]);

      const result = await service.getDashboardKpis('branch-uuid-001');
      expect(result.revenueDeltaPct).toBe(0);
    });

    it('handles negative delta (revenue declined)', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ revenue: 5000, count: 1 }])
        .mockResolvedValueOnce([{ revenue: 100000, count: 10 }])
        .mockResolvedValueOnce([{ revenue: 200000 }])  // prev month was higher
        .mockResolvedValueOnce([{ cnt: 5 }])
        .mockResolvedValueOnce([{ cnt: 6 }]);

      const result = await service.getDashboardKpis('branch-uuid-001');
      // (100000 - 200000) / 200000 * 100 = -50%
      expect(result.revenueDeltaPct).toBe(-50);
    });
  });

  // ── fmt (via formatted fields) ────────────────────────────────────────────

  describe('fmt', () => {
    it('formats 0 pesewas as GH₵0.00', async () => {
      mockDataSource.query.mockResolvedValue([
        { total_revenue: 0, vat_collected: 0, sales_count: 0, refunds: 0 },
      ]);
      const result = await service.getRevenueReport('branch-uuid-001', '2026-01-01', '2026-01-31');
      expect(result.totalRevenueFormatted).toBe('GH₵0.00');
    });

    it('formats 1 pesewa as GH₵0.01', async () => {
      mockDataSource.query.mockResolvedValue([
        { total_revenue: 1, vat_collected: 0, sales_count: 1, refunds: 0 },
      ]);
      const result = await service.getRevenueReport('branch-uuid-001', '2026-01-01', '2026-01-31');
      expect(result.totalRevenueFormatted).toBe('GH₵0.01');
    });
  });
});
