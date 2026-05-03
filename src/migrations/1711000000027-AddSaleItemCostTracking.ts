import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add unit cost tracking to sale_items for accurate profit reporting.
 * Each sale item records its cost at the moment of sale, frozen for accounting.
 */
export class AddSaleItemCostTracking1711000000027 implements MigrationInterface {
  name = 'AddSaleItemCostTracking1711000000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add unit_cost_pesewas column to sale_items
    await queryRunner.query(`
      ALTER TABLE sale_items
      ADD COLUMN IF NOT EXISTS unit_cost_pesewas INTEGER,
      ADD COLUMN IF NOT EXISTS cost_source VARCHAR(20) DEFAULT 'product_cost_history'
        CHECK (cost_source IN ('product_cost_history', 'manual', 'estimated'))
    `);

    // Create index for cost-based reporting
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sale_items_cost 
      ON sale_items(sale_id, unit_cost_pesewas) 
      WHERE unit_cost_pesewas IS NOT NULL
    `);

    // Backfill existing sale_items with their approximate cost from product_cost_history
    // For historical sales, use the latest cost before the sale date
    await queryRunner.query(`
      WITH sale_costs AS (
        SELECT 
          si.id as sale_item_id,
          pch.unit_cost_pesewas,
          ROW_NUMBER() OVER (
            PARTITION BY si.id 
            ORDER BY pch.observed_at DESC
          ) as rn
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN product_cost_history pch ON pch.product_id = si.product_id
          AND pch.observed_at <= s.created_at
        WHERE si.unit_cost_pesewas IS NULL
      )
      UPDATE sale_items
      SET unit_cost_pesewas = sc.unit_cost_pesewas,
          cost_source = 'product_cost_history'
      FROM sale_costs sc
      WHERE sale_items.id = sc.sale_item_id
        AND sc.rn = 1
    `);

    // For items still without cost, use 0 (unknown cost)
    await queryRunner.query(`
      UPDATE sale_items
      SET unit_cost_pesewas = 0,
          cost_source = 'estimated'
      WHERE unit_cost_pesewas IS NULL
    `);

    // Add NOT NULL constraint after backfill
    await queryRunner.query(`
      ALTER TABLE sale_items
      ALTER COLUMN unit_cost_pesewas SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_sale_items_cost`);
    await queryRunner.query(`ALTER TABLE sale_items DROP COLUMN IF EXISTS cost_source`);
    await queryRunner.query(`ALTER TABLE sale_items DROP COLUMN IF EXISTS unit_cost_pesewas`);
  }
}
