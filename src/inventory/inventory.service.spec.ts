import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InventoryService } from './inventory.service';
import { RealtimeStockService } from './realtime-stock.service';
import { JwtUser } from '../auth/decorators/current-user.decorator';

// ── Shared fixtures ───────────────────────────────────────────────────────

const actor: JwtUser = {
  sub: 'manager-uuid-001',
  role: 'manager',
  branchId: 'branch-uuid-001',
  branchType: 'pharmaceutical',
  sessionId: 'session-uuid-001',
};

const mockProduct = { id: 'prod-uuid-001', name: 'Paracetamol 500mg' };

const mockInventoryRow = {
  product_id: 'prod-uuid-001',
  product_name: 'Paracetamol 500mg',
  classification: 'OTC',
  quantity_on_hand: 50,
  reorder_level: 10,
  nearest_expiry: null,
  supplier_id: 'supplier-uuid-001',
  supplier_name: 'Pharma Dist Ltd',
};

const mockDataSource = {
  query: jest.fn(),
  transaction: jest.fn(),
};

const mockRealtimeStock = {
  publishStockChanged: jest.fn(),
};

async function buildModule(): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      InventoryService,
      { provide: DataSource, useValue: mockDataSource },
      { provide: RealtimeStockService, useValue: mockRealtimeStock },
    ],
  }).compile();
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    const module = await buildModule();
    service = module.get(InventoryService);
    jest.clearAllMocks();
  });

  // ── calcStatus (via listInventory) ────────────────────────────────────────

  describe('calcStatus', () => {
    const cases: Array<[number, number, string]> = [
      [0, 10, 'out'],
      [1, 10, 'critical'],   // 1 <= 10 * 0.2 = 2
      [2, 10, 'critical'],   // 2 <= 2
      [3, 10, 'low'],        // 3 > 2 but <= 10
      [10, 10, 'low'],       // exactly at reorder level
      [11, 10, 'ok'],        // above reorder level
      [100, 10, 'ok'],
    ];

    it.each(cases)(
      'qty=%i reorder=%i → status=%s',
      async (qty, reorder, expected) => {
        mockDataSource.query.mockResolvedValue([
          { ...mockInventoryRow, quantity_on_hand: qty, reorder_level: reorder },
        ]);

        const items = await service.listInventory('branch-uuid-001');
        expect(items[0].stockStatus).toBe(expected);
      },
    );
  });

  // ── adjustStock ───────────────────────────────────────────────────────────

  describe('adjustStock', () => {
    it('succeeds with a positive delta', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([mockProduct])                          // product lookup
        .mockResolvedValueOnce([])                                     // upsert inventory
        .mockResolvedValueOnce([{ quantity_on_hand: 50 }])             // current qty
        .mockResolvedValueOnce([mockInventoryRow]);                    // listInventory after update

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const em = { query: jest.fn().mockResolvedValue([]) };
        await cb(em);
      });

      const result = await service.adjustStock(
        { productId: 'prod-uuid-001', quantityDelta: 20, reason: 'Stock received' },
        actor,
      );

      expect(result.productId).toBe('prod-uuid-001');
      expect(mockRealtimeStock.publishStockChanged).toHaveBeenCalled();
    });

    it('throws BadRequestException when delta would result in negative stock', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([mockProduct])              // product lookup
        .mockResolvedValueOnce([])                         // upsert inventory
        .mockResolvedValueOnce([{ quantity_on_hand: 5 }]); // current qty = 5

      await expect(
        service.adjustStock(
          { productId: 'prod-uuid-001', quantityDelta: -10, reason: 'Write-off' },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when product does not exist', async () => {
      mockDataSource.query.mockResolvedValueOnce([]); // no product found

      await expect(
        service.adjustStock(
          { productId: 'nonexistent', quantityDelta: 5, reason: 'Test' },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows delta that brings stock exactly to zero', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([mockProduct])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ quantity_on_hand: 5 }])
        .mockResolvedValueOnce([{ ...mockInventoryRow, quantity_on_hand: 0 }]);

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const em = { query: jest.fn().mockResolvedValue([]) };
        await cb(em);
      });

      const result = await service.adjustStock(
        { productId: 'prod-uuid-001', quantityDelta: -5, reason: 'Full write-off' },
        actor,
      );

      expect(result.stockStatus).toBe('out');
    });
  });

  // ── getLowStockAlerts ─────────────────────────────────────────────────────

  describe('getLowStockAlerts', () => {
    it('returns only products at or below reorder level', async () => {
      mockDataSource.query.mockResolvedValue([
        { product_id: 'prod-low-001', product_name: 'Amoxicillin', quantity_on_hand: 3, reorder_level: 10 },
        { product_id: 'prod-out-001', product_name: 'Insulin', quantity_on_hand: 0, reorder_level: 5 },
      ]);

      const alerts = await service.getLowStockAlerts('branch-uuid-001');

      expect(alerts).toHaveLength(2);
      expect(alerts[0].productId).toBe('prod-low-001');
      expect(alerts[1].status).toBe('out');
    });

    it('returns empty array when all products are well-stocked', async () => {
      mockDataSource.query.mockResolvedValue([]);
      const alerts = await service.getLowStockAlerts('branch-uuid-001');
      expect(alerts).toHaveLength(0);
    });
  });

  // ── receiveStock ──────────────────────────────────────────────────────────

  describe('receiveStock', () => {
    it('increments on-hand, inserts PURCHASE movement, and publishes stock event', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([mockProduct])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockInventoryRow]);

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const em = { query: jest.fn().mockResolvedValue([]) };
        await cb(em);
      });

      const result = await service.receiveStock(
        {
          productId: 'prod-uuid-001',
          quantity: 50,
          batchNumber: 'BATCH-001',
          expiryDate: '2027-12-31',
          purchaseOrderId: 'PO-001',
        },
        actor,
      );

      expect(result.productId).toBe('prod-uuid-001');
      expect(mockRealtimeStock.publishStockChanged).toHaveBeenCalled();
    });
  });
});
