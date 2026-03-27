"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchTypeGuard = void 0;
const graphql_1 = require("@nestjs/graphql");
const graphql_2 = require("graphql");
const BranchTypeGuard = (requiredType) => class {
    canActivate(context) {
        var _a;
        const ctx = graphql_1.GqlExecutionContext.create(context);
        const user = (_a = ctx.getContext().req) === null || _a === void 0 ? void 0 : _a.user;
        if ((user === null || user === void 0 ? void 0 : user.branchType) !== requiredType) {
            throw new graphql_2.GraphQLError('This operation is not permitted at this branch type', {
                extensions: {
                    code: 'BRANCH_VIOLATION',
                    message: 'Prescription medicines cannot be dispensed at a chemical shop.',
                },
            });
        }
        return true;
    }
};
exports.BranchTypeGuard = BranchTypeGuard;
//# sourceMappingURL=branch-type.guard.js.map