import { ExecutionContext } from '@nestjs/common';
declare const JwtAuthGuard_base: import("@nestjs/passport").Type<import("@nestjs/passport").IAuthGuard>;
export declare class JwtAuthGuard extends JwtAuthGuard_base {
    getRequest(context: ExecutionContext): {
        [key: string]: unknown;
        headers?: Record<string, string | string[] | undefined>;
        user?: unknown;
    } & {
        headers: Record<string, string>;
    };
}
export {};
