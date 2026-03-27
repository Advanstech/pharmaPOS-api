import { BranchTypeGuard } from '../../src/auth/guards/branch-type.guard';
import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';

/**
 * Ghana FDA Compliance Test: Chemical Shop Isolation
 * Branch type 'chemical' CANNOT process ANY POM — ever.
 */

function mockCtxWithUser(branchType: string): ExecutionContext {
  jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
    getArgs: () => ({}),
    getContext: () => ({ req: { user: { branchType } } }),
  } as unknown as GqlExecutionContext);

  return {} as ExecutionContext;
}

describe('BranchTypeGuard — Chemical Shop Isolation', () => {
  const GuardClass = BranchTypeGuard('pharmaceutical');

  afterEach(() => jest.restoreAllMocks());

  it('allows pharmaceutical branch to access Rx endpoints', () => {
    const ctx = mockCtxWithUser('pharmaceutical');
    const guard = new GuardClass();
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('blocks chemical branch from Rx endpoints — throws BRANCH_VIOLATION', () => {
    const ctx = mockCtxWithUser('chemical');
    const guard = new GuardClass();
    expect(() => guard.canActivate(ctx)).toThrow(GraphQLError);
    try {
      guard.canActivate(ctx);
    } catch (err) {
      expect((err as GraphQLError).extensions?.['code']).toBe('BRANCH_VIOLATION');
    }
  });

  it('blocks undefined branch type', () => {
    const ctx = mockCtxWithUser('');
    const guard = new GuardClass();
    expect(() => guard.canActivate(ctx)).toThrow(GraphQLError);
  });

  it('error message contains no PHI', () => {
    const ctx = mockCtxWithUser('chemical');
    const guard = new GuardClass();
    try {
      guard.canActivate(ctx);
    } catch (err) {
      const msg = (err as GraphQLError).extensions?.['message'] as string;
      expect(msg).not.toMatch(/patient|name|phone|customer/i);
    }
  });
});
