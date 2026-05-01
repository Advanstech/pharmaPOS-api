import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEndOfDayRecords1711000000024 implements MigrationInterface {
  name = 'AddEndOfDayRecords1711000000024';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS end_of_day_records (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id             UUID NOT NULL REFERENCES branches(id),
        cashier_id            UUID NOT NULL REFERENCES users(id),
        business_date         DATE NOT NULL,

        -- Sales summary (snapshot at close)
        total_sales_count     INT NOT NULL DEFAULT 0,
        gross_revenue_pesewas BIGINT NOT NULL DEFAULT 0,
        vat_collected_pesewas BIGINT NOT NULL DEFAULT 0,
        refunds_count         INT NOT NULL DEFAULT 0,
        refunds_pesewas       BIGINT NOT NULL DEFAULT 0,
        expenses_count        INT NOT NULL DEFAULT 0,
        expenses_pesewas      BIGINT NOT NULL DEFAULT 0,
        net_revenue_pesewas   BIGINT NOT NULL DEFAULT 0,

        -- Cash count
        expected_cash_pesewas BIGINT NOT NULL DEFAULT 0,
        cash_counted_pesewas  BIGINT NOT NULL DEFAULT 0,
        momo_counted_pesewas  BIGINT NOT NULL DEFAULT 0,
        total_counted_pesewas BIGINT NOT NULL DEFAULT 0,
        variance_pesewas      BIGINT NOT NULL DEFAULT 0,

        -- Status
        is_balanced           BOOLEAN NOT NULL DEFAULT false,
        closing_notes         TEXT,
        closed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        -- One close per branch per day
        UNIQUE (branch_id, business_date)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_eod_branch_date
        ON end_of_day_records(branch_id, business_date DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS end_of_day_records`);
  }
}
