/**
 * Browser origins allowed for CORS and graphql-ws (WEB_URL).
 * Comma-separated in env — same list for HTTP POST and WebSocket upgrade.
 */
export function parseAllowedOriginsFromEnv(): string[] {
  return (process.env['WEB_URL'] ?? 'http://localhost:3000')
    .split(',')
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
}

/** Non-browser clients may omit Origin; `*` in WEB_URL allows any (dev only). */
export function isOriginAllowed(origin: string | undefined): boolean {
  const allowed = parseAllowedOriginsFromEnv();
  if (allowed.includes('*')) return true;
  if (!origin) return true;
  return allowed.includes(origin);
}
