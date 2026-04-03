import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtUser } from '../auth/decorators/current-user.decorator';

export interface SupplierCatalogItem {
  supplierProductCode: string;
  productName: string;
  genericName?: string;
  unitPricePesewas: number;
  moq?: number; // Minimum order quantity
  leadTimeDays?: number;
  isAvailable: boolean;
  lastUpdated: Date;
}

export interface CatalogSyncResult {
  supplierId: string;
  itemsSynced: number;
  newProducts: number;
  priceUpdates: number;
  unavailableItems: number;
  syncDate: Date;
}

export interface SupplierPriceUpdate {
  productId: string;
  oldPrice: number;
  newPrice: number;
  effectiveDate: Date;
}

@Injectable()
export class SupplierCatalogSyncService {
  private readonly logger = new Logger(SupplierCatalogSyncService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Sync supplier catalog - fetches latest product list and prices from supplier
   * This is a framework method that can be extended for specific supplier APIs
   */
  async syncSupplierCatalog(supplierId: string, actor: JwtUser): Promise<CatalogSyncResult> {
    // Verify supplier exists and belongs to organization
    const [supplier] = await this.dataSource.query(
      `
      SELECT s.* 
      FROM suppliers s
      JOIN branches b ON b.id = $1
      WHERE s.id = $2 AND s.organization_id = b.organization_id AND s.is_active = true
    `,
      [actor.branchId, supplierId],
    ) as Array<{ id: string; name: string; api_endpoint?: string; api_key?: string }>;

    if (!supplier) {
      throw new NotFoundException(`Supplier ${supplierId} not found or inactive`);
    }

    // Placeholder for actual API integration
    // In production, this would call the supplier's API
    const catalogItems = await this.fetchSupplierCatalog(supplierId);

    const result = await this.dataSource.transaction(async (em) => {
      let itemsSynced = 0;
      let newProducts = 0;
      let priceUpdates = 0;
      let unavailableItems = 0;

      for (const item of catalogItems) {
        // Check if product exists by supplier code
        const [existingProduct] = await em.query(
          `
          SELECT p.id, p.name, p.base_price_pesewas
          FROM products p
          WHERE p.supplier_id = $1 AND p.supplier_product_code = $2
        `,
          [supplierId, item.supplierProductCode],
        ) as Array<{ id: string; name: string; base_price_pesewas: number }>;

        if (existingProduct) {
          // Update existing product
          if (existingProduct.base_price_pesewas !== item.unitPricePesewas) {
            // Log price change history
            await em.query(
              `
              INSERT INTO supplier_price_history (
                id, supplier_id, product_id, old_price_pesewas, new_price_pesewas, 
                effective_date, synced_at, synced_by
              )
              VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW(), $5)
            `,
              [
                supplierId,
                existingProduct.id,
                existingProduct.base_price_pesewas,
                item.unitPricePesewas,
                actor.sub,
              ],
            );
            priceUpdates++;
          }

          // Update product availability and price
          await em.query(
            `
            UPDATE products 
            SET base_price_pesewas = $1, 
                is_active = $2,
                supplier_updated_at = NOW()
            WHERE id = $3
          `,
            [item.unitPricePesewas, item.isAvailable, existingProduct.id],
          );

          if (!item.isAvailable) {
            unavailableItems++;
          }
        } else if (item.isAvailable) {
          // Create new product from catalog
          await em.query(
            `
            INSERT INTO products (
              id, name, generic_name, base_price_pesewas, supplier_id, 
              supplier_product_code, classification, is_active, created_at
            )
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'OTC', true, NOW())
          `,
            [
              item.productName,
              item.genericName || null,
              item.unitPricePesewas,
              supplierId,
              item.supplierProductCode,
            ],
          );
          newProducts++;
        }

        itemsSynced++;
      }

      // Log sync audit
      await em.query(
        `
        INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
        VALUES (gen_random_uuid(), $1, $2, 'SUPPLIER_CATALOG_SYNC', 'supplier', $3, $4)
      `,
        [
          actor.branchId,
          actor.sub,
          supplierId,
          JSON.stringify({
            supplier_name: supplier.name,
            items_synced: itemsSynced,
            new_products: newProducts,
            price_updates: priceUpdates,
            unavailable_items: unavailableItems,
          }),
        ],
      );

      return {
        supplierId,
        itemsSynced,
        newProducts,
        priceUpdates,
        unavailableItems,
        syncDate: new Date(),
      };
    });

    this.logger.log(
      `Supplier catalog sync completed: ${supplierId} - ${result.itemsSynced} items, ${result.newProducts} new, ${result.priceUpdates} price updates`,
    );
    return result;
  }

  /**
   * Get pending price updates for products from a supplier
   */
  async getPendingPriceUpdates(supplierId: string, actor: JwtUser): Promise<SupplierPriceUpdate[]> {
    const updates = await this.dataSource.query(
      `
      SELECT 
        sph.product_id,
        sph.old_price_pesewas as old_price,
        sph.new_price_pesewas as new_price,
        sph.effective_date
      FROM supplier_price_history sph
      JOIN products p ON p.id = sph.product_id
      WHERE sph.supplier_id = $1
        AND p.supplier_id = $1
        AND sph.effective_date > NOW() - INTERVAL '30 days'
      ORDER BY sph.effective_date DESC
    `,
      [supplierId],
    ) as Array<{
      product_id: string;
      old_price: number;
      new_price: number;
      effective_date: Date;
    }>;

    return updates.map((u) => ({
      productId: u.product_id,
      oldPrice: u.old_price,
      newPrice: u.new_price,
      effectiveDate: u.effective_date,
    }));
  }

  /**
   * Get supplier catalog sync history
   */
  async getSyncHistory(supplierId: string, limit = 10): Promise<CatalogSyncResult[]> {
    const history = await this.dataSource.query(
      `
      SELECT 
        metadata->>'supplier_id' as supplier_id,
        (metadata->>'items_synced')::int as items_synced,
        (metadata->>'new_products')::int as new_products,
        (metadata->>'price_updates')::int as price_updates,
        (metadata->>'unavailable_items')::int as unavailable_items,
        created_at as sync_date
      FROM audit_logs
      WHERE entity_id = $1 
        AND type = 'SUPPLIER_CATALOG_SYNC'
      ORDER BY created_at DESC
      LIMIT $2
    `,
      [supplierId, limit],
    ) as Array<{
      supplier_id: string;
      items_synced: number;
      new_products: number;
      price_updates: number;
      unavailable_items: number;
      sync_date: Date;
    }>;

    return history.map((h) => ({
      supplierId: h.supplier_id,
      itemsSynced: h.items_synced,
      newProducts: h.new_products,
      priceUpdates: h.price_updates,
      unavailableItems: h.unavailable_items,
      syncDate: h.sync_date,
    }));
  }

  /**
   * Compare local prices with supplier catalog to find discrepancies
   */
  async comparePricesWithCatalog(supplierId: string): Promise<
    Array<{
      productId: string;
      productName: string;
      localPrice: number;
      supplierPrice: number;
      difference: number;
      differencePercent: number;
    }>
  > {
    const discrepancies = await this.dataSource.query(
      `
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.base_price_pesewas as local_price,
        (sph.new_price_pesewas) as supplier_price,
        sph.new_price_pesewas - p.base_price_pesewas as difference,
        CASE WHEN p.base_price_pesewas > 0 
          THEN ((sph.new_price_pesewas - p.base_price_pesewas) * 100.0 / p.base_price_pesewas)
          ELSE 0 
        END as difference_percent
      FROM products p
      JOIN LATERAL (
        SELECT new_price_pesewas
        FROM supplier_price_history
        WHERE product_id = p.id
        ORDER BY effective_date DESC
        LIMIT 1
      ) sph ON true
      WHERE p.supplier_id = $1
        AND p.is_active = true
        AND ABS(sph.new_price_pesewas - p.base_price_pesewas) > 0
      ORDER BY ABS(sph.new_price_pesewas - p.base_price_pesewas) DESC
    `,
      [supplierId],
    ) as Array<{
      product_id: string;
      product_name: string;
      local_price: number;
      supplier_price: number;
      difference: number;
      difference_percent: number;
    }>;

    return discrepancies.map((d) => ({
      productId: d.product_id,
      productName: d.product_name,
      localPrice: d.local_price,
      supplierPrice: d.supplier_price,
      difference: d.difference,
      differencePercent: parseFloat(d.difference_percent.toFixed(2)),
    }));
  }

  /**
   * Placeholder method - in production, this would call supplier API
   */
  private async fetchSupplierCatalog(supplierId: string): Promise<SupplierCatalogItem[]> {
    // This is a framework placeholder
    // In production, this would:
    // 1. Get supplier API credentials from DB
    // 2. Call supplier's REST/GraphQL API
    // 3. Parse response and return standardized items

    this.logger.warn(`Using mock catalog for supplier ${supplierId}. Implement actual API integration.`);

    // Return empty array - implement actual API call
    return [];
  }
}
