"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddExpensesTable1711000000004 = void 0;
class AddExpensesTable1711000000004 {
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE expenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id UUID NOT NULL REFERENCES branches(id),
        category VARCHAR(50) NOT NULL CHECK (category IN (
          'UTILITIES','RENT','SALARIES','FUEL','MAINTENANCE',
          'MARKETING','LICENSES','BANK_CHARGES','MISCELLANEOUS'
        )),
        amount_pesewas INTEGER NOT NULL CHECK (amount_pesewas > 0),
        description TEXT NOT NULL,
        receipt_s3_key TEXT,
        expense_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
          CHECK (status IN ('PENDING','APPROVED','PAID','REJECTED')),
        created_by UUID NOT NULL REFERENCES users(id),
        approved_by UUID REFERENCES users(id),
        approval_notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
        await queryRunner.query(`CREATE INDEX idx_expenses_branch ON expenses(branch_id, expense_date DESC)`);
        await queryRunner.query(`CREATE INDEX idx_expenses_status ON expenses(status)`);
        await queryRunner.query(`ALTER TABLE expenses ENABLE ROW LEVEL SECURITY`);
        await queryRunner.query(`
      CREATE POLICY branch_isolation ON expenses
        USING (branch_id = current_setting('app.current_branch_id', true)::uuid)
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS expenses CASCADE`);
    }
}
exports.AddExpensesTable1711000000004 = AddExpensesTable1711000000004;
//# sourceMappingURL=1711000000004-AddExpensesTable.js.map