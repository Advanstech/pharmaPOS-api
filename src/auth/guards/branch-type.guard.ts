import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';

/**
 * Ghana FDA: Chemical shop branch isolation guard.
 * Branch type 'chemical' CANNOT process ANY POM product — ever.
 * Applied to all Rx endpoints.
 */
export const BranchTypeGuard = (requiredType: 'pharmaceutical') =>
  class implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const ctx = GqlExecutionContext.create(context);
      const user = ctx.getContext().req?.user as { branchType?: string } | undefined;

      // Ghana FDA: chemical shop cannot process POM
      if (user?.branchType !== requiredType) {
        throw new GraphQLError('This operation is not permitted at this branch type', {
          extensions: {
            code: 'BRANCH_VIOLATION',
            message: 'Prescription medicines cannot be dispensed at a chemical shop.',
          },
        });
      }
      return true;
    }
  };
