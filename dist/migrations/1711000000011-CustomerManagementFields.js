"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerManagementFields1711000000011 = void 0;
class CustomerManagementFields1711000000011 {
    constructor() {
        this.name = 'CustomerManagementFields1711000000011';
    }
    async up(queryRunner) {
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
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE customers DROP CONSTRAINT IF EXISTS chk_customers_age_years`);
        await queryRunner.query(`ALTER TABLE customers DROP CONSTRAINT IF EXISTS chk_customers_sex`);
        await queryRunner.query(`ALTER TABLE customers DROP COLUMN IF EXISTS ghana_card_encrypted`);
        await queryRunner.query(`ALTER TABLE customers DROP COLUMN IF EXISTS age_years`);
        await queryRunner.query(`ALTER TABLE customers DROP COLUMN IF EXISTS sex`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_customers_customer_code`);
        await queryRunner.query(`ALTER TABLE customers DROP COLUMN IF EXISTS customer_code`);
        await queryRunner.query(`UPDATE customers SET phone_hash = COALESCE(phone_hash, 'unknown') WHERE phone_hash IS NULL`);
        await queryRunner.query(`ALTER TABLE customers ALTER COLUMN phone_hash SET NOT NULL`);
    }
}
exports.CustomerManagementFields1711000000011 = CustomerManagementFields1711000000011;
//# sourceMappingURL=1711000000011-CustomerManagementFields.js.map