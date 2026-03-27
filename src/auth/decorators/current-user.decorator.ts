import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export interface JwtUser {
  sub: string;
  role: string;
  branchId: string;
  branchType: 'pharmaceutical' | 'chemical';
  sessionId: string;
}

/**
 * RBAC: extracts authenticated user from GQL context.
 * Usage: @CurrentUser() user: JwtUser
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtUser => {
    const ctx = GqlExecutionContext.create(context);
    const gqlCtx = ctx.getContext() as { req?: { user?: JwtUser } } | undefined;
    const user = gqlCtx?.req?.user;
    if (!user) {
      throw new UnauthorizedException('Missing authenticated user on request context');
    }
    return user as JwtUser;
  },
);
