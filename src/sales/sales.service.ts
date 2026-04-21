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
import { TaxConfigService } from '../config/tax-config.service';
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
import { NotificationsService } from '../notifications/notifications.service';
import { EmailTemplates } from '../notifications/email-templates';
import { GLPostingService } from '../accounting/gl-posting.service';

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
const ORG_WIDE_SALES_ROLES = ['owner', 'se_admin'] as const;

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly realtimeStock: RealtimeStockService,
    private readonly effectiveSaleAt: SalesEffectiveAtService,
    private readonly pharmacy: PharmacyService,
    private readonly notifications: NotificationsService,
    private readonly glPosting: GLPostingService,
    private readonly taxConfigService: TaxConfigService,
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

    // Calculate totals — use branch tax config (defaults to Ghana GRA 15%)
    let subtotalPesewas = 0;
    let vatPesewas = 0;

    // Load tax config once for this branch
    const taxConfig = await this.taxConfigService.getTaxConfig(actor.branchId);

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) continue;
      const lineTotal = product.unit_price * item.quantity;
      subtotalPesewas += lineTotal;
      if (!product.vat_exempt) {
        const effectiveRate = await this.taxConfigService.getEffectiveRate(actor.branchId, product.classification);
        vatPesewas += Math.round(lineTotal * effectiveRate);
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

      // Persist tenders
      for (const tender of input.tenders) {
        await em.query(`
          INSERT INTO sale_tenders (id, sale_id, method, amount_pesewas, momo_reference)
          VALUES (gen_random_uuid(), $1, $2, $3, $4)
          ON CONFLICT DO NOTHING
        `, [sale.id, tender.method, tender.amountPesewas, tender.momoReference ?? null]);
      }

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

    // ── GL Posting: Revenue + COGS ──────────────────────────────────────────
    // Fire-and-forget — don't block the POS response
    setImmediate(async () => {
      try {
        // Calculate COGS from latest supplier cost per product
        let cogsPesewas = 0;
        for (const item of input.items) {
          const [costRow] = await this.dataSource.query(
            `SELECT COALESCE(
              (SELECT unit_cost_pesewas FROM product_cost_history
               WHERE product_id = $1 ORDER BY observed_at DESC LIMIT 1),
              (SELECT unit_price FROM products WHERE id = $1)
            ) AS cost`,
            [item.productId],
          ) as Array<{ cost: number }>;
          if (costRow) {
            cogsPesewas += (costRow.cost || 0) * item.quantity;
          }
        }

        await this.glPosting.postSaleCompleted({
          branchId: actor.branchId,
          saleId,
          subtotalPesewas: subtotalPesewas,
          vatPesewas: vatPesewas,
          totalPesewas: totalPesewas,
          cogsPesewas,
        });
      } catch (err) {
        this.logger.warn('GL posting failed for sale ' + saleId + ': ' + err);
      }
    });

    // Send email receipt if customer has email
    if (input.customerId) {
      try {
        // Get customer details with email
        const [customerRow] = await this.dataSource.query(
          `SELECT c.customer_code, c.name_encrypted, c.email, c.receipt_preference
           FROM customers c WHERE c.id = $1 AND c.branch_id = $2`,
          [input.customerId, actor.branchId]
        ) as Array<{ 
          customer_code: string; 
          name_encrypted: string | null; 
          email: string | null;
          receipt_preference: string;
        }>;

        if (customerRow && customerRow.email) {
          // Get sale details for receipt
          const saleDetails = await this.getSale(saleId, actor);
          
          // Get branch name
          const [branchRow] = await this.dataSource.query(
            `SELECT name FROM branches WHERE id = $1`,
            [actor.branchId]
          ) as Array<{ name: string }>;
          
          const branchName = branchRow?.name || 'PharmaPOS Branch';
          
          // Decrypt customer name
          let customerName = 'Valued Customer';
          if (customerRow.name_encrypted) {
            try {
              // Note: You'll need to import the decrypt function or move this to a shared service
              customerName = 'Decrypted Name'; // Placeholder - implement decryption
            } catch {
              // Use default if decryption fails
            }
          }
          
          // Check if customer wants email receipt
          if (customerRow.receipt_preference === 'email' || customerRow.receipt_preference === 'both') {
            const template = EmailTemplates.salesReceipt(
              customerName,
              customerRow.email,
              {
                saleId: saleId,
                items: saleDetails.items.map(item => ({
                  name: item.productName || 'Product',
                  quantity: item.quantity,
                  unitPrice: item.unitPricePesewas,
                  total: item.quantity * item.unitPricePesewas,
                })),
                subtotal: saleDetails.totalPesewas - saleDetails.vatPesewas,
                vat: saleDetails.vatPesewas,
                total: saleDetails.totalPesewas,
                paymentMethod: 'Cash', // You may need to track this
                date: saleDetails.soldAt || saleDetails.createdAt,
                branchName,
              }
            );
            
            await this.notifications.sendEmail({
              to: customerRow.email,
              subject: template.subject,
              html: template.html,
            });
            
            this.logger.log(`Email receipt sent to ${customerRow.email} for sale ${saleId}`);
          }
        }
      } catch (error) {
        this.logger.error('Failed to send email receipt:', error);
        // Don't fail the sale if email fails
      }
    }

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
      if (!(await this.canAccessBranch(actor, sale.branch_id))) {
        throw new ForbiddenException('Sale is not in your accessible branches');
      }
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

    // Fetch tenders — fall back gracefully if table doesn't exist yet
    let tenders: Array<{ method: string; amount_pesewas: number; momo_reference: string | null }> = [];
    try {
      tenders = await this.dataSource.query(
        `SELECT method, amount_pesewas, momo_reference FROM sale_tenders WHERE sale_id = $1 ORDER BY amount_pesewas DESC`,
        [saleId],
      ) as typeof tenders;
    } catch {
      // sale_tenders table may not exist on older deployments — degrade gracefully
    }

    return this.mapSaleOutput(sale, items, tenders);
  }

  // ── Daily summary ─────────────────────────────────────────────────────────

  async getDailySummary(actor: JwtUser, date?: string): Promise<DailySummary> {
    const targetDate =
      date ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' });

    const { clause, params } = await this.branchScopeSql(actor);

    const at = this.effectiveSaleAt.sql('s');
    const [row] = await this.dataSource.query(`
      SELECT
        COUNT(*)::int AS sales_count,
        COALESCE(SUM(s.total_amount), 0)::int AS total_revenue,
        COALESCE(SUM(s.vat_amount), 0)::int AS vat_collected
      FROM sales s
      WHERE ${clause}
        AND s.status = 'COMPLETED'
        AND (${at} AT TIME ZONE 'Africa/Accra')::date = $${params.length + 1}::date
    `, [...params, targetDate]) as Array<{ sales_count: number; total_revenue: number; vat_collected: number }>;

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
    const orderAt = this.effectiveSaleAt.hasSoldAt ? 'COALESCE(s.sold_at, s.created_at)' : 's.created_at';
    const rowSelect = this.effectiveSaleAt.hasSoldAt
      ? 's.id, s.branch_id, s.cashier_id, s.total_amount, s.vat_amount, s.status, s.idempotency_key, s.sold_at, s.created_at, b.name AS branch_name, u.name AS cashier_name'
      : 's.id, s.branch_id, s.cashier_id, s.total_amount, s.vat_amount, s.status, s.idempotency_key, NULL::timestamptz AS sold_at, s.created_at, b.name AS branch_name, u.name AS cashier_name';
    let sales: SaleRow[];

    if (ownSalesOnly) {
      sales = (await this.dataSource.query(
        `
        SELECT ${rowSelect}
        FROM sales s
        JOIN branches b ON b.id = s.branch_id
        JOIN users u ON u.id = s.cashier_id
        WHERE s.branch_id = $1 AND s.status = 'COMPLETED' AND s.cashier_id = $3
        ORDER BY ${orderAt} DESC
        LIMIT $2
      `,
        [actor.branchId, limit, actor.sub],
      )) as SaleRow[];
    } else {
      const { clause, params } = await this.branchScopeSql(actor);
      sales = (await this.dataSource.query(
        `
        SELECT ${rowSelect}
        FROM sales s
        JOIN branches b ON b.id = s.branch_id
        JOIN users u ON u.id = s.cashier_id
        WHERE ${clause} AND s.status = 'COMPLETED'
        ORDER BY ${orderAt} DESC
        LIMIT $${params.length + 1}
      `,
        [...params, limit],
      )) as SaleRow[];
    }

    if (sales.length === 0) return [];
    const saleIds = sales.map((s) => s.id);

    const items = (await this.dataSource.query(
      `
      SELECT
        si.sale_id,
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
      LEFT JOIN sales s ON s.id = si.sale_id
      LEFT JOIN inventory inv ON inv.product_id = si.product_id AND inv.branch_id = s.branch_id
      WHERE si.sale_id = ANY($1)
      ORDER BY si.sale_id, si.id
    `,
      [saleIds],
    )) as Array<SaleItemRow & { sale_id: string }>;

    let tenders: Array<{ sale_id: string; method: string; amount_pesewas: number; momo_reference: string | null }> = [];
    try {
      tenders = (await this.dataSource.query(
        `SELECT sale_id, method, amount_pesewas, momo_reference
         FROM sale_tenders
         WHERE sale_id = ANY($1)
         ORDER BY sale_id, amount_pesewas DESC`,
        [saleIds],
      )) as typeof tenders;
    } catch {
      // sale_tenders table may not exist on older deployments — degrade gracefully
    }

    const itemsBySale = new Map<string, SaleItemRow[]>();
    for (const item of items) {
      const list = itemsBySale.get(item.sale_id) ?? [];
      list.push(item);
      itemsBySale.set(item.sale_id, list);
    }
    const tendersBySale = new Map<string, Array<{ method: string; amount_pesewas: number; momo_reference: string | null }>>();
    for (const tender of tenders) {
      const list = tendersBySale.get(tender.sale_id) ?? [];
      list.push(tender);
      tendersBySale.set(tender.sale_id, list);
    }

    return sales.map((sale) =>
      this.mapSaleOutput(
        sale,
        itemsBySale.get(sale.id) ?? [],
        tendersBySale.get(sale.id) ?? [],
      ),
    );
  }

  // ── Refund sale ────────────────────────────────────────────────────────────

  /**
   * Refund a completed sale within 24 hours.
   * RBAC: owner, se_admin, manager only (authorization required).
   * Reverses inventory, creates stock movements, logs audit trail.
   */
  async refundSale(
    saleId: string,
    reason: string,
    actor: JwtUser,
  ): Promise<SaleOutput> {
    // Only managers/owners can authorize refunds
    const authorizedRoles = ['owner', 'se_admin', 'manager'];
    if (!authorizedRoles.includes(actor.role)) {
      throw new ForbiddenException('Only managers and owners can authorize refunds');
    }

    // Get the sale
    const [sale] = await this.dataSource.query(
      `SELECT id, branch_id, total_amount, vat_amount, status, created_at FROM sales WHERE id = $1`,
      [saleId],
    ) as Array<{ id: string; branch_id: string; total_amount: number; vat_amount: number; status: string; created_at: Date }>;

    if (!sale) throw new NotFoundException(`Sale ${saleId} not found`);
    if (sale.status !== 'COMPLETED') throw new BadRequestException(`Sale is already ${sale.status} — cannot refund`);

    // Check 24-hour window
    const hoursSinceSale = (Date.now() - new Date(sale.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursSinceSale > 24) {
      throw new BadRequestException(
        `Sale was ${Math.round(hoursSinceSale)} hours ago. Refunds are only allowed within 24 hours.`,
      );
    }

    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException('A reason for the refund is required (minimum 5 characters)');
    }

    // Get sale items for inventory reversal
    const items = await this.dataSource.query(
      `SELECT si.product_id, si.quantity, p.name AS product_name
       FROM sale_items si JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = $1`,
      [saleId],
    ) as Array<{ product_id: string; quantity: number; product_name: string }>;

    // Transaction: update sale status + reverse inventory
    await this.dataSource.transaction(async (em) => {
      // 1. Mark sale as REFUNDED
      await em.query(
        `UPDATE sales SET status = 'REFUNDED', updated_at = NOW() WHERE id = $1`,
        [saleId],
      );

      // 2. Reverse inventory for each item
      for (const item of items) {
        await em.query(
          `UPDATE inventory SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
           WHERE product_id = $2 AND branch_id = $3`,
          [item.quantity, item.product_id, sale.branch_id],
        );

        // 3. Create stock movement record
        await em.query(
          `INSERT INTO stock_movements (id, product_id, branch_id, quantity, movement_type, reference_id, performed_by)
           VALUES (gen_random_uuid(), $1, $2, $3, 'REFUND', $4, $5)`,
          [item.product_id, sale.branch_id, item.quantity, saleId, actor.sub],
        );
      }

      // 4. Audit log
      await em.query(
        `INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
         VALUES (gen_random_uuid(), $1, $2, 'SALE_REFUNDED', 'sale', $3, $4)`,
        [
          sale.branch_id,
          actor.sub,
          saleId,
          JSON.stringify({
            reason: reason.trim(),
            totalRefunded: sale.total_amount,
            vatRefunded: sale.vat_amount,
            itemCount: items.length,
            items: items.map(i => ({ productId: i.product_id, productName: i.product_name, quantity: i.quantity })),
            hoursSinceSale: Math.round(hoursSinceSale * 10) / 10,
            authorizedBy: actor.sub,
          }),
        ],
      );
    });

    this.logger.log(`Sale refunded: sale=${saleId} by=${actor.sub} reason="${reason.trim()}"`);

    // ── GL Reversal: Reverse revenue + COGS ─────────────────────────────────
    setImmediate(async () => {
      try {
        let cogsPesewas = 0;
        for (const item of items) {
          const [costRow] = await this.dataSource.query(
            `SELECT COALESCE(
              (SELECT unit_cost_pesewas FROM product_cost_history
               WHERE product_id = $1 ORDER BY observed_at DESC LIMIT 1),
              (SELECT unit_price FROM products WHERE id = $1)
            ) AS cost`,
            [item.product_id],
          ) as Array<{ cost: number }>;
          if (costRow) {
            cogsPesewas += (costRow.cost || 0) * item.quantity;
          }
        }

        const subtotal = sale.total_amount - sale.vat_amount;
        await this.glPosting.postSaleRefunded({
          branchId: sale.branch_id,
          saleId,
          subtotalPesewas: subtotal,
          vatPesewas: sale.vat_amount,
          totalPesewas: sale.total_amount,
          cogsPesewas,
        });
      } catch (err) {
        this.logger.warn('GL reversal failed for refund ' + saleId + ': ' + err);
      }
    });

    // Publish stock changes for real-time UI updates
    for (const item of items) {
      const [inv] = await this.dataSource.query(
        `SELECT quantity_on_hand, reorder_level FROM inventory WHERE product_id = $1 AND branch_id = $2`,
        [item.product_id, sale.branch_id],
      ) as Array<{ quantity_on_hand: number; reorder_level: number }>;
      if (inv) {
        this.realtimeStock.publishStockChanged({
          branchId: sale.branch_id,
          productId: item.product_id,
          quantityOnHand: inv.quantity_on_hand,
          reorderLevel: inv.reorder_level,
        });
      }
    }

    return this.getSale(saleId, actor);
  }

  // ── Request Refund (cashier/pharmacist) ─────────────────────────────────

  async requestRefund(saleId: string, reason: string, actor: JwtUser): Promise<any> {
    const [sale] = await this.dataSource.query(
      `SELECT id, branch_id, total_amount, status, created_at FROM sales WHERE id = $1`,
      [saleId],
    ) as Array<{ id: string; branch_id: string; total_amount: number; status: string; created_at: Date }>;

    if (!sale) throw new NotFoundException(`Sale ${saleId} not found`);
    if (sale.status !== 'COMPLETED') throw new BadRequestException(`Sale is ${sale.status} — cannot request refund`);

    const hoursSince = (Date.now() - new Date(sale.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursSince > 24) throw new BadRequestException(`Sale was ${Math.round(hoursSince)} hours ago. Refunds only within 24 hours.`);
    if (!reason || reason.trim().length < 5) throw new BadRequestException('Reason required (min 5 chars)');

    // Check no existing pending request
    const [existing] = await this.dataSource.query(
      `SELECT id FROM refund_requests WHERE sale_id = $1 AND status = 'PENDING'`, [saleId],
    ) as Array<{ id: string }>;
    if (existing) throw new BadRequestException('A refund request is already pending for this sale');

    const [req] = await this.dataSource.query(
      `INSERT INTO refund_requests (id, sale_id, branch_id, requested_by, reason)
       VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING id, created_at`,
      [saleId, sale.branch_id, actor.sub, reason.trim()],
    ) as Array<{ id: string; created_at: Date }>;

    // Audit log
    await this.dataSource.query(
      `INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
       VALUES (gen_random_uuid(), $1, $2, 'REFUND_REQUESTED', 'sale', $3, $4)`,
      [sale.branch_id, actor.sub, saleId, JSON.stringify({ reason: reason.trim(), requestId: req.id })],
    );

    return { id: req.id, saleId, status: 'PENDING', message: 'Refund request submitted. Awaiting manager approval.' };
  }

  // ── List Pending Refund Requests (manager/owner) ──────────────────────────

  async listRefundRequests(actor: JwtUser): Promise<any[]> {
    const rows = await this.dataSource.query(`
      SELECT rr.*, u.name AS requested_by_name, s.total_amount,
        (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = rr.sale_id)::int AS item_count,
        ru.name AS reviewed_by_name
      FROM refund_requests rr
      JOIN users u ON u.id = rr.requested_by
      JOIN sales s ON s.id = rr.sale_id
      LEFT JOIN users ru ON ru.id = rr.reviewed_by
      WHERE rr.branch_id = $1
      ORDER BY CASE rr.status WHEN 'PENDING' THEN 0 ELSE 1 END, rr.created_at DESC
      LIMIT 50
    `, [actor.branchId]);

    return rows.map((r: any) => ({
      id: r.id,
      saleId: r.sale_id,
      saleTotalFormatted: `GH₵ ${(r.total_amount / 100).toFixed(2)}`,
      reason: r.reason,
      status: r.status,
      requestedByName: r.requested_by_name,
      reviewedByName: r.reviewed_by_name || null,
      reviewNotes: r.review_notes || null,
      reviewedAt: r.reviewed_at || null,
      createdAt: r.created_at,
      saleItemCount: r.item_count,
    }));
  }

  // ── Approve Refund Request (manager/owner) ────────────────────────────────

  async approveRefundRequest(requestId: string, notes: string, actor: JwtUser): Promise<any> {
    const [req] = await this.dataSource.query(
      `SELECT rr.*, s.id AS sale_id FROM refund_requests rr JOIN sales s ON s.id = rr.sale_id WHERE rr.id = $1`,
      [requestId],
    ) as Array<{ id: string; sale_id: string; status: string; reason: string }>;

    if (!req) throw new NotFoundException('Refund request not found');
    if (req.status !== 'PENDING') throw new BadRequestException(`Request is already ${req.status}`);

    // Mark request as approved
    await this.dataSource.query(
      `UPDATE refund_requests SET status = 'APPROVED', reviewed_by = $2, review_notes = $3, reviewed_at = NOW() WHERE id = $1`,
      [requestId, actor.sub, notes?.trim() || null],
    );

    // Execute the actual refund
    return this.refundSale(req.sale_id, `Approved refund: ${req.reason}`, actor);
  }

  // ── Reject Refund Request ─────────────────────────────────────────────────

  async rejectRefundRequest(requestId: string, notes: string, actor: JwtUser): Promise<boolean> {
    const [req] = await this.dataSource.query(
      `SELECT id, status, branch_id FROM refund_requests WHERE id = $1`, [requestId],
    ) as Array<{ id: string; status: string; branch_id: string }>;

    if (!req) throw new NotFoundException('Refund request not found');
    if (req.status !== 'PENDING') throw new BadRequestException(`Request is already ${req.status}`);

    await this.dataSource.query(
      `UPDATE refund_requests SET status = 'REJECTED', reviewed_by = $2, review_notes = $3, reviewed_at = NOW() WHERE id = $1`,
      [requestId, actor.sub, notes?.trim() || 'Rejected'],
    );

    await this.dataSource.query(
      `INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
       VALUES (gen_random_uuid(), $1, $2, 'REFUND_REJECTED', 'refund_request', $3, $4)`,
      [req.branch_id, actor.sub, requestId, JSON.stringify({ notes: notes?.trim() })],
    );

    return true;
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

  private mapSaleOutput(
    sale: SaleRow,
    items: SaleItemRow[],
    tenders: Array<{ method: string; amount_pesewas: number; momo_reference: string | null }> = [],
  ): SaleOutput {
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
      tenders: tenders.map(t => ({
        method: t.method,
        amountPesewas: t.amount_pesewas,
        amountFormatted: this.formatGhs(t.amount_pesewas),
        momoReference: t.momo_reference ?? undefined,
      })),
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

  private async branchScopeSql(actor: JwtUser): Promise<{ clause: string; params: unknown[] }> {
    if ((ORG_WIDE_SALES_ROLES as readonly string[]).includes(actor.role)) {
      const orgId = await this.getOrganizationIdForBranch(actor.branchId);
      return {
        clause: `s.branch_id IN (SELECT id FROM branches WHERE organization_id = $1)`,
        params: [orgId],
      };
    }

    return {
      clause: 's.branch_id = $1',
      params: [actor.branchId],
    };
  }

  private async canAccessBranch(actor: JwtUser, branchId: string): Promise<boolean> {
    if (branchId === actor.branchId) return true;
    if (!(ORG_WIDE_SALES_ROLES as readonly string[]).includes(actor.role)) return false;

    const actorOrgId = await this.getOrganizationIdForBranch(actor.branchId);
    const [row] = (await this.dataSource.query(
      `SELECT id FROM branches WHERE id = $1 AND organization_id = $2`,
      [branchId, actorOrgId],
    )) as Array<{ id: string }>;
    return !!row;
  }

  private async getOrganizationIdForBranch(branchId: string): Promise<string> {
    const [row] = (await this.dataSource.query(
      `SELECT organization_id FROM branches WHERE id = $1`,
      [branchId],
    )) as Array<{ organization_id: string }>;

    if (!row?.organization_id) {
      throw new NotFoundException(`Branch ${branchId} not found`);
    }

    return row.organization_id;
  }
}
