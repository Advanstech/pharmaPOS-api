import { MigrationInterface, QueryRunner } from 'typeorm';

export class EodPerStaff1711000000026 implements MigrationInterface {
  name = 'EodPerStaff1711000000026';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the branch-level unique (one per branch per day) and replace with
    // per-staff unique (one per cashier per branch per day).
    await queryRunner.query(`
      ALTER TABLE end_of_day_records
        DROP CONSTRAINT IF EXISTS end_of_day_records_branch_id_business_date_key
    `);

    await queryRunner.query(`
      ALTER TABLE end_of_day_records
        ADD CONSTRAINT eod_branch_cashier_date_unique
          UNIQUE (branch_id, cashier_id, business_date)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE end_of_day_records
        DROP CONSTRAINT IF EXISTS eod_branch_cashier_date_unique
    `);

    await queryRunner.query(`
      ALTER TABLE end_of_day_records
        ADD CONSTRAINT end_of_day_records_branch_id_business_date_key
          UNIQUE (branch_id, business_date)
    `);
  }
}
