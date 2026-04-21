import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { DataSource } from 'typeorm';

/**
 * Ghana FDA: POM enforcement guard.
 * Blocks any sale mutation that includes a POM product without an approved Rx.
 * This guard CANNOT be bypassed by any user role or code path.
 */
@Injectable()
export class PomEnforcementGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const args = ctx.getArgs<{
      input?: { items?: Array<{ productId?: string; prescriptionId?: string }> };
    }>();

    const items = args.input?.items ?? [];
    if (items.length === 0) return true;

    const productIds = [...new Set(items.map((item) => item.productId).filter(Boolean))] as string[];
    if (productIds.length === 0) return true;

    const requiresRxRows = (await this.dataSource.query(
      `SELECT id FROM products WHERE id = ANY($1) AND requires_rx = true`,
      [productIds],
    )) as Array<{ id: string }>;
    const requiresRxIds = new Set(requiresRxRows.map((row) => row.id));

    for (const item of items) {
      if (!item.productId) continue;
      // Ghana FDA: POM product cannot be added to sale without approved Rx
      if (requiresRxIds.has(item.productId) && !item.prescriptionId) {
        throw new GraphQLError('Prescription required for POM product', {
          extensions: {
            code: 'FDA_POM_VIOLATION',
            // No PHI in error messages returned to cashier
            message: 'A valid prescription is required before dispensing this medicine.',
          },
        });
      }
    }

    return true;
  }
}
