import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixGRNPurchaseOrderOptional1711000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Make purchase_order_id optional on goods_received_notes
    // Ghana workflow: GRN can be created without a PO (supplier delivers directly)
    await queryRunner.query(`
      ALTER TABLE goods_received_notes
      ALTER COLUMN purchase_order_id DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE goods_received_notes
      ALTER COLUMN purchase_order_id SET NOT NULL
    `);
  }
}
