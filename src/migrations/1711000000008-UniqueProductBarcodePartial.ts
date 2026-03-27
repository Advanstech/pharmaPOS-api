import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Legacy seeds / imports could create multiple `products` rows with the same barcode.
 * POS search dedupes by display name and could surface a zero-stock duplicate.
 * 1) Suffix duplicate barcodes so each row stays unique and scannable.
 * 2) Enforce uniqueness on non-empty barcode for idempotent seed upserts going forward.
 */
export class UniqueProductBarcodePartial1711000000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_barcode_unique_non_empty"`);
  }
}
