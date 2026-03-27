import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';

type GqlCtx = {
  req?: {
    headers?: Record<string, string | string[] | undefined>;
    user?: unknown;
    [key: string]: unknown;
  };
  connectionParams?: Record<string, unknown>;
};

/**
 * Merge HTTP headers (lower-cased keys) and ensure `headers.authorization` always exists
 * so passport-jwt's `fromAuthHeaderAsBearerToken()` never reads `undefined.authorization`.
 * WebSocket subscription contexts often omit `req` or ship `req` without `headers`.
 */
function normalizeHeaders(
  rawHeaders: Record<string, string | string[] | undefined> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!rawHeaders || typeof rawHeaders !== 'object' || Array.isArray(rawHeaders)) return out;
  for (const [k, v] of Object.entries(rawHeaders)) {
    if (v === undefined) continue;
    out[k.toLowerCase()] = Array.isArray(v) ? String(v[0] ?? '') : String(v);
  }
  return out;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    const gqlContext = (ctx.getContext() as GqlCtx | undefined) ?? {};

    const connectionParams = gqlContext.connectionParams ?? {};
    const wsToken =
      (connectionParams.Authorization as string | undefined) ??
      (connectionParams.authorization as string | undefined) ??
      (connectionParams.token as string | undefined) ??
      '';

    const rawReq = gqlContext.req;
    if (rawReq != null && typeof rawReq === 'object') {
      const headers = normalizeHeaders(rawReq.headers);
      let authorization = headers.authorization ?? '';
      if (!authorization && wsToken) {
        authorization = wsToken.startsWith('Bearer ') ? wsToken : `Bearer ${wsToken}`;
      }
      // Mutate the same object GraphQL exposes as `context.req`. Passport attaches `user`
      // to the object returned here — a spread `{ ...rawReq, headers }` breaks reference
      // equality so RolesGuard sees `req.user` as undefined → Role 'unknown'.
      (rawReq as { headers: Record<string, string> }).headers = {
        ...headers,
        authorization,
      };
      return rawReq as GqlCtx['req'] & { headers: Record<string, string> };
    }

    const authValue = wsToken;
    const authorization = authValue.startsWith('Bearer ')
      ? authValue
      : authValue
        ? `Bearer ${authValue}`
        : '';

    return { headers: { authorization } };
  }
}
