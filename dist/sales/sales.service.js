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
var SalesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const graphql_1 = require("graphql");
const constants_1 = require("../config/constants");
const realtime_stock_service_1 = require("../inventory/realtime-stock.service");
const sales_effective_at_service_1 = require("./sales-effective-at.service");
const pharmacy_service_1 = require("../pharmacy/pharmacy.service");
const BRANCH_WIDE_SALES_ROLES = ['owner', 'se_admin', 'manager'];
let SalesService = SalesService_1 = class SalesService {
    constructor(dataSource, realtimeStock, effectiveSaleAt, pharmacy) {
        this.dataSource = dataSource;
        this.realtimeStock = realtimeStock;
        this.effectiveSaleAt = effectiveSaleAt;
        this.pharmacy = pharmacy;
        this.logger = new common_1.Logger(SalesService_1.name);
    }
    async createSale(input, actor) {
        const existing = await this.dataSource.query(`SELECT id FROM sales WHERE idempotency_key = $1`, [input.idempotencyKey]);
        if (existing[0]) {
            this.logger.log(`Idempotent sale: key=${input.idempotencyKey} already exists`);
            return this.getSale(existing[0].id, actor);
        }
        const soldAt = this.parseOptionalSoldAt(input.soldAt);
        const productIds = input.items.map((i) => i.productId);
        const products = await this.dataSource.query(`
      SELECT
        p.id, p.name, p.unit_price, p.classification, p.requires_rx, p.vat_exempt, p.supplier_id,
        COALESCE(inv.quantity_on_hand, 0) AS quantity_on_hand
      FROM products p
      LEFT JOIN inventory inv ON inv.product_id = p.id AND inv.branch_id = $1
      WHERE p.id = ANY($2) AND p.is_active = true
    `, [actor.branchId, productIds]);
        if (products.length !== productIds.length) {
            throw new common_1.NotFoundException('One or more products not found or inactive');
        }
        const productMap = new Map(products.map((p) => [p.id, p]));
        for (const item of input.items) {
            const product = productMap.get(item.productId);
            if (!product)
                throw new common_1.NotFoundException(`Product ${item.productId} not found`);
            if (product.requires_rx && !item.prescriptionId) {
                throw new graphql_1.GraphQLError('Prescription required for POM product', {
                    extensions: { code: 'FDA_POM_VIOLATION' },
                });
            }
            if (product.quantity_on_hand < item.quantity) {
                throw new common_1.BadRequestException(`Insufficient stock for ${product.name}: ${product.quantity_on_hand} available`);
            }
        }
        const pomRxIds = new Set();
        for (const item of input.items) {
            const product = productMap.get(item.productId);
            if (!(product === null || product === void 0 ? void 0 : product.requires_rx) || !item.prescriptionId)
                continue;
            await this.pharmacy.assertPrescriptionCoversProduct(item.prescriptionId, item.productId, item.quantity, actor.branchId);
            pomRxIds.add(item.prescriptionId);
        }
        if (pomRxIds.size > 1) {
            throw new common_1.BadRequestException('This sale references multiple prescriptions. Use separate checkouts for different prescriptions.');
        }
        const salePrescriptionId = pomRxIds.size === 1 ? [...pomRxIds][0] : null;
        let subtotalPesewas = 0;
        let vatPesewas = 0;
        for (const item of input.items) {
            const product = productMap.get(item.productId);
            if (!product)
                continue;
            const lineTotal = product.unit_price * item.quantity;
            subtotalPesewas += lineTotal;
            if (!product.vat_exempt) {
                vatPesewas += Math.round(lineTotal * constants_1.VAT_CONFIG.standardRate);
            }
        }
        const totalPesewas = subtotalPesewas + vatPesewas;
        const tenderedPesewas = input.tenders.reduce((sum, t) => sum + t.amountPesewas, 0);
        if (tenderedPesewas < totalPesewas) {
            throw new common_1.BadRequestException(`Tendered amount (${tenderedPesewas}) is less than total (${totalPesewas})`);
        }
        if (input.customerId) {
            const custRows = await this.dataSource.query(`SELECT 1 FROM customers WHERE id = $1 AND branch_id = $2 AND is_active = true`, [input.customerId, actor.branchId]);
            if (custRows.length === 0) {
                throw new common_1.BadRequestException('Customer not found in this branch');
            }
        }
        const { saleId, stockChanges } = await this.dataSource.transaction(async (em) => {
            var _a, _b;
            const [sale] = this.effectiveSaleAt.hasSoldAt
                ? (await em.query(`
        INSERT INTO sales (id, branch_id, cashier_id, customer_id, total_amount, vat_amount, status, idempotency_key, sold_at, prescription_id)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'COMPLETED', $6, $7, $8)
        RETURNING id
      `, [
                    actor.branchId,
                    actor.sub,
                    (_a = input.customerId) !== null && _a !== void 0 ? _a : null,
                    totalPesewas,
                    vatPesewas,
                    input.idempotencyKey,
                    soldAt,
                    salePrescriptionId,
                ]))
                : (await em.query(`
        INSERT INTO sales (id, branch_id, cashier_id, customer_id, total_amount, vat_amount, status, idempotency_key, prescription_id)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'COMPLETED', $6, $7)
        RETURNING id
      `, [
                    actor.branchId,
                    actor.sub,
                    (_b = input.customerId) !== null && _b !== void 0 ? _b : null,
                    totalPesewas,
                    vatPesewas,
                    input.idempotencyKey,
                    salePrescriptionId,
                ]));
            const pendingStockEvents = [];
            for (const item of input.items) {
                const product = productMap.get(item.productId);
                if (!product)
                    continue;
                await em.query(`
          INSERT INTO sale_items (id, sale_id, product_id, supplier_id, quantity, unit_price, vat_exempt)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
        `, [sale.id, item.productId, product.supplier_id, item.quantity, product.unit_price, product.vat_exempt]);
                const [updatedInventory] = await em.query(`
          UPDATE inventory SET quantity_on_hand = quantity_on_hand - $1, updated_at = NOW()
          WHERE product_id = $2 AND branch_id = $3
          RETURNING quantity_on_hand, reorder_level
        `, [item.quantity, item.productId, actor.branchId]);
                if (updatedInventory) {
                    pendingStockEvents.push({
                        branchId: actor.branchId,
                        productId: item.productId,
                        quantityOnHand: updatedInventory.quantity_on_hand,
                        reorderLevel: updatedInventory.reorder_level,
                    });
                }
                await em.query(`
          INSERT INTO stock_movements (id, product_id, branch_id, quantity, movement_type, reference_id, performed_by)
          VALUES (gen_random_uuid(), $1, $2, $3, 'SALE', $4, $5)
        `, [item.productId, actor.branchId, -item.quantity, sale.id, actor.sub]);
            }
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
        const lastByProduct = new Map();
        for (const event of stockChanges) {
            lastByProduct.set(`${event.branchId}:${event.productId}`, event);
        }
        for (const event of lastByProduct.values()) {
            this.realtimeStock.publishStockChanged(event);
        }
        this.logger.log(`Sale created: id=${saleId} total=${totalPesewas} by cashier=${actor.sub}`);
        return this.getSale(saleId, actor);
    }
    async getSale(saleId, actor) {
        const soldAtSelect = this.effectiveSaleAt.hasSoldAt ? 's.sold_at' : 'NULL::timestamptz AS sold_at';
        const [sale] = await this.dataSource.query(`
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
    `, [saleId]);
        if (!sale)
            throw new common_1.NotFoundException(`Sale ${saleId} not found`);
        if (sale.branch_id !== actor.branchId) {
            throw new common_1.ForbiddenException('Sale is not in your branch');
        }
        const branchWide = BRANCH_WIDE_SALES_ROLES.includes(actor.role);
        if (!branchWide && sale.cashier_id !== actor.sub) {
            throw new common_1.ForbiddenException('You can only view your own sales');
        }
        const items = await this.dataSource.query(`
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
    `, [saleId, sale.branch_id]);
        return this.mapSaleOutput(sale, items);
    }
    async getDailySummary(branchId, date) {
        var _a, _b, _c;
        const targetDate = date !== null && date !== void 0 ? date : new Date().toISOString().split('T')[0];
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
    `, [branchId, targetDate]);
        const count = (_a = row === null || row === void 0 ? void 0 : row.sales_count) !== null && _a !== void 0 ? _a : 0;
        const revenue = (_b = row === null || row === void 0 ? void 0 : row.total_revenue) !== null && _b !== void 0 ? _b : 0;
        const vat = (_c = row === null || row === void 0 ? void 0 : row.vat_collected) !== null && _c !== void 0 ? _c : 0;
        return {
            salesCount: count,
            totalRevenuePesewas: revenue,
            totalRevenueFormatted: this.formatGhs(revenue),
            vatCollectedPesewas: vat,
            averageSaleGhs: count > 0 ? revenue / 100 / count : 0,
        };
    }
    async getRecentSales(actor, limit = 20) {
        const ownSalesOnly = !BRANCH_WIDE_SALES_ROLES.includes(actor.role);
        const orderAt = this.effectiveSaleAt.hasSoldAt ? 'COALESCE(sold_at, created_at)' : 'created_at';
        const rowSelect = this.effectiveSaleAt.hasSoldAt
            ? 'id, branch_id, cashier_id, total_amount, vat_amount, status, idempotency_key, sold_at, created_at'
            : 'id, branch_id, cashier_id, total_amount, vat_amount, status, idempotency_key, NULL::timestamptz AS sold_at, created_at';
        const sales = ownSalesOnly
            ? (await this.dataSource.query(`
        SELECT ${rowSelect}
        FROM sales
        WHERE branch_id = $1 AND status = 'COMPLETED' AND cashier_id = $3
        ORDER BY ${orderAt} DESC
        LIMIT $2
      `, [actor.branchId, limit, actor.sub]))
            : (await this.dataSource.query(`
        SELECT ${rowSelect}
        FROM sales
        WHERE branch_id = $1 AND status = 'COMPLETED'
        ORDER BY ${orderAt} DESC
        LIMIT $2
      `, [actor.branchId, limit]));
        return Promise.all(sales.map((s) => this.getSale(s.id, actor)));
    }
    parseOptionalSoldAt(iso) {
        if (iso == null || String(iso).trim() === '')
            return null;
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) {
            throw new common_1.BadRequestException('soldAt must be a valid ISO 8601 datetime');
        }
        const now = Date.now();
        const maxFutureMs = 15 * 60 * 1000;
        const maxPastMs = 400 * 24 * 60 * 60 * 1000;
        if (d.getTime() > now + maxFutureMs) {
            throw new common_1.BadRequestException('soldAt cannot be more than 15 minutes in the future');
        }
        if (d.getTime() < now - maxPastMs) {
            throw new common_1.BadRequestException('soldAt is too far in the past');
        }
        return d;
    }
    mapSaleOutput(sale, items) {
        var _a;
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
            soldAt: (_a = sale.sold_at) !== null && _a !== void 0 ? _a : null,
            createdAt: sale.created_at,
            items: items.map((i) => {
                var _a, _b, _c;
                return ({
                    id: i.id,
                    productId: i.product_id,
                    productName: i.product_name,
                    classification: (_a = i.classification) !== null && _a !== void 0 ? _a : 'OTC',
                    quantity: i.quantity,
                    unitPricePesewas: i.unit_price,
                    vatExempt: i.vat_exempt,
                    supplierId: (_b = i.supplier_id) !== null && _b !== void 0 ? _b : undefined,
                    supplierName: (_c = i.supplier_name) !== null && _c !== void 0 ? _c : undefined,
                    stockAfterSale: i.stock_after_sale,
                    reorderLevel: i.reorder_level,
                    stockStatus: this.calcStockStatus(i.stock_after_sale, i.reorder_level),
                });
            }),
        };
    }
    formatGhs(pesewas) {
        return `GH₵${(pesewas / 100).toFixed(2)}`;
    }
    calcStockStatus(quantityOnHand, reorderLevel) {
        if (quantityOnHand <= 0)
            return 'out';
        if (quantityOnHand <= Math.max(1, Math.floor(reorderLevel * 0.2)))
            return 'critical';
        if (quantityOnHand <= reorderLevel)
            return 'low';
        return 'ok';
    }
};
exports.SalesService = SalesService;
exports.SalesService = SalesService = SalesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        realtime_stock_service_1.RealtimeStockService,
        sales_effective_at_service_1.SalesEffectiveAtService,
        pharmacy_service_1.PharmacyService])
], SalesService);
//# sourceMappingURL=sales.service.js.map