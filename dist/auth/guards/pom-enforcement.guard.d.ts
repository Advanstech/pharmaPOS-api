import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class PomEnforcementGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean;
}
