import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Product } from './entities/product.entity';
import {
  UpdatePriceInput,
  BulkUpdatePriceInput,
  SetExchangeRateInput,
  PriceDisplay,
  PriceHistory,
  ExchangeRate,
  PriceUpdateResult,
  ProductCostSnapshot,
} from './dto/price.types';
import { JwtUser } from '../auth/decorators/current-user.decorator';

// RBAC: only these roles can modify prices
const PRICE_MANAGER_ROLES = ['owner', 'se_admin', 'manager'] as const;
type PriceManagerRole = (typeof PRICE_MANAGER_ROLES)[number];

const EXCHANGE_RATE_CACHE_KEY = 'price:usd_ghs_rate';
const EXCHANGE_RATE_TTL = 3_600_000; // 1 hour in ms

interface PriceHistoryRow {
  id: string;
  product_id: string;
  product_name: string;
  old_price: number;
  new_price: number;
  reason: string | null;
  changed_by_name: string;
  changed_at: Date;
}

interface ExchangeRateRow {
  rate: number;
  updated_at: Date;
  updated_by_name: string;
}

interface LatestCostRow {
  product_id: string;
  unit_cost_pesewas: number;
  supplier_id: string | null;
  supplier_name: string | null;
  source_type: string;
  observed_at: Date;
}

@Injectable()
export class PriceService {
  private readonly logger = new Logger(PriceService.name);

  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  // ── Currency formatting ───────────────────────────────────────────────────

  /**
   * Format pesewas to GHS display string.
   * GH₵1.00 = 100 pesewas — always integer storage, never float.
   */
  formatGhs(pesewas: number): string {
    return `GH₵${(pesewas / 100).toFixed(2)}`;
  }

  formatUsd(usd: number): string {
    return `$${usd.toFixed(2)}`;
  }

  async buildPriceDisplay(pesewas: number): Promise<PriceDisplay> {
    const rate = await this.getExchangeRate();
    const usd = rate ? pesewas / 100 / rate.usdToGhsRate : undefined;

    return {
      ghsPesewas: pesewas,
      ghsFormatted: this.formatGhs(pesewas),
      usdEquivalent: usd,
      usdFormatted: usd !== undefined ? this.formatUsd(usd) : undefined,
      exchangeRate: rate?.usdToGhsRate,
    };
  }

  // ── Price update ──────────────────────────────────────────────────────────

  /**
   * Update a single product price.
   * RBAC: owner, se_admin, manager only.
   */
  async updatePrice(input: UpdatePriceInput, actor: JwtUser): Promise<PriceUpdateResult> {
    // RBAC: owner, se_admin, manager only — cashiers/pharmacists cannot change prices
    this.assertPriceManager(actor);

    const product = await this.products.findOne({
      where: { id: input.productId, isActive: true },
    });
    if (!product) throw new NotFoundException(`Product ${input.productId} not found`);

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

    // Update price + record history in a transaction
    await this.dataSource.transaction(async (em) => {
      await em.update(Product, { id: product.id }, { unitPrice: newPrice });

      await em.query(`
        INSERT INTO product_price_history (id, product_id, old_price, new_price, changed_by, changed_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
      `, [product.id, oldPrice, newPrice, actor.sub]);

      // Audit log — no PHI
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
          reason: input.reason ?? null,
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

  /**
   * Bulk update prices for multiple products.
   * RBAC: owner, se_admin, manager only.
   */
  async bulkUpdatePrices(input: BulkUpdatePriceInput, actor: JwtUser): Promise<PriceUpdateResult[]> {
    this.assertPriceManager(actor);
    return Promise.all(input.updates.map((u) => this.updatePrice(u, actor)));
  }

  // ── Exchange rate ─────────────────────────────────────────────────────────

  /**
   * Set USD/GHS exchange rate.
   * RBAC: owner, se_admin only — managers cannot change exchange rate.
   */
  async setExchangeRate(input: SetExchangeRateInput, actor: JwtUser): Promise<ExchangeRate> {
    // RBAC: owner, se_admin only — exchange rate is a system-level setting
    if (!['owner', 'se_admin'].includes(actor.role)) {
      throw new ForbiddenException('Only owner or se_admin can update the exchange rate');
    }

    await this.dataSource.query(`
      INSERT INTO exchange_rates (id, currency_from, currency_to, rate, updated_by)
      VALUES (gen_random_uuid(), 'USD', 'GHS', $1, $2)
    `, [input.usdToGhsRate, actor.sub]);

    // Invalidate cache
    await this.cache.del(EXCHANGE_RATE_CACHE_KEY);

    this.logger.log(`Exchange rate updated: 1 USD = GH₵${input.usdToGhsRate} by user=${actor.sub}`);

    const actorName = await this.getUserName(actor.sub);
    return {
      usdToGhsRate: input.usdToGhsRate,
      updatedAt: new Date(),
      updatedByName: actorName,
    };
  }

  async getExchangeRate(): Promise<ExchangeRate | null> {
    // Check cache first
    const cached = await this.cache.get<ExchangeRate>(EXCHANGE_RATE_CACHE_KEY);
    if (cached) return cached;

    const rows = await this.dataSource.query(`
      SELECT er.rate, er.created_at AS updated_at, u.name AS updated_by_name
      FROM exchange_rates er
      LEFT JOIN users u ON u.id = er.updated_by
      WHERE er.currency_from = 'USD' AND er.currency_to = 'GHS'
      ORDER BY er.created_at DESC
      LIMIT 1
    `) as ExchangeRateRow[];

    if (!rows[0]) return null;

    const result: ExchangeRate = {
      usdToGhsRate: Number(rows[0].rate),
      updatedAt: rows[0].updated_at,
      updatedByName: rows[0].updated_by_name,
    };

    await this.cache.set(EXCHANGE_RATE_CACHE_KEY, result, EXCHANGE_RATE_TTL);
    return result;
  }

  // ── Price history ─────────────────────────────────────────────────────────

  async getPriceHistory(productId: string, limit = 20): Promise<PriceHistory[]> {
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
    `, [productId, limit]) as PriceHistoryRow[];

    return rows.map((r) => ({
      id: r.id,
      productId: r.product_id,
      productName: r.product_name,
      oldPriceGhsPesewas: r.old_price,
      oldPriceFormatted: this.formatGhs(r.old_price),
      newPriceGhsPesewas: r.new_price,
      newPriceFormatted: this.formatGhs(r.new_price),
      reason: r.reason ?? undefined,
      changedByName: r.changed_by_name ?? 'Unknown',
      changedAt: r.changed_at,
    }));
  }

  async getLatestProductCosts(
    productIds: string[],
    branchId: string,
  ): Promise<ProductCostSnapshot[]> {
    if (productIds.length === 0) return [];

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
    `, [branchId, productIds]) as LatestCostRow[];

    return rows.map((row) => ({
      productId: row.product_id,
      latestCostPesewas: row.unit_cost_pesewas,
      latestCostFormatted: this.formatGhs(row.unit_cost_pesewas),
      supplierId: row.supplier_id ?? undefined,
      supplierName: row.supplier_name ?? undefined,
      sourceType: row.source_type,
      observedAt: row.observed_at,
    }));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private assertPriceManager(actor: JwtUser): void {
    // RBAC: owner, se_admin, manager only — cashiers/pharmacists cannot change prices
    if (!(PRICE_MANAGER_ROLES as readonly string[]).includes(actor.role)) {
      throw new ForbiddenException(
        `Role '${actor.role}' cannot update prices. Required: ${PRICE_MANAGER_ROLES.join(', ')}`,
      );
    }
  }

  private async getUserName(userId: string): Promise<string> {
    const rows = await this.dataSource.query(
      `SELECT name FROM users WHERE id = $1`,
      [userId],
    ) as Array<{ name: string }>;
    return rows[0]?.name ?? 'Unknown';
  }
}
