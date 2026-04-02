import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStaffProfilePhotoUrl1711000000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE staff_profiles
      ADD COLUMN IF NOT EXISTS photo_url TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE staff_profiles
      DROP COLUMN IF EXISTS photo_url
    `);
  }
}
