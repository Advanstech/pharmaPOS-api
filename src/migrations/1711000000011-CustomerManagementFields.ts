import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends `customers` (base table in `1711000000000-CreateCoreTables`: `id` UUID PK, branch_id,
 * phone_hash, name_encrypted, …).
 *
 * Adds / changes:
 * | Column | Purpose |
 * |--------|---------|
 * | `customer_code` | Public receipt-safe ref (NOT NULL, unique); backfilled `LEG-…` for existing rows. |
 * | `phone_hash` | Made **nullable** so walk-ins without a phone are valid. |
 * | `sex` | Optional: `male` \| `female` \| `other` \| `prefer_not_to_say`. |
 * | `age_years` | Optional approximate age (0–130). |
 * | `ghana_card_encrypted` | Optional Ghana Card number as **AES-256-GCM ciphertext** (never plaintext). |
 */
export class CustomerManagementFields1711000000011 implements MigrationInterface {
  name = 'CustomerManagementFields1711000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_code VARCHAR(20)
    `);
    await queryRunner.query(`
      UPDATE customers
      SET customer_code = 'LEG-' || UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 12))
      WHERE customer_code IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE customers ALTER COLUMN customer_code SET NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_customer_code ON customers(customer_code)
    `);

    await queryRunner.query(`ALTER TABLE customers ALTER COLUMN phone_hash DROP NOT NULL`);

    await queryRunner.query(`
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS sex VARCHAR(24) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE customers ADD CONSTRAINT chk_customers_sex CHECK (
        sex IS NULL OR sex IN ('male', 'female', 'other', 'prefer_not_to_say')
      )
    `);

    await queryRunner.query(`
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS age_years SMALLINT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE customers ADD CONSTRAINT chk_customers_age_years CHECK (
        age_years IS NULL OR (age_years >= 0 AND age_years <= 130)
      )
    `);

    await queryRunner.query(`
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS ghana_card_encrypted TEXT NULL
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN customers.customer_code IS
        'Public customer reference for receipts and POS (e.g. PP-XXXXXXXX or legacy LEG-…). Unique.';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN customers.ghana_card_encrypted IS
        'Optional Ghana Card identifier: AES-256-GCM blob (iv:tag:ciphertext hex). No plaintext column.';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN customers.sex IS 'Optional: male | female | other | prefer_not_to_say.';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN customers.age_years IS 'Optional approximate age in years (0–130).';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE customers DROP CONSTRAINT IF EXISTS chk_customers_age_years`);
    await queryRunner.query(`ALTER TABLE customers DROP CONSTRAINT IF EXISTS chk_customers_sex`);
    await queryRunner.query(`ALTER TABLE customers DROP COLUMN IF EXISTS ghana_card_encrypted`);
    await queryRunner.query(`ALTER TABLE customers DROP COLUMN IF EXISTS age_years`);
    await queryRunner.query(`ALTER TABLE customers DROP COLUMN IF EXISTS sex`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_customers_customer_code`);
    await queryRunner.query(`ALTER TABLE customers DROP COLUMN IF EXISTS customer_code`);
    await queryRunner.query(
      `UPDATE customers SET phone_hash = COALESCE(phone_hash, 'unknown') WHERE phone_hash IS NULL`,
    );
    await queryRunner.query(`ALTER TABLE customers ALTER COLUMN phone_hash SET NOT NULL`);
  }
}
