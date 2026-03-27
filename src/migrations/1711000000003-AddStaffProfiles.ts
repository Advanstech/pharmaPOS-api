import { MigrationInterface, QueryRunner } from 'typeorm';

// Migration: AddStaffProfiles
// Creates staff_profiles table (1:1 with users) for HR data
// Ghana Data Protection Act 2012: PII fields AES-256 encrypted at rest
export class AddStaffProfiles1711000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE staff_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id),
        branch_id UUID NOT NULL REFERENCES branches(id),

        -- Contact & personal info (Ghana Data Protection Act 2012: encrypted at rest)
        phone_encrypted TEXT,
        address_encrypted TEXT,
        date_of_birth_encrypted TEXT,
        gender VARCHAR(20) CHECK (gender IN ('male','female','other','prefer_not_to_say')),

        -- Employment
        position VARCHAR(100),
        department VARCHAR(100),
        employment_type VARCHAR(20) NOT NULL DEFAULT 'full_time'
          CHECK (employment_type IN ('full_time','part_time','contract')),
        start_date TIMESTAMPTZ,
        end_date TIMESTAMPTZ,

        -- Ghana Card (AES-256 encrypted — Ghana Data Protection Act 2012)
        ghana_card_number_encrypted TEXT,

        -- GMDC professional licence (pharmacists/technicians)
        professional_licence_no VARCHAR(100),
        licence_expiry_date TIMESTAMPTZ,

        -- Certificates stored in S3 (same bucket as Rx PDFs)
        certificate_s3_keys TEXT[] NOT NULL DEFAULT '{}',

        -- Emergency contact
        emergency_contact_name VARCHAR(255),
        emergency_contact_phone VARCHAR(30),

        -- Internal notes (manager/owner only)
        notes TEXT,

        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_staff_profiles_branch ON staff_profiles(branch_id)`);
    await queryRunner.query(`CREATE INDEX idx_staff_profiles_user ON staff_profiles(user_id)`);
    await queryRunner.query(`CREATE INDEX idx_staff_profiles_licence ON staff_profiles(professional_licence_no) WHERE professional_licence_no IS NOT NULL`);

    // RLS — branch isolation
    await queryRunner.query(`ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY branch_isolation ON staff_profiles
        USING (branch_id = current_setting('app.current_branch_id', true)::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS staff_profiles CASCADE`);
  }
}
