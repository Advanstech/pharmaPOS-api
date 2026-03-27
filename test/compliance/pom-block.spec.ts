import { PomEnforcementGuard } from '../../src/auth/guards/pom-enforcement.guard';
import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';

/**
 * Ghana FDA Compliance Test: POM Enforcement
 * These tests verify the API-level POM block cannot be bypassed.
 * Coverage target: 100% of POM enforcement rules.
 */

type CartItem = { requiresRx?: boolean; prescriptionId?: string };

function mockContext(items: CartItem[]): ExecutionContext {
  // Stub GqlExecutionContext.create so the guard's getArgs() returns our items
  jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
    getArgs: () => ({ input: { items } }),
    getContext: () => ({ req: { user: { branchType: 'pharmaceutical' } } }),
  } as unknown as GqlExecutionContext);

  return {} as ExecutionContext;
}

describe('PomEnforcementGuard — Ghana FDA POM Block', () => {
  let guard: PomEnforcementGuard;

  beforeEach(() => {
    guard = new PomEnforcementGuard();
  });

  afterEach(() => jest.restoreAllMocks());

  it('allows OTC items without prescription', () => {
    const ctx = mockContext([{ requiresRx: false }]);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows POM item WITH approved prescription ID', () => {
    const ctx = mockContext([{ requiresRx: true, prescriptionId: 'rx-uuid-123' }]);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('blocks POM item WITHOUT prescription — throws FDA_POM_VIOLATION', () => {
    const ctx = mockContext([{ requiresRx: true }]);
    expect(() => guard.canActivate(ctx)).toThrow(GraphQLError);
    try {
      guard.canActivate(ctx);
    } catch (err) {
      expect((err as GraphQLError).extensions?.['code']).toBe('FDA_POM_VIOLATION');
    }
  });

  it('blocks mixed cart with one POM item missing Rx', () => {
    const ctx = mockContext([
      { requiresRx: false },
      { requiresRx: true, prescriptionId: 'rx-uuid-123' },
      { requiresRx: true }, // missing Rx — should block
    ]);
    expect(() => guard.canActivate(ctx)).toThrow(GraphQLError);
  });

  it('allows empty cart', () => {
    const ctx = mockContext([]);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('error message contains no PHI — only generic message', () => {
    const ctx = mockContext([{ requiresRx: true }]);
    try {
      guard.canActivate(ctx);
    } catch (err) {
      const msg = (err as GraphQLError).extensions?.['message'] as string;
      // No PHI in error messages (Ghana Data Protection Act 2012)
      expect(msg).not.toMatch(/patient|name|phone|customer/i);
      expect(msg).toContain('prescription');
    }
  });
});
