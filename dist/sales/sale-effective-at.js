"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saleEffectiveAtExpr = saleEffectiveAtExpr;
function saleEffectiveAtExpr(tableAlias) {
    return `COALESCE(${tableAlias}.sold_at, ${tableAlias}.created_at)`;
}
//# sourceMappingURL=sale-effective-at.js.map