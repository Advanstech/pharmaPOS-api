import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';

/**
 * Ghana FDA: POM enforcement guard.
 * Blocks any sale mutation that includes a POM product without an approved Rx.
 * This guard CANNOT be bypassed by any user role or code path.
 */
@Injectable()
export class PomEnforcementGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const args = ctx.getArgs<{ input?: { items?: Array<{ requiresRx?: boolean; prescriptionId?: string }> } }>();

    const items = args.input?.items ?? [];

    for (const item of items) {
      // Ghana FDA: POM product cannot be added to sale without approved Rx
      if (item.requiresRx && !item.prescriptionId) {
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
