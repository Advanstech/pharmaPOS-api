"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddProductCostHistory1711000000006 = void 0;
class AddProductCostHistory1711000000006 {
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE product_cost_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id UUID NOT NULL REFERENCES branches(id),
        product_id UUID NOT NULL REFERENCES products(id),
        supplier_id UUID REFERENCES suppliers(id),
        source_type VARCHAR(20) NOT NULL
          CHECK (source_type IN ('GRN', 'INVOICE', 'MANUAL')),
        source_reference_id UUID,
        unit_cost_pesewas INTEGER NOT NULL CHECK (unit_cost_pesewas > 0),
        currency VARCHAR(3) NOT NULL DEFAULT 'GHS',
        observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
        await queryRunner.query(`
      CREATE INDEX idx_product_cost_history_branch_product_observed
      ON product_cost_history(branch_id, product_id, observed_at DESC)
    `);
        await queryRunner.query(`
      CREATE INDEX idx_product_cost_history_source_reference
      ON product_cost_history(source_type, source_reference_id)
    `);
        await queryRunner.query(`ALTER TABLE product_cost_history ENABLE ROW LEVEL SECURITY`);
        await queryRunner.query(`
      CREATE POLICY branch_isolation ON product_cost_history
        USING (branch_id = current_setting('app.current_branch_id', true)::uuid)
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP POLICY IF EXISTS branch_isolation ON product_cost_history`);
        await queryRunner.query(`DROP TABLE IF EXISTS product_cost_history`);
    }
}
exports.AddProductCostHistory1711000000006 = AddProductCostHistory1711000000006;
//# sourceMappingURL=1711000000006-AddProductCostHistory.js.map