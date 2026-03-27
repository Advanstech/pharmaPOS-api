"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentUser = void 0;
const common_1 = require("@nestjs/common");
const graphql_1 = require("@nestjs/graphql");
exports.CurrentUser = (0, common_1.createParamDecorator)((_data, context) => {
    var _a;
    const ctx = graphql_1.GqlExecutionContext.create(context);
    const gqlCtx = ctx.getContext();
    const user = (_a = gqlCtx === null || gqlCtx === void 0 ? void 0 : gqlCtx.req) === null || _a === void 0 ? void 0 : _a.user;
    if (!user) {
        throw new common_1.UnauthorizedException('Missing authenticated user on request context');
    }
    return user;
});
//# sourceMappingURL=current-user.decorator.js.map