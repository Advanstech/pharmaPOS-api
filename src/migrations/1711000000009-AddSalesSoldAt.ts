import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Checkout wall time for POS (especially offline-queued sales synced later).
 * Reporting uses COALESCE(sold_at, created_at); null sold_at preserves prior behaviour.
 */
export class AddSalesSoldAt1711000000009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sales
      ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_branch_effective_at
      ON sales (branch_id, (COALESCE(sold_at, created_at)) DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_sales_branch_effective_at`);
    await queryRunner.query(`ALTER TABLE sales DROP COLUMN IF EXISTS sold_at`);
  }
}
