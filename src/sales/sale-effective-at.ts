/**
 * Static SQL when you know `sales.sold_at` exists (e.g. tests).
 * Runtime code should use {@link SalesEffectiveAtService} so DBs without migration 1711000000009 still work.
 */
export function saleEffectiveAtExpr(tableAlias: string): string {
  return `COALESCE(${tableAlias}.sold_at, ${tableAlias}.created_at)`;
}
