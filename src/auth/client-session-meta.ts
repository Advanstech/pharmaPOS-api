import type { IncomingHttpHeaders } from 'http';

export interface ClientSessionMeta {
  ip: string | null;
  userAgent: string | null;
}

/** Minimal request shape (Express-compatible) for extracting client metadata without depending on `@types/express`. */
export interface HttpRequestLike {
  headers: IncomingHttpHeaders;
  ip?: string;
  socket?: { remoteAddress?: string };
}

/** Best-effort client IP and User-Agent for staff session history (behind proxies, use X-Forwarded-For). */
export function extractClientSessionMeta(req: HttpRequestLike | undefined): ClientSessionMeta {
  if (!req) {
    return { ip: null, userAgent: null };
  }
  const forwarded = req.headers['x-forwarded-for'];
  let ip: string | null = null;
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    ip = forwarded.split(',')[0]?.trim() ?? null;
  } else if (Array.isArray(forwarded) && forwarded[0]) {
    ip = forwarded[0].split(',')[0]?.trim() ?? null;
  } else {
    const raw = req.socket?.remoteAddress ?? req.ip;
    ip = raw ? String(raw) : null;
  }
  if (ip && ip.length > 45) {
    ip = ip.slice(0, 45);
  }
  const ua = req.headers['user-agent'];
  const userAgent = typeof ua === 'string' ? ua.slice(0, 4000) : null;
  return { ip, userAgent };
}
