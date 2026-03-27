"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FixGRNPurchaseOrderOptional1711000000005 = void 0;
class FixGRNPurchaseOrderOptional1711000000005 {
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE goods_received_notes
      ALTER COLUMN purchase_order_id DROP NOT NULL
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE goods_received_notes
      ALTER COLUMN purchase_order_id SET NOT NULL
    `);
    }
}
exports.FixGRNPurchaseOrderOptional1711000000005 = FixGRNPurchaseOrderOptional1711000000005;
//# sourceMappingURL=1711000000005-FixGRNPurchaseOrderOptional.js.map