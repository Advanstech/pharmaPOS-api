import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefundMovementType1711000000023 implements MigrationInterface {
  name = 'AddRefundMovementType1711000000023';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old check constraint and recreate with REFUND included
    await queryRunner.query(`
      ALTER TABLE stock_movements
        DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check
    `);
    await queryRunner.query(`
      ALTER TABLE stock_movements
        ADD CONSTRAINT stock_movements_movement_type_check
        CHECK (movement_type IN (
          'PURCHASE','SALE','ADJUSTMENT',
          'TRANSFER_IN','TRANSFER_OUT',
          'EXPIRY_WRITE_OFF','REFUND'
        ))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE stock_movements
        DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check
    `);
    await queryRunner.query(`
      ALTER TABLE stock_movements
        ADD CONSTRAINT stock_movements_movement_type_check
        CHECK (movement_type IN (
          'PURCHASE','SALE','ADJUSTMENT',
          'TRANSFER_IN','TRANSFER_OUT','EXPIRY_WRITE_OFF'
        ))
    `);
  }
}
