"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var InventoryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const realtime_stock_service_1 = require("./realtime-stock.service");
let InventoryService = InventoryService_1 = class InventoryService {
    constructor(dataSource, realtimeStock) {
        this.dataSource = dataSource;
        this.realtimeStock = realtimeStock;
        this.logger = new common_1.Logger(InventoryService_1.name);
    }
    async listInventory(branchId) {
        const rows = await this.dataSource.query(`
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        p.classification,
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
      GROUP BY p.id, p.name, p.classification, inv.quantity_on_hand, inv.reorder_level, p.supplier_id, s.name
      ORDER BY p.name ASC
    `, [branchId]);
        return rows.map((r) => {
            var _a, _b, _c;
            return ({
                productId: r.product_id,
                productName: r.product_name,
                classification: r.classification,
                quantityOnHand: r.quantity_on_hand,
                reorderLevel: r.reorder_level,
                stockStatus: this.calcStatus(r.quantity_on_hand, r.reorder_level),
                nearestExpiry: (_a = r.nearest_expiry) !== null && _a !== void 0 ? _a : undefined,
                supplierId: (_b = r.supplier_id) !== null && _b !== void 0 ? _b : undefined,
                supplierName: (_c = r.supplier_name) !== null && _c !== void 0 ? _c : undefined,
            });
        });
    }
    async getLowStockAlerts(branchId) {
        const rows = await this.dataSource.query(`
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        COALESCE(inv.quantity_on_hand, 0) AS quantity_on_hand,
        COALESCE(inv.reorder_level, 10) AS reorder_level
      FROM products p
      LEFT JOIN inventory inv ON inv.product_id = p.id AND inv.branch_id = $1
      WHERE p.is_active = true
        AND COALESCE(inv.quantity_on_hand, 0) <= COALESCE(inv.reorder_level, 10)
      ORDER BY quantity_on_hand ASC
    `, [branchId]);
        return rows.map((r) => ({
            productId: r.product_id,
            productName: r.product_name,
            quantityOnHand: r.quantity_on_hand,
            reorderLevel: r.reorder_level,
            status: this.calcStatus(r.quantity_on_hand, r.reorder_level),
        }));
    }
    async adjustStock(input, actor) {
        var _a, _b;
        const [product] = await this.dataSource.query(`SELECT id, name FROM products WHERE id = $1 AND is_active = true`, [input.productId]);
        if (!product)
            throw new common_1.NotFoundException(`Product ${input.productId} not found`);
        await this.dataSource.query(`
      INSERT INTO inventory (id, product_id, branch_id, quantity_on_hand, reorder_level)
      VALUES (gen_random_uuid(), $1, $2, 0, 10)
      ON CONFLICT (product_id, branch_id) DO NOTHING
    `, [input.productId, actor.branchId]);
        const [inv] = await this.dataSource.query(`SELECT quantity_on_hand FROM inventory WHERE product_id = $1 AND branch_id = $2`, [input.productId, actor.branchId]);
        const newQty = ((_a = inv === null || inv === void 0 ? void 0 : inv.quantity_on_hand) !== null && _a !== void 0 ? _a : 0) + input.quantityDelta;
        if (newQty < 0) {
            throw new common_1.BadRequestException(`Adjustment would result in negative stock (${newQty}). Current: ${(_b = inv === null || inv === void 0 ? void 0 : inv.quantity_on_hand) !== null && _b !== void 0 ? _b : 0}`);
        }
        await this.dataSource.transaction(async (em) => {
            var _a, _b;
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
                (_a = input.batchNumber) !== null && _a !== void 0 ? _a : null,
                (_b = input.expiryDate) !== null && _b !== void 0 ? _b : null,
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
        const items = await this.listInventory(actor.branchId);
        const item = items.find((i) => i.productId === input.productId);
        if (!item)
            throw new common_1.NotFoundException('Inventory item not found after update');
        this.realtimeStock.publishStockChanged({
            branchId: actor.branchId,
            productId: item.productId,
            quantityOnHand: item.quantityOnHand,
            reorderLevel: item.reorderLevel,
        });
        return item;
    }
    async receiveStock(input, actor) {
        const [product] = await this.dataSource.query(`SELECT id, name FROM products WHERE id = $1 AND is_active = true`, [input.productId]);
        if (!product)
            throw new common_1.NotFoundException(`Product ${input.productId} not found`);
        await this.dataSource.query(`
      INSERT INTO inventory (id, product_id, branch_id, quantity_on_hand, reorder_level)
      VALUES (gen_random_uuid(), $1, $2, 0, 10)
      ON CONFLICT (product_id, branch_id) DO NOTHING
    `, [input.productId, actor.branchId]);
        await this.dataSource.transaction(async (em) => {
            var _a, _b, _c, _d;
            await em.query(`
        UPDATE inventory SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
        WHERE product_id = $2 AND branch_id = $3
      `, [input.quantity, input.productId, actor.branchId]);
            await em.query(`
        INSERT INTO stock_movements (
          id, product_id, branch_id, batch_number, expiry_date, quantity, movement_type, reference_id, performed_by
        )
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'PURCHASE', NULL, $6)
      `, [
                input.productId,
                actor.branchId,
                (_a = input.batchNumber) !== null && _a !== void 0 ? _a : null,
                (_b = input.expiryDate) !== null && _b !== void 0 ? _b : null,
                input.quantity,
                actor.sub,
            ]);
            await em.query(`
        INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
        VALUES (gen_random_uuid(), $1, $2, 'STOCK_RECEIVED', 'product', $3, $4)
      `, [
                actor.branchId,
                actor.sub,
                input.productId,
                JSON.stringify({
                    quantity: input.quantity,
                    purchase_order_id: (_c = input.purchaseOrderId) !== null && _c !== void 0 ? _c : null,
                    batch_number: (_d = input.batchNumber) !== null && _d !== void 0 ? _d : null,
                }),
            ]);
        });
        this.logger.log(`Stock received: product=${input.productId} qty=${input.quantity} by=${actor.sub}`);
        const items = await this.listInventory(actor.branchId);
        const item = items.find((i) => i.productId === input.productId);
        if (!item)
            throw new common_1.NotFoundException('Inventory item not found after update');
        this.realtimeStock.publishStockChanged({
            branchId: actor.branchId,
            productId: item.productId,
            quantityOnHand: item.quantityOnHand,
            reorderLevel: item.reorderLevel,
        });
        return item;
    }
    async getStockMovements(productId, branchId, limit = 50) {
        const safeLimit = Math.min(500, Math.max(1, Math.trunc(Number(limit) || 50)));
        const rows = await this.dataSource.query(`
      SELECT sm.id, sm.product_id, p.name AS product_name, sm.quantity,
             sm.movement_type, sm.batch_number, sm.expiry_date, sm.created_at
      FROM stock_movements sm
      JOIN products p ON p.id = sm.product_id
      WHERE sm.product_id = $1 AND sm.branch_id = $2
      ORDER BY sm.created_at DESC
      LIMIT $3
    `, [productId, branchId, safeLimit]);
        return rows.map((r) => {
            var _a, _b;
            return ({
                id: r.id,
                productId: r.product_id,
                productName: r.product_name,
                quantity: r.quantity,
                movementType: r.movement_type,
                batchNumber: (_a = r.batch_number) !== null && _a !== void 0 ? _a : undefined,
                expiryDate: (_b = r.expiry_date) !== null && _b !== void 0 ? _b : undefined,
                createdAt: r.created_at,
            });
        });
    }
    async createGRN(input, actor) {
        const [supplier] = await this.dataSource.query(`SELECT id, name, payment_terms FROM suppliers WHERE id = $1 AND is_active = true`, [input.supplierId]);
        if (!supplier)
            throw new common_1.NotFoundException(`Supplier ${input.supplierId} not found`);
        let dueDate = input.dueDate;
        if (!dueDate && supplier.payment_terms) {
            const days = supplier.payment_terms === 'NET_30' ? 30 : supplier.payment_terms === 'NET_60' ? 60 : 30;
            const due = new Date(input.invoiceDate);
            due.setDate(due.getDate() + days);
            dueDate = due.toISOString().split('T')[0];
        }
        const productIds = input.items.map((i) => i.productId);
        const products = await this.dataSource.query(`
      SELECT id, name FROM products WHERE id = ANY($1) AND is_active = true
    `, [productIds]);
        if (products.length !== productIds.length) {
            throw new common_1.NotFoundException('One or more products not found or inactive');
        }
        const totalReceivedQty = input.items.reduce((sum, item) => sum + item.quantity, 0);
        const inferredUnitCostPesewas = totalReceivedQty > 0
            ? Math.max(1, Math.round(input.totalAmountPesewas / totalReceivedQty))
            : 1;
        const { grnId, changedProductIds } = await this.dataSource.transaction(async (em) => {
            var _a, _b, _c, _d, _e;
            const [grn] = await em.query(`
        INSERT INTO goods_received_notes (
          id, purchase_order_id, branch_id, received_by, notes
        )
        VALUES (gen_random_uuid(), $1, $2, $3, $4)
        RETURNING id
      `, [
                (_a = input.purchaseOrderId) !== null && _a !== void 0 ? _a : null,
                actor.branchId,
                actor.sub,
                (_b = input.notes) !== null && _b !== void 0 ? _b : null,
            ]);
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
                dueDate !== null && dueDate !== void 0 ? dueDate : null,
                input.totalAmountPesewas,
                (_c = input.invoicePdfS3Key) !== null && _c !== void 0 ? _c : null,
            ]);
            const changedIds = new Set();
            for (const item of input.items) {
                const lineUnitCostPesewas = (_d = item.unitCostPesewas) !== null && _d !== void 0 ? _d : inferredUnitCostPesewas;
                await em.query(`
          INSERT INTO inventory (id, product_id, branch_id, quantity_on_hand, reorder_level)
          VALUES (gen_random_uuid(), $1, $2, 0, 10)
          ON CONFLICT (product_id, branch_id) DO NOTHING
        `, [item.productId, actor.branchId]);
                await em.query(`
          UPDATE inventory
          SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
          WHERE product_id = $2 AND branch_id = $3
        `, [item.quantity, item.productId, actor.branchId]);
                changedIds.add(item.productId);
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
                if (item.imageS3Key) {
                    const inserted = (await em.query(`
            INSERT INTO product_images (
              id, product_id, cdn_url, url_thumb, source, is_approved
            )
            VALUES (gen_random_uuid(), $1, $2, $2, 'MANUAL_UPLOAD', true)
            RETURNING id
          `, [item.productId, item.imageS3Key]));
                    const imgId = (_e = inserted[0]) === null || _e === void 0 ? void 0 : _e.id;
                    if (imgId) {
                        await em.query(`UPDATE products SET image_id = $1 WHERE id = $2`, [imgId, item.productId]);
                    }
                }
            }
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
      `, [actor.branchId, changedProductIds]);
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
    async getGRN(grnId) {
        var _a, _b, _c, _d;
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
    `, [grnId]);
        if (!grn)
            throw new common_1.NotFoundException(`GRN ${grnId} not found`);
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
    `, [grnId]);
        return {
            id: grn.id,
            branchId: grn.branch_id,
            supplierId: grn.supplier_id,
            supplierName: grn.supplier_name,
            purchaseOrderId: (_a = grn.purchase_order_id) !== null && _a !== void 0 ? _a : undefined,
            supplierInvoiceNumber: grn.supplier_invoice_number,
            invoiceDate: grn.invoice_date,
            dueDate: (_b = grn.due_date) !== null && _b !== void 0 ? _b : undefined,
            totalAmountPesewas: grn.total_amount,
            totalAmountFormatted: `GH₵${(grn.total_amount / 100).toFixed(2)}`,
            invoicePdfS3Key: (_c = grn.invoice_pdf_s3_key) !== null && _c !== void 0 ? _c : undefined,
            items: items.map((i) => {
                var _a, _b;
                return ({
                    id: i.id,
                    productId: i.product_id,
                    productName: i.product_name,
                    quantity: i.quantity,
                    batchNumber: i.batch_number,
                    expiryDate: i.expiry_date,
                    imageS3Key: (_a = i.image_s3_key) !== null && _a !== void 0 ? _a : undefined,
                    unitCostPesewas: (_b = i.unit_cost_pesewas) !== null && _b !== void 0 ? _b : undefined,
                });
            }),
            notes: (_d = grn.notes) !== null && _d !== void 0 ? _d : undefined,
            receivedBy: grn.received_by,
            receivedByName: grn.received_by_name,
            receivedAt: grn.received_at,
            isMatched: grn.invoice_status === 'MATCHED' || grn.invoice_status === 'PAID',
        };
    }
    async listGRNs(branchId, limit = 50) {
        const grns = await this.dataSource.query(`
      SELECT grn.id
      FROM goods_received_notes grn
      WHERE grn.branch_id = $1
      ORDER BY grn.received_at DESC
      LIMIT $2
    `, [branchId, limit]);
        return Promise.all(grns.map((g) => this.getGRN(g.id)));
    }
    calcStatus(qty, reorder) {
        if (qty === 0)
            return 'out';
        if (qty <= reorder * 0.2)
            return 'critical';
        if (qty <= reorder)
            return 'low';
        return 'ok';
    }
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = InventoryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        realtime_stock_service_1.RealtimeStockService])
], InventoryService);
//# sourceMappingURL=inventory.service.js.map