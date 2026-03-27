"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddSalesSoldAt1711000000009 = void 0;
class AddSalesSoldAt1711000000009 {
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE sales
      ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ NULL
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_branch_effective_at
      ON sales (branch_id, (COALESCE(sold_at, created_at)) DESC)
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_sales_branch_effective_at`);
        await queryRunner.query(`ALTER TABLE sales DROP COLUMN IF EXISTS sold_at`);
    }
}
exports.AddSalesSoldAt1711000000009 = AddSalesSoldAt1711000000009;
//# sourceMappingURL=1711000000009-AddSalesSoldAt.js.map