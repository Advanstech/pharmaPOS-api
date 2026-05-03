import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEodDiscrepancyReason1711000000028 implements MigrationInterface {
  name = 'AddEodDiscrepancyReason1711000000028';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE end_of_day_records
        ADD COLUMN IF NOT EXISTS discrepancy_reason TEXT
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE end_of_day_records
        DROP COLUMN IF EXISTS discrepancy_reason
    `);
  }
}
