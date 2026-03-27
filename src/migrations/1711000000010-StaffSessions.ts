import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Append-only staff session history: login time, optional logout, last refresh activity.
 * Correlates to `sessions.id` until the session row is deleted; history remains.
 */
export class StaffSessions1711000000010 implements MigrationInterface {
  name = 'StaffSessions1711000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE staff_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        branch_id UUID NOT NULL REFERENCES branches(id),
        session_id UUID NOT NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ended_at TIMESTAMPTZ,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_staff_sessions_branch_started ON staff_sessions(branch_id, started_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_staff_sessions_user_started ON staff_sessions(user_id, started_at DESC)`,
    );
    await queryRunner.query(`CREATE INDEX idx_staff_sessions_session_id ON staff_sessions(session_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS staff_sessions`);
  }
}
