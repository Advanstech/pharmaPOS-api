"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolesGuard = exports.Roles = exports.ROLES_KEY = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const graphql_1 = require("@nestjs/graphql");
exports.ROLES_KEY = 'roles';
const Roles = (...roles) => (target, key, descriptor) => {
    var _a;
    Reflect.defineMetadata(exports.ROLES_KEY, roles, (_a = descriptor === null || descriptor === void 0 ? void 0 : descriptor.value) !== null && _a !== void 0 ? _a : target);
    return descriptor !== null && descriptor !== void 0 ? descriptor : target;
};
exports.Roles = Roles;
let RolesGuard = class RolesGuard {
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        var _a, _b;
        const requiredRoles = this.reflector.get(exports.ROLES_KEY, context.getHandler());
        if (!requiredRoles || requiredRoles.length === 0)
            return true;
        const ctx = graphql_1.GqlExecutionContext.create(context);
        const gqlCtx = ctx.getContext();
        const user = (_a = gqlCtx === null || gqlCtx === void 0 ? void 0 : gqlCtx.req) === null || _a === void 0 ? void 0 : _a.user;
        if (!(user === null || user === void 0 ? void 0 : user.role) || !requiredRoles.includes(user.role)) {
            throw new common_1.ForbiddenException({
                code: 'FORBIDDEN',
                message: `Role '${(_b = user === null || user === void 0 ? void 0 : user.role) !== null && _b !== void 0 ? _b : 'unknown'}' is not authorised. Required: ${requiredRoles.join(', ')}`,
            });
        }
        return true;
    }
};
exports.RolesGuard = RolesGuard;
exports.RolesGuard = RolesGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], RolesGuard);
//# sourceMappingURL=roles.guard.js.map