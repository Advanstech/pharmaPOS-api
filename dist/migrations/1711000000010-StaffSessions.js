"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffSessions1711000000010 = void 0;
class StaffSessions1711000000010 {
    constructor() {
        this.name = 'StaffSessions1711000000010';
    }
    async up(queryRunner) {
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
        await queryRunner.query(`CREATE INDEX idx_staff_sessions_branch_started ON staff_sessions(branch_id, started_at DESC)`);
        await queryRunner.query(`CREATE INDEX idx_staff_sessions_user_started ON staff_sessions(user_id, started_at DESC)`);
        await queryRunner.query(`CREATE INDEX idx_staff_sessions_session_id ON staff_sessions(session_id)`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS staff_sessions`);
    }
}
exports.StaffSessions1711000000010 = StaffSessions1711000000010;
//# sourceMappingURL=1711000000010-StaffSessions.js.map