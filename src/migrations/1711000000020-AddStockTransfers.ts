import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStockTransfers1711000000020 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Stock transfers header
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stock_transfers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_branch_id UUID NOT NULL REFERENCES branches(id),
        to_branch_id UUID NOT NULL REFERENCES branches(id),
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
          CHECK (status IN ('PENDING', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED')),
        notes TEXT,
        created_by UUID NOT NULL REFERENCES users(id),
        approved_by UUID REFERENCES users(id),
        received_by UUID REFERENCES users(id),
        approved_at TIMESTAMPTZ,
        received_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Stock transfer line items
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stock_transfer_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        received_quantity INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_branch ON stock_transfers(from_branch_id, status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_branch ON stock_transfers(to_branch_id, status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer ON stock_transfer_items(transfer_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS stock_transfer_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS stock_transfers`);
  }
}
