"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddSupplierFields1711000000001 = void 0;
class AddSupplierFields1711000000001 {
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE suppliers
      ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS company_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS business_type VARCHAR(100),
      ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50),
      ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(50) DEFAULT 'NET_30',
      ADD COLUMN IF NOT EXISTS credit_limit INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS notes TEXT
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_name)
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(email)
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_suppliers_email`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_suppliers_company`);
        await queryRunner.query(`
      ALTER TABLE suppliers
      DROP COLUMN IF EXISTS notes,
      DROP COLUMN IF EXISTS credit_limit,
      DROP COLUMN IF EXISTS payment_terms,
      DROP COLUMN IF EXISTS tax_id,
      DROP COLUMN IF EXISTS business_type,
      DROP COLUMN IF EXISTS company_name,
      DROP COLUMN IF EXISTS last_name,
      DROP COLUMN IF EXISTS first_name
    `);
    }
}
exports.AddSupplierFields1711000000001 = AddSupplierFields1711000000001;
//# sourceMappingURL=1711000000001-AddSupplierFields.js.map