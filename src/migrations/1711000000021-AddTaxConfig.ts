import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaxConfig1711000000021 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tax_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id UUID NOT NULL REFERENCES branches(id) UNIQUE,
        vat_rate NUMERIC(5,4) NOT NULL DEFAULT 0.1250 CHECK (vat_rate >= 0 AND vat_rate <= 1),
        nhil_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0250 CHECK (nhil_rate >= 0 AND nhil_rate <= 1),
        getfund_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0000 CHECK (getfund_rate >= 0 AND getfund_rate <= 1),
        covid_levy_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0000 CHECK (covid_levy_rate >= 0 AND covid_levy_rate <= 1),
        apply_vat_on_otc BOOLEAN NOT NULL DEFAULT true,
        apply_vat_on_pom BOOLEAN NOT NULL DEFAULT false,
        apply_vat_on_controlled BOOLEAN NOT NULL DEFAULT false,
        updated_by UUID REFERENCES users(id),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Seed default Ghana GRA rates for existing branches
    await queryRunner.query(`
      INSERT INTO tax_config (branch_id, vat_rate, nhil_rate, getfund_rate, covid_levy_rate)
      SELECT id, 0.1250, 0.0250, 0.0000, 0.0000 FROM branches
      ON CONFLICT (branch_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tax_config`);
  }
}
