import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { GqlExecutionContext } from '@nestjs/graphql';
import { DataSource } from 'typeorm';

/**
 * Tracks GraphQL operation activity per user for internal audit.
 * Logs operation name, type (query/mutation), and timestamp to audit_logs.
 * Excludes high-frequency polling queries to avoid noise.
 */
@Injectable()
export class ActivityTrackingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityTrackingInterceptor.name);

  // Operations to skip (high-frequency polling, auth)
  private readonly SKIP_OPS = new Set([
    'RefreshToken', 'GetOcrJob', 'IntrospectionQuery',
    '__schema', '__type',
  ]);

  constructor(private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const gqlCtx = GqlExecutionContext.create(context);
    const info = gqlCtx.getInfo();
    const req = gqlCtx.getContext()?.req;

    if (!info || !req?.user) return next.handle();

    const operationName = info.fieldName || 'unknown';
    const operationType = info.parentType?.name || 'Query'; // Query, Mutation, Subscription

    // Skip noisy operations
    if (this.SKIP_OPS.has(operationName)) return next.handle();

    const userId = req.user.sub;
    const branchId = req.user.branchId;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          // Only log mutations and significant queries (skip fast reads)
          if (operationType === 'Mutation' || duration > 500) {
            this.logActivity(branchId, userId, operationName, operationType, duration, req.ip).catch(() => {});
          }
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          this.logActivity(branchId, userId, operationName, operationType, duration, req.ip, err.message).catch(() => {});
        },
      }),
    );
  }

  private async logActivity(
    branchId: string,
    userId: string,
    operation: string,
    operationType: string,
    durationMs: number,
    ipAddress?: string,
    errorMessage?: string,
  ): Promise<void> {
    try {
      await this.dataSource.query(
        `INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, ip_address, metadata)
         VALUES (gen_random_uuid(), $1, $2, 'STAFF_ACTIVITY', 'operation', $3, $4)`,
        [
          branchId,
          userId,
          ipAddress || null,
          JSON.stringify({
            operation,
            operationType,
            durationMs,
            error: errorMessage || undefined,
            timestamp: new Date().toISOString(),
          }),
        ],
      );
    } catch {
      // Silently fail — activity tracking should never break the app
    }
  }
}
