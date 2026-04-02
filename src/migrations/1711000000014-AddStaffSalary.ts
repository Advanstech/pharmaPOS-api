import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds salary/compensation fields to staff_profiles.
 * All monetary values in GHS (Ghana Cedis) — never USD.
 * salary_amount stored as integer pesewas (×100) for precision.
 */
export class AddStaffSalary1711000000014 implements MigrationInterface {
  name = 'AddStaffSalary1711000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE staff_profiles
        ADD COLUMN IF NOT EXISTS salary_amount_pesewas BIGINT,
        ADD COLUMN IF NOT EXISTS salary_currency VARCHAR(3) NOT NULL DEFAULT 'GHS',
        ADD COLUMN IF NOT EXISTS salary_period VARCHAR(20) DEFAULT 'monthly'
          CHECK (salary_period IN ('daily','weekly','monthly','annual')),
        ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
        ADD COLUMN IF NOT EXISTS bank_account_encrypted TEXT,
        ADD COLUMN IF NOT EXISTS momo_number_encrypted TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE staff_profiles
        DROP COLUMN IF EXISTS salary_amount_pesewas,
        DROP COLUMN IF EXISTS salary_currency,
        DROP COLUMN IF EXISTS salary_period,
        DROP COLUMN IF EXISTS bank_name,
        DROP COLUMN IF EXISTS bank_account_encrypted,
        DROP COLUMN IF EXISTS momo_number_encrypted
    `);
  }
}
