import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOcrMappingPresets1711000000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE ocr_mapping_presets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id UUID NOT NULL REFERENCES branches(id),
        supplier_id UUID REFERENCES suppliers(id),
        name VARCHAR(120) NOT NULL,
        header_map JSONB NOT NULL DEFAULT '{}',
        created_by UUID REFERENCES users(id),
        updated_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_ocr_mapping_presets_branch_supplier
      ON ocr_mapping_presets(branch_id, supplier_id, updated_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_ocr_mapping_presets_branch_name
      ON ocr_mapping_presets(branch_id, LOWER(name))
    `);

    await queryRunner.query(`ALTER TABLE ocr_mapping_presets ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY branch_isolation ON ocr_mapping_presets
        USING (branch_id = current_setting('app.current_branch_id', true)::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS branch_isolation ON ocr_mapping_presets`);
    await queryRunner.query(`DROP TABLE IF EXISTS ocr_mapping_presets`);
  }
}
