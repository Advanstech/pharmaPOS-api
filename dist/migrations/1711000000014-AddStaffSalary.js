"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddStaffSalary1711000000014 = void 0;
class AddStaffSalary1711000000014 {
    constructor() {
        this.name = 'AddStaffSalary1711000000014';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE staff_profiles
        ADD COLUMN IF NOT EXISTS salary_amount_pesewas BIGINT,
        ADD COLUMN IF NOT EXISTS salary_currency VARCHAR(3) NOT NULL DEFAULT 'GHS',
        ADD COLUMN IF NOT EXISTS salary_period VARCHAR(20) DEFAULT 'monthly'
          CHECK (salary_period IN ('daily','weekly','monthly','annual')),
        ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
        ADD COLUMN IF NOT EXISTS bank_account_encrypted TEXT,
        ADD COLUMN IF NOT EXISTS momo_number_encrypted TEXT
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE staff_profiles
        DROP COLUMN IF EXISTS salary_amount_pesewas,
        DROP COLUMN IF EXISTS salary_currency,
        DROP COLUMN IF EXISTS salary_period,
        DROP COLUMN IF EXISTS bank_name,
        DROP COLUMN IF EXISTS bank_account_encrypted,
        DROP COLUMN IF EXISTS momo_number_encrypted
    `);
    }
}
exports.AddStaffSalary1711000000014 = AddStaffSalary1711000000014;
//# sourceMappingURL=1711000000014-AddStaffSalary.js.map