import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { CreateSupplierInput, UpdateSupplierInput } from './dto/supplier.input';
import { SupplierRestockWatch } from './dto/supplier-watch.types';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    private readonly dataSource: DataSource,
  ) {}

  async listSuppliers(): Promise<Supplier[]> {
    return this.supplierRepo.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  async getSupplierById(id: string): Promise<Supplier> {
    const supplier = await this.supplierRepo.findOne({ where: { id } });
    if (!supplier) throw new NotFoundException(`Supplier ${id} not found`);
    return supplier;
  }

  async createSupplier(input: CreateSupplierInput): Promise<Supplier> {
    const supplier = this.supplierRepo.create({ ...input });
    return this.supplierRepo.save(supplier);
  }

  async updateSupplier(id: string, input: UpdateSupplierInput): Promise<Supplier> {
    const supplier = await this.getSupplierById(id);
    Object.assign(supplier, input);
    return this.supplierRepo.save(supplier);
  }

  async deleteSupplier(id: string): Promise<boolean> {
    const supplier = await this.getSupplierById(id);
    supplier.isActive = false;
    await this.supplierRepo.save(supplier);
    return true;
  }

  async suspendSupplier(id: string): Promise<boolean> {
    const supplier = await this.getSupplierById(id);
    supplier.isActive = false;
    await this.supplierRepo.save(supplier);
    return true;
  }

  async reactivateSupplier(id: string): Promise<boolean> {
    const supplier = await this.supplierRepo.findOne({ where: { id } });
    if (!supplier) throw new NotFoundException(`Supplier ${id} not found`);
    supplier.isActive = true;
    await this.supplierRepo.save(supplier);
    return true;
  }

  async deleteSupplierWithProducts(id: string): Promise<boolean> {
    await this.getSupplierById(id);
    // Deactivate supplier and all their products in one transaction
    await this.dataSource.transaction(async (em) => {
      await em.query(`UPDATE products SET is_active = false WHERE supplier_id = $1`, [id]);
      await em.query(`UPDATE suppliers SET is_active = false WHERE id = $1`, [id]);
    });
    return true;
  }

  async getSupplierRestockWatch(branchId: string): Promise<SupplierRestockWatch[]> {
    const rows = await this.dataSource.query(`
      SELECT
        s.id AS supplier_id,
        s.name AS supplier_name,
        s.contact_name AS supplier_contact_name,
        s.address AS supplier_address,
        s.phone AS supplier_phone,
        s.email AS supplier_email,
        s.ai_score AS supplier_ai_score,
        p.id AS product_id,
        p.name AS product_name,
        COALESCE(inv.quantity_on_hand, 0)::int AS quantity_on_hand,
        COALESCE(inv.reorder_level, 10)::int AS reorder_level,
        CASE WHEN inv.product_id IS NOT NULL THEN true ELSE false END AS has_inventory,
        COALESCE(sale7.sold_7d, 0)::int AS sold_7d
      FROM suppliers s
      LEFT JOIN products p ON p.supplier_id = s.id AND p.is_active = true
      LEFT JOIN inventory inv ON inv.product_id = p.id AND inv.branch_id = $1
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(si.quantity), 0)::int AS sold_7d
        FROM sale_items si
        INNER JOIN sales sa ON sa.id = si.sale_id
        WHERE sa.branch_id = $1
          AND sa.status = 'COMPLETED'
          AND si.product_id = p.id
          AND sa.created_at >= NOW() - INTERVAL '7 days'
      ) sale7 ON true
      WHERE s.is_active = true
      ORDER BY s.name ASC, p.name ASC
    `, [branchId]) as Array<{
      supplier_id: string;
      supplier_name: string;
      supplier_contact_name: string | null;
      supplier_address: string | null;
      supplier_phone: string | null;
      supplier_email: string | null;
      supplier_ai_score: number | null;
      product_id: string | null;
      product_name: string | null;
      quantity_on_hand: number;
      reorder_level: number;
      has_inventory: boolean;
      sold_7d: number;
    }>;

    const map = new Map<string, SupplierRestockWatch>();
    for (const row of rows) {
      // Only count as "out" if the product has an inventory record (was stocked before)
      // Products never stocked at this branch are not "out of stock" — they're just not carried here
      const status = row.product_id ? (row.has_inventory
        ? this.calcStockStatus(row.quantity_on_hand, row.reorder_level)
        : (row.sold_7d > 0 ? 'out' : 'ok')) : 'ok';

      const existing = map.get(row.supplier_id);
      const watch: SupplierRestockWatch = existing ?? {
        supplierId: row.supplier_id,
        supplierName: row.supplier_name,
        supplierContactName: row.supplier_contact_name ?? undefined,
        supplierAddress: row.supplier_address ?? undefined,
        supplierPhone: row.supplier_phone ?? undefined,
        supplierEmail: row.supplier_email ?? undefined,
        supplierAiScore: row.supplier_ai_score ?? undefined,
        totalTrackedProducts: 0,
        lowStockCount: 0,
        criticalStockCount: 0,
        outOfStockCount: 0,
        affectedProducts: [],
      };

      if (row.product_id) {
        watch.totalTrackedProducts += 1;
        if (status === 'low') watch.lowStockCount += 1;
        if (status === 'critical') watch.criticalStockCount += 1;
        if (status === 'out') watch.outOfStockCount += 1;

        const suggestedReorderQuantity = status !== 'ok'
          ? this.suggestReorderQuantity(row.quantity_on_hand, row.reorder_level, row.sold_7d, status)
          : 0;

        // Include ALL products so the expanded view shows the full catalog
        watch.affectedProducts.push({
          productId: row.product_id,
          productName: row.product_name!,
          quantityOnHand: row.quantity_on_hand,
          reorderLevel: row.reorder_level,
          stockStatus: status,
          recentSoldQuantity7d: row.sold_7d,
          suggestedReorderQuantity,
        });
      }

      map.set(row.supplier_id, watch);
    }

    const results = Array.from(map.values());

    // Calculate dynamic AI score based on stock health
    // Score = % of products in stock, weighted by severity
    for (const w of results) {
      if (w.totalTrackedProducts === 0) {
        w.supplierAiScore = undefined;
        continue;
      }
      const okCount = w.totalTrackedProducts - w.outOfStockCount - w.criticalStockCount - w.lowStockCount;
      // Weighted: ok=100, low=60, critical=30, out=0
      const weightedScore = (okCount * 100 + w.lowStockCount * 60 + w.criticalStockCount * 30) / w.totalTrackedProducts;
      w.supplierAiScore = Math.round(Math.min(100, Math.max(0, weightedScore)));
    }

    return results.sort((a, b) => {
      const scoreA = a.outOfStockCount * 3 + a.criticalStockCount * 2 + a.lowStockCount;
      const scoreB = b.outOfStockCount * 3 + b.criticalStockCount * 2 + b.lowStockCount;
      return scoreB - scoreA || a.supplierName.localeCompare(b.supplierName);
    });
  }

  private calcStockStatus(quantityOnHand: number, reorderLevel: number): string {
    if (quantityOnHand <= 0) return 'out';
    if (quantityOnHand <= Math.max(1, Math.floor(reorderLevel * 0.2))) return 'critical';
    if (quantityOnHand <= reorderLevel) return 'low';
    return 'ok';
  }

  private suggestReorderQuantity(
    quantityOnHand: number,
    reorderLevel: number,
    sold7d: number,
    status: string,
  ): number {
    const urgencyBoost = status === 'out' ? reorderLevel : status === 'critical' ? Math.ceil(reorderLevel * 0.5) : 0;
    const baselineTarget = Math.max(reorderLevel * 2, sold7d);
    return Math.max(0, baselineTarget + urgencyBoost - quantityOnHand);
  }

  /**
   * Get supplier with ALL their products (not just stock alerts)
   * This shows the complete product catalog for a supplier
   * Products are linked to suppliers through:
   * 1. Direct supplier_id on products table
   * 2. stock_movements → supplier_invoices (for purchase history)
   */
  async getSupplierWithProducts(supplierId: string, branchId: string): Promise<any> {
    const supplier = await this.getSupplierById(supplierId);

    const products = await this.dataSource.query(`
      SELECT DISTINCT
        p.id,
        p.name,
        p.generic_name,
        p.barcode,
        p.unit_price,
        p.classification,
        p.branch_type,
        p.is_active,
        COALESCE(inv.quantity_on_hand, 0)::int AS quantity_on_hand,
        COALESCE(inv.reorder_level, 10)::int AS reorder_level,
        COALESCE(sale7.sold_7d, 0)::int AS sold_7d,
        COALESCE(sale30.sold_30d, 0)::int AS sold_30d,
        (
          SELECT MIN(sm.expiry_date)
          FROM stock_movements sm
          WHERE sm.product_id = p.id
            AND sm.branch_id = $2
            AND sm.expiry_date IS NOT NULL
            AND sm.expiry_date > NOW()
          LIMIT 1
        ) AS nearest_expiry
      FROM products p
      LEFT JOIN inventory inv ON inv.product_id = p.id AND inv.branch_id = $2
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(si2.quantity), 0)::int AS sold_7d
        FROM sale_items si2
        INNER JOIN sales sa ON sa.id = si2.sale_id
        WHERE sa.branch_id = $2
          AND sa.status = 'COMPLETED'
          AND si2.product_id = p.id
          AND sa.created_at >= NOW() - INTERVAL '7 days'
      ) sale7 ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(si3.quantity), 0)::int AS sold_30d
        FROM sale_items si3
        INNER JOIN sales sa ON sa.id = si3.sale_id
        WHERE sa.branch_id = $2
          AND sa.status = 'COMPLETED'
          AND si3.product_id = p.id
          AND sa.created_at >= NOW() - INTERVAL '30 days'
      ) sale30 ON true
      WHERE p.is_active = true
        AND (
          p.supplier_id = $1
          OR EXISTS (
            SELECT 1 FROM stock_movements sm
            INNER JOIN supplier_invoices si ON si.id = sm.reference_id
            WHERE sm.product_id = p.id
              AND si.supplier_id = $1
              AND sm.branch_id = $2
              AND sm.movement_type = 'PURCHASE'
          )
        )
      ORDER BY p.name ASC
    `, [supplierId, branchId]);

    return {
      ...supplier,
      products: products.map((p: any) => ({
        id: p.id,
        name: p.name,
        genericName: p.generic_name,
        barcode: p.barcode,
        unitPrice: p.unit_price,
        classification: p.classification,
        branchType: p.branch_type,
        isActive: p.is_active,
        quantityOnHand: p.quantity_on_hand,
        reorderLevel: p.reorder_level,
        stockStatus: this.calcStockStatus(p.quantity_on_hand, p.reorder_level),
        nearestExpiry: p.nearest_expiry,
        sold7d: p.sold_7d,
        sold30d: p.sold_30d,
      })),
      totalProducts: products.length,
    };
  }
}
