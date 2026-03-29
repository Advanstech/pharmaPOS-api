import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerEmail1711000000012 implements MigrationInterface {
  name = 'AddCustomerEmail1711000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add email column to customers table
    await queryRunner.query(`
      ALTER TABLE customers 
      ADD COLUMN email VARCHAR(255) UNIQUE,
      ADD COLUMN email_verified_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN marketing_consent BOOLEAN DEFAULT false,
      ADD COLUMN receipt_preference VARCHAR(20) DEFAULT 'email' CHECK (receipt_preference IN ('email', 'print', 'both'));
    `);

    // Create index for email lookups
    await queryRunner.query(`
      CREATE INDEX idx_customers_email ON customers(email) WHERE email IS NOT NULL;
    `);

    // Add audit log entry for the migration
    await queryRunner.query(`
      INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
      VALUES (
        gen_random_uuid(), 
        (SELECT id FROM branches LIMIT 1), 
        (SELECT id FROM users WHERE role = 'owner' LIMIT 1),
        'SCHEMA_MIGRATION', 
        'customers', 
        gen_random_uuid(),
        '{"migration": "1711000000012", "description": "Add customer email and preferences"}'
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_customers_email`);

    // Remove columns
    await queryRunner.query(`
      ALTER TABLE customers 
      DROP COLUMN IF EXISTS email,
      DROP COLUMN IF EXISTS email_verified_at,
      DROP COLUMN IF EXISTS marketing_consent,
      DROP COLUMN IF EXISTS receipt_preference;
    `);
  }
}
