import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GraphQLError } from 'graphql';
import { SalesService } from './sales.service';
import { PaymentMethod } from './dto/sale.types';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { RealtimeStockService } from '../inventory/realtime-stock.service';
import { SalesEffectiveAtService } from './sales-effective-at.service';
import { PharmacyService } from '../pharmacy/pharmacy.service';
import { NotificationsService } from '../notifications/notifications.service';

// ── Shared fixtures ───────────────────────────────────────────────────────

const actor: JwtUser = {
  sub: 'cashier-uuid-001',
  role: 'cashier',
  branchId: 'branch-uuid-001',
  branchType: 'pharmaceutical',
  sessionId: 'session-uuid-001',
};

const otcProduct = {
  id: 'prod-otc-001',
  name: 'Paracetamol 500mg',
  unit_price: 500,       // GH₵5.00 in pesewas
  classification: 'OTC',
  requires_rx: false,
  vat_exempt: false,
  supplier_id: 'supplier-uuid-001',
  quantity_on_hand: 100,
};

const pomProduct = {
  id: 'prod-pom-001',
  name: 'Amoxicillin 250mg',
  unit_price: 2000,
  classification: 'POM',
  requires_rx: true,
  vat_exempt: false,
  supplier_id: 'supplier-uuid-001',
  quantity_on_hand: 50,
};

const rxExemptProduct = {
  id: 'prod-rx-001',
  name: 'Insulin 10ml',
  unit_price: 10000,
  classification: 'POM',
  requires_rx: true,
  vat_exempt: true,
  supplier_id: 'supplier-uuid-001',
  quantity_on_hand: 20,
};

const mockSaleRow = {
  id: 'sale-uuid-001',
  branch_id: 'branch-uuid-001',
  cashier_id: 'cashier-uuid-001',
  total_amount: 575,
  vat_amount: 75,
  status: 'COMPLETED',
  idempotency_key: 'idem-key-001',
  sold_at: null as Date | null,
  created_at: new Date('2026-03-22'),
  branch_name: 'Main Branch',
  cashier_name: 'Kwame Cashier',
};

const mockSaleItemRow = {
  id: 'item-uuid-001',
  product_id: 'prod-otc-001',
  product_name: 'Paracetamol 500mg',
  classification: 'OTC',
  quantity: 1,
  unit_price: 500,
  vat_exempt: false,
  supplier_id: 'supplier-uuid-001',
  stock_after_sale: 99,
  reorder_level: 10,
  supplier_name: 'ADD Pharma Limited',
};

const mockDataSource = {
  query: jest.fn(),
  transaction: jest.fn(),
};

const mockEffectiveSaleAt: Pick<SalesEffectiveAtService, 'hasSoldAt' | 'sql'> = {
  hasSoldAt: true,
  sql: (alias: string) => `COALESCE(${alias}.sold_at, ${alias}.created_at)`,
};

const mockPharmacyService = {
  assertPrescriptionCoversProduct: jest.fn().mockResolvedValue(undefined),
};

async function buildModule(): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      SalesService,
      { provide: DataSource, useValue: mockDataSource },
      { provide: RealtimeStockService, useValue: { publishStockChanged: jest.fn() } },
      { provide: SalesEffectiveAtService, useValue: mockEffectiveSaleAt },
      { provide: PharmacyService, useValue: mockPharmacyService },
      { provide: NotificationsService, useValue: { sendEmail: jest.fn() } },
    ],
  }).compile();
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('SalesService', () => {
  let service: SalesService;

  beforeEach(async () => {
    mockDataSource.query.mockReset();
    mockDataSource.transaction.mockReset();
    const module = await buildModule();
    service = module.get(SalesService);
    jest.clearAllMocks();
    mockPharmacyService.assertPrescriptionCoversProduct.mockResolvedValue(undefined);
  });

  // ── createSale ────────────────────────────────────────────────────────────

  describe('createSale', () => {
    it('returns existing sale when idempotency key already used', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ id: 'sale-uuid-001' }]) // idempotency check
        .mockResolvedValueOnce([mockSaleRow])              // getSale
        .mockResolvedValueOnce([mockSaleItemRow]);         // getSale items

      const result = await service.createSale(
        {
          idempotencyKey: 'idem-key-001',
          items: [{ productId: 'prod-otc-001', quantity: 1 }],
          tenders: [{ method: PaymentMethod.CASH, amountPesewas: 600 }],
        },
        actor,
      );

      expect(result.id).toBe('sale-uuid-001');
      // Should NOT call transaction — just returned existing
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('throws FDA_POM_VIOLATION when POM product has no prescriptionId', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([])              // no existing idempotency
        .mockResolvedValueOnce([pomProduct]);   // product lookup

      await expect(
        service.createSale(
          {
            idempotencyKey: 'idem-key-002',
            items: [{ productId: 'prod-pom-001', quantity: 1 }],
            tenders: [{ method: PaymentMethod.CASH, amountPesewas: 2300 }],
          },
          actor,
        ),
      ).rejects.toThrow(GraphQLError);

      try {
        mockDataSource.query
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([pomProduct]);
        await service.createSale(
          {
            idempotencyKey: 'idem-key-002b',
            items: [{ productId: 'prod-pom-001', quantity: 1 }],
            tenders: [{ method: PaymentMethod.CASH, amountPesewas: 2300 }],
          },
          actor,
        );
      } catch (err) {
        expect((err as GraphQLError).extensions?.code).toBe('FDA_POM_VIOLATION');
      }
    });

    it('throws BadRequestException when stock is insufficient', async () => {
      const lowStockProduct = { ...otcProduct, quantity_on_hand: 2 };
      mockDataSource.query
        .mockResolvedValueOnce([])                  // no idempotency
        .mockResolvedValueOnce([lowStockProduct]);   // product lookup

      await expect(
        service.createSale(
          {
            idempotencyKey: 'idem-key-003',
            items: [{ productId: 'prod-otc-001', quantity: 10 }],
            tenders: [{ method: PaymentMethod.CASH, amountPesewas: 10000 }],
          },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when tender is less than total', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([])              // no idempotency
        .mockResolvedValueOnce([otcProduct]);   // product lookup

      // OTC 500 pesewas + 15% VAT = 575 pesewas; tender only 400
      await expect(
        service.createSale(
          {
            idempotencyKey: 'idem-key-004',
            items: [{ productId: 'prod-otc-001', quantity: 1 }],
            tenders: [{ method: PaymentMethod.CASH, amountPesewas: 400 }],
          },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('calculates VAT at 15% on non-exempt items', async () => {
      // 500 pesewas * 15% = 75 pesewas VAT → total 575
      mockDataSource.query
        .mockResolvedValueOnce([])              // no idempotency
        .mockResolvedValueOnce([otcProduct]);   // product lookup

      mockDataSource.transaction.mockImplementation(async (cb: (em: { query: jest.Mock }) => Promise<unknown>) => {
        const em = {
          query: jest
            .fn()
            .mockResolvedValueOnce([{ id: 'sale-uuid-new' }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ quantity_on_hand: 99, reorder_level: 10 }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]),
        };
        return cb(em) as Promise<{ saleId: string; stockChanges: unknown[] }>;
      });

      mockDataSource.query
        .mockResolvedValueOnce([mockSaleRow])
        .mockResolvedValueOnce([mockSaleItemRow]);

      const result = await service.createSale(
        {
          idempotencyKey: 'idem-key-005',
          items: [{ productId: 'prod-otc-001', quantity: 1 }],
          tenders: [{ method: PaymentMethod.CASH, amountPesewas: 600 }],
        },
        actor,
      );

      expect(result.vatPesewas).toBe(75);
    });

    it('applies zero VAT on vat_exempt (Rx) items', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([])                  // no idempotency
        .mockResolvedValueOnce([rxExemptProduct]);   // product lookup

      mockDataSource.transaction.mockImplementation(async (cb: (em: { query: jest.Mock }) => Promise<unknown>) => {
        const em = {
          query: jest
            .fn()
            .mockResolvedValueOnce([{ id: 'sale-uuid-rx' }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ quantity_on_hand: 19, reorder_level: 10 }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]),
        };
        return cb(em) as Promise<{ saleId: string; stockChanges: unknown[] }>;
      });

      const rxSaleRow = {
        ...mockSaleRow,
        id: 'sale-uuid-rx',
        vat_amount: 0,
        total_amount: 10000,
      };
      mockDataSource.query
        .mockResolvedValueOnce([rxSaleRow])
        .mockResolvedValueOnce([]);

      const result = await service.createSale(
        {
          idempotencyKey: 'idem-key-006',
          items: [{ productId: 'prod-rx-001', quantity: 1, prescriptionId: 'rx-uuid-001' }],
          tenders: [{ method: PaymentMethod.CASH, amountPesewas: 10000 }],
        },
        actor,
      );

      expect(result.vatPesewas).toBe(0);
    });

    it('throws NotFoundException when product not found', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([])   // no idempotency
        .mockResolvedValueOnce([]);  // empty product list

      await expect(
        service.createSale(
          {
            idempotencyKey: 'idem-key-007',
            items: [{ productId: 'nonexistent-prod', quantity: 1 }],
            tenders: [{ method: PaymentMethod.CASH, amountPesewas: 1000 }],
          },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getDailySummary ───────────────────────────────────────────────────────

  describe('getDailySummary', () => {
    it('returns correct aggregates for a given date', async () => {
      mockDataSource.query.mockResolvedValueOnce([
        { sales_count: 5, total_revenue: 25000, vat_collected: 3261 },
      ]);
      mockDataSource.query.mockResolvedValueOnce([{ organization_id: 'org-001' }]);

      const result = await service.getDailySummary(actor, '2026-03-22');

      expect(result.salesCount).toBe(5);
      expect(result.totalRevenuePesewas).toBe(25000);
      expect(result.vatCollectedPesewas).toBe(3261);
      expect(result.averageSaleGhs).toBe(50); // 25000 pesewas / 100 / 5 = GH₵50
    });

    it('returns zero averageSaleGhs when salesCount is 0', async () => {
      mockDataSource.query.mockResolvedValueOnce([
        { sales_count: 0, total_revenue: 0, vat_collected: 0 },
      ]);
      mockDataSource.query.mockResolvedValueOnce([{ organization_id: 'org-001' }]);

      const result = await service.getDailySummary(actor);
      expect(result.averageSaleGhs).toBe(0);
    });

    it('uses today when no date is provided', async () => {
      mockDataSource.query.mockResolvedValueOnce([
        { sales_count: 2, total_revenue: 10000, vat_collected: 1304 },
      ]);
      mockDataSource.query.mockResolvedValueOnce([{ organization_id: 'org-001' }]);

      const result = await service.getDailySummary(actor);
      expect(result.salesCount).toBe(2);
    });
  });

  // ── getSale (visibility) ─────────────────────────────────────────────────

  describe('getSale', () => {
    it('allows manager to view another cashiers sale', async () => {
      const otherSale = { ...mockSaleRow, cashier_id: 'other-cashier' };
      mockDataSource.query
        .mockResolvedValueOnce([otherSale])
        .mockResolvedValueOnce([mockSaleItemRow]);
      const manager: JwtUser = { ...actor, role: 'manager', sub: 'manager-001' };
      const result = await service.getSale('sale-uuid-001', manager);
      expect(result.id).toBe('sale-uuid-001');
    });

    it('forbids pharmacist from viewing another cashiers sale', async () => {
      const otherSale = { ...mockSaleRow, cashier_id: 'other-cashier' };
      mockDataSource.query.mockResolvedValueOnce([otherSale]);
      const pharmacist: JwtUser = { ...actor, role: 'pharmacist' };
      await expect(service.getSale('sale-uuid-001', pharmacist)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── formatGhs (via totalFormatted) ────────────────────────────────────────

  describe('formatGhs', () => {
    it('formats pesewas to GH₵ string correctly', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([mockSaleRow])
        .mockResolvedValueOnce([mockSaleItemRow]);

      const result = await service.getSale('sale-uuid-001', actor);
      // 575 pesewas → GH₵5.75
      expect(result.totalFormatted).toBe('GH₵5.75');
    });

    it('formats zero pesewas as GH₵0.00', async () => {
      mockDataSource.query.mockResolvedValueOnce([
        { sales_count: 0, total_revenue: 0, vat_collected: 0 },
      ]);
      mockDataSource.query.mockResolvedValueOnce([{ organization_id: 'org-001' }]);
      const result = await service.getDailySummary(actor);
      expect(result.totalRevenueFormatted).toBe('GH₵0.00');
    });
  });
});
