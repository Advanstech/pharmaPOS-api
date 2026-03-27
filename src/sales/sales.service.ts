import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GraphQLError } from 'graphql';
import { VAT_CONFIG } from '../config/constants';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { RealtimeStockService } from '../inventory/realtime-stock.service';
import {
  CreateSaleInput,
  SaleOutput,
  SaleItemOutput,
  DailySummary,
} from './dto/sale.types';
import { SalesEffectiveAtService } from './sales-effective-at.service';
import { PharmacyService } from '../pharmacy/pharmacy.service';

interface ProductRow {
  id: string;
  name: string;
  unit_price: number;
  classification: string;
  requires_rx: boolean;
  vat_exempt: boolean;
  supplier_id: string | null;
  quantity_on_hand: number;
}

interface SaleRow {
  id: string;
  branch_id: string;
  cashier_id: string;
  total_amount: number;
  vat_amount: number;
  status: string;
  idempotency_key: string;
  sold_at: Date | null;
  created_at: Date;
  branch_name: string;
  cashier_name: string;
}

interface SaleItemRow {
  id: string;
  product_id: string;
  product_name: string;
  classification: string;
  quantity: number;
  unit_price: number;
  vat_exempt: boolean;
  supplier_id: string | null;
  stock_after_sale: number;
  reorder_level: number;
  supplier_name: string | null;
}

/** Roles that may list and open any sale in the branch (supervision). Floor staff see only their own. */
const BRANCH_WIDE_SALES_ROLES = ['owner', 'se_admin', 'manager'] as const;

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly realtimeStock: RealtimeStockService,
    private readonly effectiveSaleAt: SalesEffectiveAtService,
    private readonly pharmacy: PharmacyService,
  ) {}

  // ── Create sale ───────────────────────────────────────────────────────────

  /**
   * Create a completed sale.
   * Ghana FDA: POM items validated by PomEnforcementGuard before this runs.
   * Ghana GRA: VAT calculated at 15% on non-exempt items.
   * Idempotency key prevents duplicate offline sync.
   */
  async createSale(input: CreateSaleInput, actor: JwtUser): Promise<SaleOutput> {
    // Check idempotency — return existing sale if key already used
    const existing = await this.dataSource.query(
      `SELECT id FROM sales WHERE idempotency_key = $1`,
      [input.idempotencyKey],
    ) as Array<{ id: string }>;

    if (existing[0]) {
      this.logger.log(`Idempotent sale: key=${input.idempotencyKey} already exists`);
      return this.getSale(existing[0].id, actor);
    }

    const soldAt = this.parseOptionalSoldAt(input.soldAt);

    // Load products + inventory in one query
    const productIds = input.items.map((i) => i.productId);
    const products = await this.dataSource.query(`
      SELECT
        p.id, p.name, p.unit_price, p.classification, p.requires_rx, p.vat_exempt, p.supplier_id,
        COALESCE(inv.quantity_on_hand, 0) AS quantity_on_hand
      FROM products p
      LEFT JOIN inventory inv ON inv.product_id = p.id AND inv.branch_id = $1
      WHERE p.id = ANY($2) AND p.is_active = true
    `, [actor.branchId, productIds]) as ProductRow[];

    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products not found or inactive');
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Validate stock + POM rules
    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) throw new NotFoundException(`Product ${item.productId} not found`);

      // Ghana FDA: POM requires approved Rx — double-check even though guard runs first
      if (product.requires_rx && !item.prescriptionId) {
        throw new GraphQLError('Prescription required for POM product', {
          extensions: { code: 'FDA_POM_VIOLATION' },
        });
      }

      // Stock check
      if (product.quantity_on_hand < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for ${product.name}: ${product.quantity_on_hand} available`,
        );
      }
    }

    const pomRxIds = new Set<string>();
    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product?.requires_rx || !item.prescriptionId) continue;
      await this.pharmacy.assertPrescriptionCoversProduct(
        item.prescriptionId,
        item.productId,
        item.quantity,
        actor.branchId,
      );
      pomRxIds.add(item.prescriptionId);
    }
    if (pomRxIds.size > 1) {
      throw new BadRequestException(
        'This sale references multiple prescriptions. Use separate checkouts for different prescriptions.',
      );
    }
    const salePrescriptionId = pomRxIds.size === 1 ? [...pomRxIds][0]! : null;

    // Calculate totals — Ghana GRA: 15% VAT on non-exempt items
    let subtotalPesewas = 0;
    let vatPesewas = 0;

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) continue;
      const lineTotal = product.unit_price * item.quantity;
      subtotalPesewas += lineTotal;
      if (!product.vat_exempt) {
        vatPesewas += Math.round(lineTotal * VAT_CONFIG.standardRate);
      }
    }

    const totalPesewas = subtotalPesewas + vatPesewas;

    // Validate tender covers total
    const tenderedPesewas = input.tenders.reduce((sum, t) => sum + t.amountPesewas, 0);
    if (tenderedPesewas < totalPesewas) {
      throw new BadRequestException(
        `Tendered amount (${tenderedPesewas}) is less than total (${totalPesewas})`,
      );
    }

    if (input.customerId) {
      const custRows = await this.dataSource.query(
        `SELECT 1 FROM customers WHERE id = $1 AND branch_id = $2 AND is_active = true`,
        [input.customerId, actor.branchId],
      ) as unknown[];
      if (custRows.length === 0) {
        throw new BadRequestException('Customer not found in this branch');
      }
    }

    // Persist in transaction
    const { saleId, stockChanges } = await this.dataSource.transaction(async (em) => {
      const [sale] = this.effectiveSaleAt.hasSoldAt
        ? ((await em.query(
            `
        INSERT INTO sales (id, branch_id, cashier_id, customer_id, total_amount, vat_amount, status, idempotency_key, sold_at, prescription_id)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'COMPLETED', $6, $7, $8)
        RETURNING id
      `,
            [
              actor.branchId,
              actor.sub,
              input.customerId ?? null,
              totalPesewas,
              vatPesewas,
              input.idempotencyKey,
              soldAt,
              salePrescriptionId,
            ],
          )) as Array<{ id: string }>)
        : ((await em.query(
            `
        INSERT INTO sales (id, branch_id, cashier_id, customer_id, total_amount, vat_amount, status, idempotency_key, prescription_id)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'COMPLETED', $6, $7)
        RETURNING id
      `,
            [
              actor.branchId,
              actor.sub,
              input.customerId ?? null,
              totalPesewas,
              vatPesewas,
              input.idempotencyKey,
              salePrescriptionId,
            ],
          )) as Array<{ id: string }>);

      const pendingStockEvents: Array<{
        branchId: string;
        productId: string;
        quantityOnHand: number;
        reorderLevel: number;
      }> = [];

      // Insert sale items + decrement inventory
      for (const item of input.items) {
        const product = productMap.get(item.productId);
        if (!product) continue;

        await em.query(`
          INSERT INTO sale_items (id, sale_id, product_id, supplier_id, quantity, unit_price, vat_exempt)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
        `, [sale.id, item.productId, product.supplier_id, item.quantity, product.unit_price, product.vat_exempt]);

        // Decrement inventory
        const [updatedInventory] = await em.query(`
          UPDATE inventory SET quantity_on_hand = quantity_on_hand - $1, updated_at = NOW()
          WHERE product_id = $2 AND branch_id = $3
          RETURNING quantity_on_hand, reorder_level
        `, [item.quantity, item.productId, actor.branchId]) as Array<{
          quantity_on_hand: number;
          reorder_level: number;
        }>;

        if (updatedInventory) {
          pendingStockEvents.push({
            branchId: actor.branchId,
            productId: item.productId,
            quantityOnHand: updatedInventory.quantity_on_hand,
            reorderLevel: updatedInventory.reorder_level,
          });
        }

        // Stock movement record
        await em.query(`
          INSERT INTO stock_movements (id, product_id, branch_id, quantity, movement_type, reference_id, performed_by)
          VALUES (gen_random_uuid(), $1, $2, $3, 'SALE', $4, $5)
        `, [item.productId, actor.branchId, -item.quantity, sale.id, actor.sub]);
      }

      // Audit log — no PHI
      await em.query(`
        INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
        VALUES (gen_random_uuid(), $1, $2, 'SALE_COMPLETED', 'sale', $3, $4)
      `, [
        actor.branchId,
        actor.sub,
        sale.id,
        JSON.stringify({ total_pesewas: totalPesewas, item_count: input.items.length }),
      ]);

      return { saleId: sale.id, stockChanges: pendingStockEvents };
    });

    const lastByProduct = new Map<string, { branchId: string; productId: string; quantityOnHand: number; reorderLevel: number }>();
    for (const event of stockChanges) {
      lastByProduct.set(`${event.branchId}:${event.productId}`, event);
    }
    for (const event of lastByProduct.values()) {
      this.realtimeStock.publishStockChanged(event);
    }

    this.logger.log(`Sale created: id=${saleId} total=${totalPesewas} by cashier=${actor.sub}`);
    return this.getSale(saleId, actor);
  }

  // ── Get sale ──────────────────────────────────────────────────────────────

  async getSale(saleId: string, actor: JwtUser): Promise<SaleOutput> {
    const soldAtSelect = this.effectiveSaleAt.hasSoldAt ? 's.sold_at' : 'NULL::timestamptz AS sold_at';
    const [sale] = await this.dataSource.query(
      `
      SELECT
        s.id,
        s.branch_id,
        s.cashier_id,
        s.total_amount,
        s.vat_amount,
        s.status,
        s.idempotency_key,
        ${soldAtSelect},
        s.created_at,
        b.name AS branch_name,
        u.name AS cashier_name
      FROM sales s
      JOIN branches b ON b.id = s.branch_id
      JOIN users u ON u.id = s.cashier_id
      WHERE s.id = $1
    `,
      [saleId],
    ) as SaleRow[];

    if (!sale) throw new NotFoundException(`Sale ${saleId} not found`);

    if (sale.branch_id !== actor.branchId) {
      throw new ForbiddenException('Sale is not in your branch');
    }

    const branchWide = (BRANCH_WIDE_SALES_ROLES as readonly string[]).includes(actor.role);
    if (!branchWide && sale.cashier_id !== actor.sub) {
      throw new ForbiddenException('You can only view your own sales');
    }

    const items = await this.dataSource.query(
      `
      SELECT
        si.id,
        si.product_id,
        p.name AS product_name,
        p.classification AS classification,
        si.quantity,
        si.unit_price,
        si.vat_exempt,
        si.supplier_id,
        COALESCE(inv.quantity_on_hand, 0) AS stock_after_sale,
        COALESCE(inv.reorder_level, 10) AS reorder_level,
        sup.name AS supplier_name
      FROM sale_items si
      JOIN products p ON p.id = si.product_id
      LEFT JOIN suppliers sup ON sup.id = si.supplier_id
      LEFT JOIN inventory inv ON inv.product_id = si.product_id AND inv.branch_id = $2
      WHERE si.sale_id = $1
    `,
      [saleId, sale.branch_id],
    ) as SaleItemRow[];

    return this.mapSaleOutput(sale, items);
  }

  // ── Daily summary ─────────────────────────────────────────────────────────

  async getDailySummary(branchId: string, date?: string): Promise<DailySummary> {
    const targetDate = date ?? new Date().toISOString().split('T')[0];

    const at = this.effectiveSaleAt.sql('s');
    const [row] = await this.dataSource.query(`
      SELECT
        COUNT(*)::int AS sales_count,
        COALESCE(SUM(s.total_amount), 0)::int AS total_revenue,
        COALESCE(SUM(s.vat_amount), 0)::int AS vat_collected
      FROM sales s
      WHERE s.branch_id = $1
        AND s.status = 'COMPLETED'
        AND (${at})::date = $2::date
    `, [branchId, targetDate]) as Array<{ sales_count: number; total_revenue: number; vat_collected: number }>;

    const count = row?.sales_count ?? 0;
    const revenue = row?.total_revenue ?? 0;
    const vat = row?.vat_collected ?? 0;

    return {
      salesCount: count,
      totalRevenuePesewas: revenue,
      totalRevenueFormatted: this.formatGhs(revenue),
      vatCollectedPesewas: vat,
      averageSaleGhs: count > 0 ? revenue / 100 / count : 0,
    };
  }

  // ── Recent sales ──────────────────────────────────────────────────────────

  async getRecentSales(actor: JwtUser, limit = 20): Promise<SaleOutput[]> {
    const ownSalesOnly = !(BRANCH_WIDE_SALES_ROLES as readonly string[]).includes(actor.role);
    const orderAt = this.effectiveSaleAt.hasSoldAt ? 'COALESCE(sold_at, created_at)' : 'created_at';
    const rowSelect = this.effectiveSaleAt.hasSoldAt
      ? 'id, branch_id, cashier_id, total_amount, vat_amount, status, idempotency_key, sold_at, created_at'
      : 'id, branch_id, cashier_id, total_amount, vat_amount, status, idempotency_key, NULL::timestamptz AS sold_at, created_at';
    const sales = ownSalesOnly
      ? ((await this.dataSource.query(
          `
        SELECT ${rowSelect}
        FROM sales
        WHERE branch_id = $1 AND status = 'COMPLETED' AND cashier_id = $3
        ORDER BY ${orderAt} DESC
        LIMIT $2
      `,
          [actor.branchId, limit, actor.sub],
        )) as SaleRow[])
      : ((await this.dataSource.query(
          `
        SELECT ${rowSelect}
        FROM sales
        WHERE branch_id = $1 AND status = 'COMPLETED'
        ORDER BY ${orderAt} DESC
        LIMIT $2
      `,
          [actor.branchId, limit],
        )) as SaleRow[]);

    return Promise.all(sales.map((s) => this.getSale(s.id, actor)));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /** Offline checkout time — validated; null when omitted (online POS). */
  private parseOptionalSoldAt(iso?: string): Date | null {
    if (iso == null || String(iso).trim() === '') return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('soldAt must be a valid ISO 8601 datetime');
    }
    const now = Date.now();
    const maxFutureMs = 15 * 60 * 1000;
    const maxPastMs = 400 * 24 * 60 * 60 * 1000;
    if (d.getTime() > now + maxFutureMs) {
      throw new BadRequestException('soldAt cannot be more than 15 minutes in the future');
    }
    if (d.getTime() < now - maxPastMs) {
      throw new BadRequestException('soldAt is too far in the past');
    }
    return d;
  }

  private mapSaleOutput(sale: SaleRow, items: SaleItemRow[]): SaleOutput {
    return {
      id: sale.id,
      branchId: sale.branch_id,
      branchName: sale.branch_name,
      cashierId: sale.cashier_id,
      cashierName: sale.cashier_name,
      totalPesewas: sale.total_amount,
      vatPesewas: sale.vat_amount,
      totalFormatted: this.formatGhs(sale.total_amount),
      status: sale.status,
      idempotencyKey: sale.idempotency_key,
      soldAt: sale.sold_at ?? null,
      createdAt: sale.created_at,
      items: items.map((i): SaleItemOutput => ({
        id: i.id,
        productId: i.product_id,
        productName: i.product_name,
        classification: i.classification ?? 'OTC',
        quantity: i.quantity,
        unitPricePesewas: i.unit_price,
        vatExempt: i.vat_exempt,
        supplierId: i.supplier_id ?? undefined,
        supplierName: i.supplier_name ?? undefined,
        stockAfterSale: i.stock_after_sale,
        reorderLevel: i.reorder_level,
        stockStatus: this.calcStockStatus(i.stock_after_sale, i.reorder_level),
      })),
    };
  }

  private formatGhs(pesewas: number): string {
    return `GH₵${(pesewas / 100).toFixed(2)}`;
  }

  private calcStockStatus(quantityOnHand: number, reorderLevel: number): string {
    if (quantityOnHand <= 0) return 'out';
    if (quantityOnHand <= Math.max(1, Math.floor(reorderLevel * 0.2))) return 'critical';
    if (quantityOnHand <= reorderLevel) return 'low';
    return 'ok';
  }
}
