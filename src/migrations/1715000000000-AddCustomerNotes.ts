import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds encrypted notes/diagnosis field to customers table for medical history tracking.
 * Notes are stored encrypted (AES-256-GCM) to protect patient confidentiality.
 */
export class AddCustomerNotes1715000000000 implements MigrationInterface {
  name = 'AddCustomerNotes1715000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes_encrypted TEXT NULL
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN customers.notes_encrypted IS 
        'Optional clinical notes/diagnosis: AES-256-GCM ciphertext (iv:tag:ciphertext hex). 
         For patient history, allergies, and medical observations.';
    `);

    // Create GIN index for searching (will be used with trigram extension if available)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_customers_notes_search 
      ON customers USING GIN (notes_encrypted gin_trgm_ops) 
      WHERE notes_encrypted IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_customers_notes_search`);
    await queryRunner.query(`ALTER TABLE customers DROP COLUMN IF EXISTS notes_encrypted`);
  }
}
