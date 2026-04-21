import { Injectable, Logger, NotFoundException, BadRequestException, Inject, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { RealtimeStockService } from './realtime-stock.service';
import { GLPostingService } from '../accounting/gl-posting.service';
import {
  AdjustStockInput,
  ReceiveStockInput,
  InventoryItem,
  StockMovementOutput,
  LowStockAlert,
} from './dto/inventory.types';

interface InventoryRow {
  product_id: string;
  product_name: string;
  classification: string;
  unit_price: number | null;
  quantity_on_hand: number;
  reorder_level: number;
  nearest_expiry: Date | null;
  supplier_id: string | null;
  supplier_name: string | null;
}

interface MovementRow {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  movement_type: string;
  batch_number: string | null;
  expiry_date: Date | null;
  created_at: Date;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly realtimeStock: RealtimeStockService,
    @Optional() @Inject(GLPostingService) private readonly glPosting?: GLPostingService,
  ) {}

  // ── List inventory ────────────────────────────────────────────────────────

  async listInventory(branchId: string): Promise<InventoryItem[]> {
    const rows = await this.dataSource.query(`
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        p.classification,
        p.unit_price,
        COALESCE(inv.quantity_on_hand, 0) AS quantity_on_hand,
        COALESCE(inv.reorder_level, 10) AS reorder_level,
        MIN(sm.expiry_date) AS nearest_expiry,
        p.supplier_id,
        s.name AS supplier_name
      FROM products p
      LEFT JOIN inventory inv ON inv.product_id = p.id AND inv.branch_id = $1
      LEFT JOIN stock_movements sm ON sm.product_id = p.id AND sm.branch_id = $1
        AND sm.expiry_date IS NOT NULL AND sm.expiry_date > NOW()
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.is_active = true
      GROUP BY p.id, p.name, p.classification, p.unit_price, inv.quantity_on_hand, inv.reorder_level, p.supplier_id, s.name
      ORDER BY p.name ASC
    `, [branchId]) as InventoryRow[];

    return rows.map((r) => ({
      productId: r.product_id,
      productName: r.product_name,
      classification: r.classification,
      quantityOnHand: r.quantity_on_hand,
      reorderLevel: r.reorder_level,
      stockStatus: this.calcStatus(r.quantity_on_hand, r.reorder_level),
      nearestExpiry: r.nearest_expiry ?? undefined,
      supplierId: r.supplier_id ?? undefined,
      supplierName: r.supplier_name ?? undefined,
      unitPricePesewas: r.unit_price ?? undefined,
      unitPriceFormatted: r.unit_price ? 'GH\u20B5' + (r.unit_price / 100).toFixed(2) : undefined,
    }));
  }

  // ── Low stock alerts ──────────────────────────────────────────────────────

  async getLowStockAlerts(branchId: string): Promise<LowStockAlert[]> {
    const rows = await this.dataSource.query(`
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        inv.quantity_on_hand AS quantity_on_hand,
        inv.reorder_level AS reorder_level
      FROM inventory inv
      JOIN products p ON p.id = inv.product_id
      WHERE inv.branch_id = $1
        AND p.is_active = true
        AND inv.quantity_on_hand <= inv.reorder_level
      ORDER BY quantity_on_hand ASC
    `, [branchId]) as Array<{ product_id: string; product_name: string; quantity_on_hand: number; reorder_level: number }>;

    return rows.map((r) => ({
      productId: r.product_id,
      productName: r.product_name,
      quantityOnHand: r.quantity_on_hand,
      reorderLevel: r.reorder_level,
      status: this.calcStatus(r.quantity_on_hand, r.reorder_level),
    }));
  }

  // ── Adjust stock ──────────────────────────────────────────────────────────

  /**
   * Manual stock adjustment (write-off, correction, etc.)
   * RBAC: owner, se_admin, manager, head_pharmacist only.
   */
  async adjustStock(input: AdjustStockInput, actor: JwtUser): Promise<InventoryItem> {
    const [product] = await this.dataSource.query(
      `SELECT id, name FROM products WHERE id = $1 AND is_active = true`,
      [input.productId],
    ) as Array<{ id: string; name: string }>;

    if (!product) throw new NotFoundException(`Product ${input.productId} not found`);

    // Ensure inventory row exists
    await this.dataSource.query(`
      INSERT INTO inventory (id, product_id, branch_id, quantity_on_hand, reorder_level)
      VALUES (gen_random_uuid(), $1, $2, 0, 10)
      ON CONFLICT (product_id, branch_id) DO NOTHING
    `, [input.productId, actor.branchId]);

    // Check won't go negative
    const [inv] = await this.dataSource.query(
      `SELECT quantity_on_hand FROM inventory WHERE product_id = $1 AND branch_id = $2`,
      [input.productId, actor.branchId],
    ) as Array<{ quantity_on_hand: number }>;

    const newQty = (inv?.quantity_on_hand ?? 0) + input.quantityDelta;
    if (newQty < 0) {
      throw new BadRequestException(
        `Adjustment would result in negative stock (${newQty}). Current: ${inv?.quantity_on_hand ?? 0}`,
      );
    }

    await this.dataSource.transaction(async (em) => {
      await em.query(`
        UPDATE inventory SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
        WHERE product_id = $2 AND branch_id = $3
      `, [input.quantityDelta, input.productId, actor.branchId]);

      await em.query(`
        INSERT INTO stock_movements (id, product_id, branch_id, batch_number, expiry_date, quantity, movement_type, performed_by)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'ADJUSTMENT', $6)
      `, [
        input.productId,
        actor.branchId,
        input.batchNumber ?? null,
        input.expiryDate ?? null,
        input.quantityDelta,
        actor.sub,
      ]);

      await em.query(`
        INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
        VALUES (gen_random_uuid(), $1, $2, 'STOCK_ADJUSTED', 'product', $3, $4)
      `, [
        actor.branchId,
        actor.sub,
        input.productId,
        JSON.stringify({ delta: input.quantityDelta, reason: input.reason }),
      ]);
    });

    this.logger.log(`Stock adjusted: product=${input.productId} delta=${input.quantityDelta} by=${actor.sub}`);

    // ── GL Posting for negative adjustments (write-offs, shrinkage) ─────────
    if (this.glPosting && input.quantityDelta < 0) {
      setImmediate(async () => {
        try {
          const [costRow] = await this.dataSource.query(
            `SELECT COALESCE(
              (SELECT unit_cost_pesewas FROM product_cost_history
               WHERE product_id = $1 ORDER BY observed_at DESC LIMIT 1),
              (SELECT unit_price FROM products WHERE id = $1)
            ) AS cost`,
            [input.productId],
          ) as Array<{ cost: number }>;
          const unitCost = costRow?.cost || 0;
          if (unitCost > 0) {
            await this.glPosting!.postStockAdjustment({
              branchId: actor.branchId,
              productName: product.name,
              quantity: input.quantityDelta,
              costPesewas: unitCost,
              reason: input.reason || 'Stock adjustment',
              referenceId: input.productId,
            });
          }
        } catch (err) {
          this.logger.warn('GL posting failed for stock adjustment: ' + err);
        }
      });
    }

    const items = await this.listInventory(actor.branchId);
    const item = items.find((i) => i.productId === input.productId);
    if (!item) throw new NotFoundException('Inventory item not found after update');
    
    // Publish stock change — StockAlertsService will resolve alerts if status is 'ok'
    this.realtimeStock.publishStockChanged({
      branchId: actor.branchId,
      productId: item.productId,
      quantityOnHand: item.quantityOnHand,
      reorderLevel: item.reorderLevel,
    });
    return item;
  }

  // ── Receive stock ─────────────────────────────────────────────────────────

  /**
   * Inbound stock (delivery, returns to shelf) — records PURCHASE movement for audit trail.
   * Full supplier invoice workflow remains `createGRN`.
   */
  async receiveStock(input: ReceiveStockInput, actor: JwtUser): Promise<InventoryItem> {
    const [product] = await this.dataSource.query(
      `SELECT id, name FROM products WHERE id = $1 AND is_active = true`,
      [input.productId],
    ) as Array<{ id: string; name: string }>;

    if (!product) throw new NotFoundException(`Product ${input.productId} not found`);

    await this.dataSource.query(
      `
      INSERT INTO inventory (id, product_id, branch_id, quantity_on_hand, reorder_level)
      VALUES (gen_random_uuid(), $1, $2, 0, 10)
      ON CONFLICT (product_id, branch_id) DO NOTHING
    `,
      [input.productId, actor.branchId],
    );

    await this.dataSource.transaction(async (em) => {
      await em.query(
        `
        UPDATE inventory SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
        WHERE product_id = $2 AND branch_id = $3
      `,
        [input.quantity, input.productId, actor.branchId],
      );

      await em.query(
        `
        INSERT INTO stock_movements (
          id, product_id, branch_id, batch_number, expiry_date, quantity, movement_type, reference_id, performed_by
        )
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'PURCHASE', NULL, $6)
      `,
        [
          input.productId,
          actor.branchId,
          input.batchNumber ?? null,
          input.expiryDate ?? null,
          input.quantity,
          actor.sub,
        ],
      );

      await em.query(
        `
        INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
        VALUES (gen_random_uuid(), $1, $2, 'STOCK_RECEIVED', 'product', $3, $4)
      `,
        [
          actor.branchId,
          actor.sub,
          input.productId,
          JSON.stringify({
            quantity: input.quantity,
            purchase_order_id: input.purchaseOrderId ?? null,
            batch_number: input.batchNumber ?? null,
          }),
        ],
      );
    });

    this.logger.log(`Stock received: product=${input.productId} qty=${input.quantity} by=${actor.sub}`);

    // ── GL Posting: Debit Inventory, Credit Accounts Payable ────────────────
    if (this.glPosting) {
      setImmediate(async () => {
        try {
          const [costRow] = await this.dataSource.query(
            `SELECT COALESCE(
              (SELECT unit_cost_pesewas FROM product_cost_history
               WHERE product_id = $1 ORDER BY observed_at DESC LIMIT 1),
              (SELECT unit_price FROM products WHERE id = $1)
            ) AS cost`,
            [input.productId],
          ) as Array<{ cost: number }>;
          const unitCost = costRow?.cost || 0;
          if (unitCost > 0) {
            await this.glPosting!.postStockReceived({
              branchId: actor.branchId,
              productId: input.productId,
              productName: product.name,
              quantity: input.quantity,
              costPesewas: unitCost,
            });
          }
        } catch (err) {
          this.logger.warn('GL posting failed for stock received: ' + err);
        }
      });
    }

    const items = await this.listInventory(actor.branchId);
    const item = items.find((i) => i.productId === input.productId);
    if (!item) throw new NotFoundException('Inventory item not found after update');
    
    // Publish stock change — StockAlertsService will resolve alerts if status is 'ok'
    this.realtimeStock.publishStockChanged({
      branchId: actor.branchId,
      productId: item.productId,
      quantityOnHand: item.quantityOnHand,
      reorderLevel: item.reorderLevel,
    });
    return item;
  }

  // ── Stock movements ───────────────────────────────────────────────────────

  async getStockMovements(productId: string, branchId: string, limit = 50): Promise<StockMovementOutput[]> {
    const safeLimit = Math.min(500, Math.max(1, Math.trunc(Number(limit) || 50)));
    const rows = await this.dataSource.query(`
      SELECT sm.id, sm.product_id, p.name AS product_name, sm.quantity,
             sm.movement_type, sm.batch_number, sm.expiry_date, sm.created_at
      FROM stock_movements sm
      JOIN products p ON p.id = sm.product_id
      WHERE sm.product_id = $1 AND sm.branch_id = $2
      ORDER BY sm.created_at DESC
      LIMIT $3
    `, [productId, branchId, safeLimit]) as MovementRow[];

    return rows.map((r) => ({
      id: r.id,
      productId: r.product_id,
      productName: r.product_name,
      quantity: r.quantity,
      movementType: r.movement_type,
      batchNumber: r.batch_number ?? undefined,
      expiryDate: r.expiry_date ?? undefined,
      createdAt: r.created_at,
    }));
  }

  // ── GRN (Goods Received Note) Workflow ───────────────────────────────────

  /**
   * Create a GRN — records stock arrival from supplier with their invoice.
   * Ghana workflow: Supplier delivers → Staff receives and stocks → Manager matches invoice → Owner pays.
   * RBAC: owner, se_admin, manager, head_pharmacist, technician.
   */
  async createGRN(input: import('./dto/inventory.types').CreateGRNInput, actor: JwtUser): Promise<import('./dto/inventory.types').GRNOutput> {
    // Validate supplier exists
    const [supplier] = await this.dataSource.query(
      `SELECT id, name, payment_terms FROM suppliers WHERE id = $1 AND is_active = true`,
      [input.supplierId],
    ) as Array<{ id: string; name: string; payment_terms: string }>;

    if (!supplier) throw new NotFoundException(`Supplier ${input.supplierId} not found`);

    // Calculate due date from payment terms if not provided
    let dueDate = input.dueDate;
    if (!dueDate && supplier.payment_terms) {
      const days = supplier.payment_terms === 'NET_30' ? 30 : supplier.payment_terms === 'NET_60' ? 60 : 30;
      const due = new Date(input.invoiceDate);
      due.setDate(due.getDate() + days);
      dueDate = due.toISOString().split('T')[0];
    }

    // Validate all products exist
    const productIds = input.items.map((i) => i.productId);
    const products = await this.dataSource.query(`
      SELECT id, name FROM products WHERE id = ANY($1) AND is_active = true
    `, [productIds]) as Array<{ id: string; name: string }>;

    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products not found or inactive');
    }

    const totalReceivedQty = input.items.reduce((sum, item) => sum + item.quantity, 0);
    const inferredUnitCostPesewas = totalReceivedQty > 0
      ? Math.max(1, Math.round(input.totalAmountPesewas / totalReceivedQty))
      : 1;

    const { grnId, changedProductIds } = await this.dataSource.transaction(async (em) => {
      // Create GRN record
      const [grn] = await em.query(`
        INSERT INTO goods_received_notes (
          id, purchase_order_id, branch_id, received_by, notes
        )
        VALUES (gen_random_uuid(), $1, $2, $3, $4)
        RETURNING id
      `, [
        input.purchaseOrderId ?? null,
        actor.branchId,
        actor.sub,
        input.notes ?? null,
      ]) as Array<{ id: string }>;

      // Create supplier invoice record (will be matched later by manager)
      await em.query(`
        INSERT INTO supplier_invoices (
          id, supplier_id, branch_id, grn_id, invoice_number, invoice_date,
          due_date, total_amount, paid_amount, status, s3_pdf_key
        )
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::date, $6::date, $7, 0, 'PENDING', $8)
      `, [
        input.supplierId,
        actor.branchId,
        grn.id,
        input.supplierInvoiceNumber,
        input.invoiceDate,
        dueDate ?? null,
        input.totalAmountPesewas,
        input.invoicePdfS3Key ?? null,
      ]);

      const changedIds = new Set<string>();

      // Process each item — increment inventory + create stock movement
      for (const item of input.items) {
        const lineUnitCostPesewas = item.unitCostPesewas ?? inferredUnitCostPesewas;
        // Ensure inventory row exists
        await em.query(`
          INSERT INTO inventory (id, product_id, branch_id, quantity_on_hand, reorder_level)
          VALUES (gen_random_uuid(), $1, $2, 0, 10)
          ON CONFLICT (product_id, branch_id) DO NOTHING
        `, [item.productId, actor.branchId]);

        // Increment inventory
        await em.query(`
          UPDATE inventory
          SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
          WHERE product_id = $2 AND branch_id = $3
        `, [item.quantity, item.productId, actor.branchId]);
        changedIds.add(item.productId);

        // Stock movement record
        await em.query(`
          INSERT INTO stock_movements (
            id, product_id, branch_id, batch_number, expiry_date,
            quantity, movement_type, reference_id, performed_by
          )
          VALUES (gen_random_uuid(), $1, $2, $3, $4::date, $5, 'PURCHASE', $6, $7)
        `, [
          item.productId,
          actor.branchId,
          item.batchNumber,
          item.expiryDate,
          item.quantity,
          grn.id,
          actor.sub,
        ]);

        // Capture supplier cost snapshot for downstream pricing suggestions.
        await em.query(`
          INSERT INTO product_cost_history (
            id, branch_id, product_id, supplier_id, source_type, source_reference_id,
            unit_cost_pesewas, currency, observed_at, created_by
          )
          VALUES (gen_random_uuid(), $1, $2, $3, 'GRN', $4, $5, 'GHS', NOW(), $6)
        `, [
          actor.branchId,
          item.productId,
          input.supplierId,
          grn.id,
          lineUnitCostPesewas,
          actor.sub,
        ]);

        // If product image uploaded, create product_images record (approved so POS search shows it)
        if (item.imageS3Key) {
          const inserted = (await em.query(
            `
            INSERT INTO product_images (
              id, product_id, cdn_url, url_thumb, source, is_approved
            )
            VALUES (gen_random_uuid(), $1, $2, $2, 'MANUAL_UPLOAD', true)
            RETURNING id
          `,
            [item.productId, item.imageS3Key],
          )) as Array<{ id: string }>;
          const imgId = inserted[0]?.id;
          if (imgId) {
            await em.query(`UPDATE products SET image_id = $1 WHERE id = $2`, [imgId, item.productId]);
          }
        }
      }

      // Audit log
      await em.query(`
        INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
        VALUES (gen_random_uuid(), $1, $2, 'GRN_CREATED', 'grn', $3, $4)
      `, [
        actor.branchId,
        actor.sub,
        grn.id,
        JSON.stringify({
          supplier_id: input.supplierId,
          invoice_number: input.supplierInvoiceNumber,
          total_amount: input.totalAmountPesewas,
          item_count: input.items.length,
        }),
      ]);

      return { grnId: grn.id, changedProductIds: Array.from(changedIds) };
    });

    this.logger.log(`GRN created: id=${grnId} supplier=${input.supplierId} by=${actor.sub}`);
    if (changedProductIds.length > 0) {
      const updatedRows = await this.dataSource.query(`
        SELECT product_id, quantity_on_hand, reorder_level
        FROM inventory
        WHERE branch_id = $1 AND product_id = ANY($2)
      `, [actor.branchId, changedProductIds]) as Array<{
        product_id: string;
        quantity_on_hand: number;
        reorder_level: number;
      }>;
      for (const row of updatedRows) {
        this.realtimeStock.publishStockChanged({
          branchId: actor.branchId,
          productId: row.product_id,
          quantityOnHand: row.quantity_on_hand,
          reorderLevel: row.reorder_level,
        });
      }
    }
    return this.getGRN(grnId);
  }

  /**
   * Get a single GRN by ID.
   */
  async getGRN(grnId: string): Promise<import('./dto/inventory.types').GRNOutput> {
    const [grn] = await this.dataSource.query(`
      SELECT
        grn.id, grn.branch_id, grn.purchase_order_id, grn.received_by, grn.received_at, grn.notes,
        si.supplier_id, s.name AS supplier_name,
        si.invoice_number AS supplier_invoice_number,
        si.invoice_date, si.due_date, si.total_amount, si.s3_pdf_key AS invoice_pdf_s3_key,
        si.status AS invoice_status,
        u.name AS received_by_name
      FROM goods_received_notes grn
      JOIN supplier_invoices si ON si.grn_id = grn.id
      JOIN suppliers s ON s.id = si.supplier_id
      JOIN users u ON u.id = grn.received_by
      WHERE grn.id = $1
    `, [grnId]) as Array<{
      id: string;
      branch_id: string;
      purchase_order_id: string | null;
      received_by: string;
      received_at: Date;
      notes: string | null;
      supplier_id: string;
      supplier_name: string;
      supplier_invoice_number: string;
      invoice_date: Date;
      due_date: Date | null;
      total_amount: number;
      invoice_pdf_s3_key: string | null;
      invoice_status: string;
      received_by_name: string;
    }>;

    if (!grn) throw new NotFoundException(`GRN ${grnId} not found`);

    // Get GRN items
    const items = await this.dataSource.query(`
      SELECT
        sm.id, sm.product_id, p.name AS product_name,
        sm.quantity, sm.batch_number, sm.expiry_date,
        pi.cdn_url AS image_s3_key,
        pch.unit_cost_pesewas
      FROM stock_movements sm
      JOIN products p ON p.id = sm.product_id
      LEFT JOIN product_images pi ON pi.product_id = sm.product_id
        AND pi.source = 'MANUAL_UPLOAD'
        AND pi.created_at >= sm.created_at - INTERVAL '1 hour'
      LEFT JOIN LATERAL (
        SELECT unit_cost_pesewas
        FROM product_cost_history
        WHERE source_type = 'GRN'
          AND source_reference_id = sm.reference_id
          AND product_id = sm.product_id
        ORDER BY observed_at DESC
        LIMIT 1
      ) pch ON true
      WHERE sm.reference_id = $1 AND sm.movement_type = 'PURCHASE'
    `, [grnId]) as Array<{
      id: string;
      product_id: string;
      product_name: string;
      quantity: number;
      batch_number: string;
      expiry_date: Date;
      image_s3_key: string | null;
      unit_cost_pesewas: number | null;
    }>;

    return {
      id: grn.id,
      branchId: grn.branch_id,
      supplierId: grn.supplier_id,
      supplierName: grn.supplier_name,
      purchaseOrderId: grn.purchase_order_id ?? undefined,
      supplierInvoiceNumber: grn.supplier_invoice_number,
      invoiceDate: grn.invoice_date,
      dueDate: grn.due_date ?? undefined,
      totalAmountPesewas: grn.total_amount,
      totalAmountFormatted: `GH₵${(grn.total_amount / 100).toFixed(2)}`,
      invoicePdfS3Key: grn.invoice_pdf_s3_key ?? undefined,
      items: items.map((i) => ({
        id: i.id,
        productId: i.product_id,
        productName: i.product_name,
        quantity: i.quantity,
        batchNumber: i.batch_number,
        expiryDate: i.expiry_date,
        imageS3Key: i.image_s3_key ?? undefined,
        unitCostPesewas: i.unit_cost_pesewas ?? undefined,
      })),
      notes: grn.notes ?? undefined,
      receivedBy: grn.received_by,
      receivedByName: grn.received_by_name,
      receivedAt: grn.received_at,
      isMatched: grn.invoice_status === 'MATCHED' || grn.invoice_status === 'PAID',
    };
  }

  /**
   * List GRNs for the current branch.
   * RBAC: owner, se_admin, manager, head_pharmacist.
   */
  async listGRNs(branchId: string, limit = 50): Promise<import('./dto/inventory.types').GRNOutput[]> {
    const rows = await this.dataSource.query(`
      SELECT
        grn.id,
        grn.branch_id,
        grn.purchase_order_id,
        grn.received_by,
        grn.received_at,
        grn.notes,
        si.supplier_id,
        s.name AS supplier_name,
        si.invoice_number AS supplier_invoice_number,
        si.invoice_date,
        si.due_date,
        si.total_amount,
        si.s3_pdf_key AS invoice_pdf_s3_key,
        si.status AS invoice_status,
        u.name AS received_by_name
      FROM goods_received_notes grn
      JOIN supplier_invoices si ON si.grn_id = grn.id
      JOIN suppliers s ON s.id = si.supplier_id
      JOIN users u ON u.id = grn.received_by
      WHERE grn.branch_id = $1
      ORDER BY grn.received_at DESC
      LIMIT $2
    `, [branchId, limit]) as Array<{
      id: string;
      branch_id: string;
      purchase_order_id: string | null;
      received_by: string;
      received_at: Date;
      notes: string | null;
      supplier_id: string;
      supplier_name: string;
      supplier_invoice_number: string;
      invoice_date: Date;
      due_date: Date | null;
      total_amount: number;
      invoice_pdf_s3_key: string | null;
      invoice_status: string;
      received_by_name: string;
    }>;

    return rows.map((grn) => ({
      id: grn.id,
      branchId: grn.branch_id,
      supplierId: grn.supplier_id,
      supplierName: grn.supplier_name,
      purchaseOrderId: grn.purchase_order_id ?? undefined,
      supplierInvoiceNumber: grn.supplier_invoice_number,
      invoiceDate: grn.invoice_date,
      dueDate: grn.due_date ?? undefined,
      totalAmountPesewas: grn.total_amount,
      totalAmountFormatted: `GH₵${(grn.total_amount / 100).toFixed(2)}`,
      invoicePdfS3Key: grn.invoice_pdf_s3_key ?? undefined,
      items: [],
      notes: grn.notes ?? undefined,
      receivedBy: grn.received_by,
      receivedByName: grn.received_by_name,
      receivedAt: grn.received_at,
      isMatched: grn.invoice_status === 'MATCHED' || grn.invoice_status === 'PAID',
    }));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private calcStatus(qty: number, reorder: number): string {
    if (qty === 0) return 'out';
    if (qty <= reorder * 0.2) return 'critical';
    if (qty <= reorder) return 'low';
    return 'ok';
  }
}
