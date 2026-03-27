import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';

export const ROLES_KEY = 'roles';

// RBAC: roles decorator — applied to resolvers
export const Roles = (...roles: string[]) =>
  (target: object, key?: string | symbol, descriptor?: PropertyDescriptor) => {
    Reflect.defineMetadata(ROLES_KEY, roles, descriptor?.value ?? target);
    return descriptor ?? target;
  };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(ROLES_KEY, context.getHandler());
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const ctx = GqlExecutionContext.create(context);
    const gqlCtx = ctx.getContext() as { req?: { user?: { role?: string } } } | undefined;
    const user = gqlCtx?.req?.user as { role?: string } | undefined;

    if (!user?.role || !requiredRoles.includes(user.role)) {
      // RBAC: throw FORBIDDEN with role details in dev
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role '${user?.role ?? 'unknown'}' is not authorised. Required: ${requiredRoles.join(', ')}`,
      });
    }
    return true;
  }
}
