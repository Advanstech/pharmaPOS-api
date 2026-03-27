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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PriceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriceService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const common_2 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const product_entity_1 = require("./entities/product.entity");
const PRICE_MANAGER_ROLES = ['owner', 'se_admin', 'manager'];
const EXCHANGE_RATE_CACHE_KEY = 'price:usd_ghs_rate';
const EXCHANGE_RATE_TTL = 3600000;
let PriceService = PriceService_1 = class PriceService {
    constructor(products, dataSource, cache) {
        this.products = products;
        this.dataSource = dataSource;
        this.cache = cache;
        this.logger = new common_1.Logger(PriceService_1.name);
    }
    formatGhs(pesewas) {
        return `GH₵${(pesewas / 100).toFixed(2)}`;
    }
    formatUsd(usd) {
        return `$${usd.toFixed(2)}`;
    }
    async buildPriceDisplay(pesewas) {
        const rate = await this.getExchangeRate();
        const usd = rate ? pesewas / 100 / rate.usdToGhsRate : undefined;
        return {
            ghsPesewas: pesewas,
            ghsFormatted: this.formatGhs(pesewas),
            usdEquivalent: usd,
            usdFormatted: usd !== undefined ? this.formatUsd(usd) : undefined,
            exchangeRate: rate === null || rate === void 0 ? void 0 : rate.usdToGhsRate,
        };
    }
    async updatePrice(input, actor) {
        this.assertPriceManager(actor);
        const product = await this.products.findOne({
            where: { id: input.productId, isActive: true },
        });
        if (!product)
            throw new common_1.NotFoundException(`Product ${input.productId} not found`);
        const oldPrice = product.unitPrice;
        const newPrice = input.unitPriceGhsPesewas;
        if (oldPrice === newPrice) {
            return {
                productId: product.id,
                productName: product.name,
                price: await this.buildPriceDisplay(newPrice),
                updatedAt: product.updatedAt,
            };
        }
        await this.dataSource.transaction(async (em) => {
            var _a;
            await em.update(product_entity_1.Product, { id: product.id }, { unitPrice: newPrice });
            await em.query(`
        INSERT INTO product_price_history (id, product_id, old_price, new_price, changed_by, changed_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
      `, [product.id, oldPrice, newPrice, actor.sub]);
            await em.query(`
        INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
        VALUES (gen_random_uuid(), $1, $2, 'PRICE_UPDATED', 'product', $3, $4)
      `, [
                actor.branchId,
                actor.sub,
                product.id,
                JSON.stringify({
                    old_price_ghs: this.formatGhs(oldPrice),
                    new_price_ghs: this.formatGhs(newPrice),
                    reason: (_a = input.reason) !== null && _a !== void 0 ? _a : null,
                }),
            ]);
        });
        this.logger.log(`Price updated: product=${product.id} ${this.formatGhs(oldPrice)} → ${this.formatGhs(newPrice)} by user=${actor.sub}`);
        product.unitPrice = newPrice;
        return {
            productId: product.id,
            productName: product.name,
            price: await this.buildPriceDisplay(newPrice),
            updatedAt: new Date(),
        };
    }
    async bulkUpdatePrices(input, actor) {
        this.assertPriceManager(actor);
        return Promise.all(input.updates.map((u) => this.updatePrice(u, actor)));
    }
    async setExchangeRate(input, actor) {
        if (!['owner', 'se_admin'].includes(actor.role)) {
            throw new common_1.ForbiddenException('Only owner or se_admin can update the exchange rate');
        }
        await this.dataSource.query(`
      INSERT INTO exchange_rates (id, currency_from, currency_to, rate, updated_by)
      VALUES (gen_random_uuid(), 'USD', 'GHS', $1, $2)
    `, [input.usdToGhsRate, actor.sub]);
        await this.cache.del(EXCHANGE_RATE_CACHE_KEY);
        this.logger.log(`Exchange rate updated: 1 USD = GH₵${input.usdToGhsRate} by user=${actor.sub}`);
        const actorName = await this.getUserName(actor.sub);
        return {
            usdToGhsRate: input.usdToGhsRate,
            updatedAt: new Date(),
            updatedByName: actorName,
        };
    }
    async getExchangeRate() {
        const cached = await this.cache.get(EXCHANGE_RATE_CACHE_KEY);
        if (cached)
            return cached;
        const rows = await this.dataSource.query(`
      SELECT er.rate, er.created_at AS updated_at, u.name AS updated_by_name
      FROM exchange_rates er
      LEFT JOIN users u ON u.id = er.updated_by
      WHERE er.currency_from = 'USD' AND er.currency_to = 'GHS'
      ORDER BY er.created_at DESC
      LIMIT 1
    `);
        if (!rows[0])
            return null;
        const result = {
            usdToGhsRate: Number(rows[0].rate),
            updatedAt: rows[0].updated_at,
            updatedByName: rows[0].updated_by_name,
        };
        await this.cache.set(EXCHANGE_RATE_CACHE_KEY, result, EXCHANGE_RATE_TTL);
        return result;
    }
    async getPriceHistory(productId, limit = 20) {
        const rows = await this.dataSource.query(`
      SELECT
        ph.id,
        ph.product_id,
        p.name AS product_name,
        ph.old_price,
        ph.new_price,
        al.metadata->>'reason' AS reason,
        u.name AS changed_by_name,
        ph.changed_at
      FROM product_price_history ph
      JOIN products p ON p.id = ph.product_id
      LEFT JOIN users u ON u.id = ph.changed_by
      LEFT JOIN audit_logs al ON al.entity_id = ph.product_id
        AND al.type = 'PRICE_UPDATED'
        AND al.created_at::date = ph.changed_at::date
      WHERE ph.product_id = $1
      ORDER BY ph.changed_at DESC
      LIMIT $2
    `, [productId, limit]);
        return rows.map((r) => {
            var _a, _b;
            return ({
                id: r.id,
                productId: r.product_id,
                productName: r.product_name,
                oldPriceGhsPesewas: r.old_price,
                oldPriceFormatted: this.formatGhs(r.old_price),
                newPriceGhsPesewas: r.new_price,
                newPriceFormatted: this.formatGhs(r.new_price),
                reason: (_a = r.reason) !== null && _a !== void 0 ? _a : undefined,
                changedByName: (_b = r.changed_by_name) !== null && _b !== void 0 ? _b : 'Unknown',
                changedAt: r.changed_at,
            });
        });
    }
    async getLatestProductCosts(productIds, branchId) {
        if (productIds.length === 0)
            return [];
        const rows = await this.dataSource.query(`
      SELECT DISTINCT ON (pch.product_id)
        pch.product_id,
        pch.unit_cost_pesewas,
        pch.supplier_id,
        s.name AS supplier_name,
        pch.source_type,
        pch.observed_at
      FROM product_cost_history pch
      LEFT JOIN suppliers s ON s.id = pch.supplier_id
      WHERE pch.branch_id = $1
        AND pch.product_id = ANY($2)
      ORDER BY pch.product_id, pch.observed_at DESC
    `, [branchId, productIds]);
        return rows.map((row) => {
            var _a, _b;
            return ({
                productId: row.product_id,
                latestCostPesewas: row.unit_cost_pesewas,
                latestCostFormatted: this.formatGhs(row.unit_cost_pesewas),
                supplierId: (_a = row.supplier_id) !== null && _a !== void 0 ? _a : undefined,
                supplierName: (_b = row.supplier_name) !== null && _b !== void 0 ? _b : undefined,
                sourceType: row.source_type,
                observedAt: row.observed_at,
            });
        });
    }
    assertPriceManager(actor) {
        if (!PRICE_MANAGER_ROLES.includes(actor.role)) {
            throw new common_1.ForbiddenException(`Role '${actor.role}' cannot update prices. Required: ${PRICE_MANAGER_ROLES.join(', ')}`);
        }
    }
    async getUserName(userId) {
        var _a, _b;
        const rows = await this.dataSource.query(`SELECT name FROM users WHERE id = $1`, [userId]);
        return (_b = (_a = rows[0]) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : 'Unknown';
    }
};
exports.PriceService = PriceService;
exports.PriceService = PriceService = PriceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(product_entity_1.Product)),
    __param(2, (0, common_2.Inject)(cache_manager_1.CACHE_MANAGER)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource, Object])
], PriceService);
//# sourceMappingURL=price.service.js.map