import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEodApproval1711000000025 implements MigrationInterface {
  name = 'AddEodApproval1711000000025';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE end_of_day_records
        ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'PENDING'
          CHECK (approval_status IN ('PENDING', 'APPROVED', 'DECLINED')),
        ADD COLUMN IF NOT EXISTS approved_by      UUID REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS manager_notes    TEXT
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_eod_approval_status
        ON end_of_day_records(branch_id, approval_status)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE end_of_day_records
        DROP COLUMN IF EXISTS approval_status,
        DROP COLUMN IF EXISTS approved_by,
        DROP COLUMN IF EXISTS approved_at,
        DROP COLUMN IF EXISTS manager_notes
    `);
  }
}
