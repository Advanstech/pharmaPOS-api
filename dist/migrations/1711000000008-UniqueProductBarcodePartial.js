"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniqueProductBarcodePartial1711000000008 = void 0;
class UniqueProductBarcodePartial1711000000008 {
    async up(queryRunner) {
        await queryRunner.query(`
      UPDATE products p
      SET barcode = left(btrim(p.barcode), 60) || '-' || left(replace(p.id::text, '-', ''), 12)
      FROM (
        SELECT barcode AS dup_bc, (array_agg(id ORDER BY id))[1] AS keep_id
        FROM products
        WHERE barcode IS NOT NULL AND btrim(barcode) <> ''
        GROUP BY barcode
        HAVING COUNT(*) > 1
      ) d
      WHERE p.barcode = d.dup_bc AND p.id <> d.keep_id
    `);
        await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_products_barcode_unique_non_empty"
      ON "products" ("barcode")
      WHERE "barcode" IS NOT NULL AND btrim("barcode") <> ''
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_barcode_unique_non_empty"`);
    }
}
exports.UniqueProductBarcodePartial1711000000008 = UniqueProductBarcodePartial1711000000008;
//# sourceMappingURL=1711000000008-UniqueProductBarcodePartial.js.map