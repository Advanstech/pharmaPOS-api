import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupplierPaymentInstructions1711000000010 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE suppliers
        ADD COLUMN IF NOT EXISTS tin VARCHAR(50),
        ADD COLUMN IF NOT EXISTS website VARCHAR(255),
        ADD COLUMN IF NOT EXISTS payment_instructions JSONB
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE suppliers
        DROP COLUMN IF EXISTS tin,
        DROP COLUMN IF EXISTS website,
        DROP COLUMN IF EXISTS payment_instructions
    `);
  }
}
