/**
 * Canonical role strings for JWT claims and GraphQL user objects (web RBAC).
 * @see PharmaPOS-web GraphQL handoff
 */
const KNOWN_ROLES = new Set([
  'owner',
  'se_admin',
  'manager',
  'head_pharmacist',
  'pharmacist',
  'technician',
  'cashier',
  'chemical_cashier',
]);

/**
 * Normalizes stored role strings to lowercase snake_case for API responses and JWTs.
 */
export function normalizeRoleForApi(role: string): string {
  const t = role.trim().toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_');
  if (KNOWN_ROLES.has(t)) return t;
  return t;
}
