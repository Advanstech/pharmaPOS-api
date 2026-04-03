import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStockCountAndSupplierPriceHistory1711000000015 implements MigrationInterface {
  name = 'AddStockCountAndSupplierPriceHistory1711000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add supplier_product_code to products table
    await queryRunner.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS supplier_product_code VARCHAR(100),
      ADD COLUMN IF NOT EXISTS supplier_updated_at TIMESTAMP;
    `);

    // Create index for supplier product code lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_products_supplier_code 
      ON products(supplier_id, supplier_product_code) 
      WHERE supplier_product_code IS NOT NULL;
    `);

    // Create stock_count_sessions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stock_count_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' 
          CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP,
        counted_by UUID NOT NULL REFERENCES users(id),
        reviewed_by UUID REFERENCES users(id),
        total_items INTEGER NOT NULL DEFAULT 0,
        total_variance INTEGER NOT NULL DEFAULT 0,
        total_value_variance INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create indexes for stock count sessions
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_stock_count_sessions_branch 
      ON stock_count_sessions(branch_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_stock_count_sessions_status 
      ON stock_count_sessions(status);
    `);

    // Create stock_count_items table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stock_count_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES stock_count_sessions(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        expected_quantity INTEGER NOT NULL DEFAULT 0,
        counted_quantity INTEGER,
        variance INTEGER DEFAULT 0,
        unit_cost_pesewas INTEGER,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(session_id, product_id)
      );
    `);

    // Create indexes for stock count items
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_stock_count_items_session 
      ON stock_count_items(session_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_stock_count_items_product 
      ON stock_count_items(product_id);
    `);

    // Create supplier_price_history table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS supplier_price_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        old_price_pesewas INTEGER NOT NULL,
        new_price_pesewas INTEGER NOT NULL,
        effective_date TIMESTAMP NOT NULL DEFAULT NOW(),
        synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
        synced_by UUID REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create indexes for supplier price history
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_supplier_price_history_supplier 
      ON supplier_price_history(supplier_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_supplier_price_history_product 
      ON supplier_price_history(product_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_supplier_price_history_effective 
      ON supplier_price_history(effective_date DESC);
    `);

    // Add trigger for stock count sessions updated_at
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS update_stock_count_sessions_updated_at 
      ON stock_count_sessions;
    `);
    await queryRunner.query(`
      CREATE TRIGGER update_stock_count_sessions_updated_at
        BEFORE UPDATE ON stock_count_sessions
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS update_stock_count_items_updated_at 
      ON stock_count_items;
    `);
    await queryRunner.query(`
      CREATE TRIGGER update_stock_count_items_updated_at
        BEFORE UPDATE ON stock_count_items
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // Add comment documentation
    await queryRunner.query(`
      COMMENT ON TABLE stock_count_sessions IS 
      'Physical inventory count sessions (cycle counting) for stock audits';
    `);
    await queryRunner.query(`
      COMMENT ON TABLE stock_count_items IS 
      'Individual product counts within a stock count session';
    `);
    await queryRunner.query(`
      COMMENT ON TABLE supplier_price_history IS 
      'Historical price changes from supplier catalog syncs';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE IF EXISTS supplier_price_history;`);
    await queryRunner.query(`DROP TABLE IF EXISTS stock_count_items;`);
    await queryRunner.query(`DROP TABLE IF EXISTS stock_count_sessions;`);

    // Remove columns from products
    await queryRunner.query(`
      ALTER TABLE products 
      DROP COLUMN IF EXISTS supplier_product_code,
      DROP COLUMN IF EXISTS supplier_updated_at;
    `);

    // Drop index
    await queryRunner.query(`DROP INDEX IF EXISTS idx_products_supplier_code;`);
  }
}
