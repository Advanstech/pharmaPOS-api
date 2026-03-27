import { ExecutionContext } from '@nestjs/common';
export declare const BranchTypeGuard: (requiredType: "pharmaceutical") => {
    new (): {
        canActivate(context: ExecutionContext): boolean;
    };
};
