"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const graphql_1 = require("@nestjs/graphql");
function normalizeHeaders(rawHeaders) {
    var _a;
    const out = {};
    if (!rawHeaders || typeof rawHeaders !== 'object' || Array.isArray(rawHeaders))
        return out;
    for (const [k, v] of Object.entries(rawHeaders)) {
        if (v === undefined)
            continue;
        out[k.toLowerCase()] = Array.isArray(v) ? String((_a = v[0]) !== null && _a !== void 0 ? _a : '') : String(v);
    }
    return out;
}
let JwtAuthGuard = class JwtAuthGuard extends (0, passport_1.AuthGuard)('jwt') {
    getRequest(context) {
        var _a, _b, _c, _d, _e, _f;
        const ctx = graphql_1.GqlExecutionContext.create(context);
        const gqlContext = (_a = ctx.getContext()) !== null && _a !== void 0 ? _a : {};
        const connectionParams = (_b = gqlContext.connectionParams) !== null && _b !== void 0 ? _b : {};
        const wsToken = (_e = (_d = (_c = connectionParams.Authorization) !== null && _c !== void 0 ? _c : connectionParams.authorization) !== null && _d !== void 0 ? _d : connectionParams.token) !== null && _e !== void 0 ? _e : '';
        const rawReq = gqlContext.req;
        if (rawReq != null && typeof rawReq === 'object') {
            const headers = normalizeHeaders(rawReq.headers);
            let authorization = (_f = headers.authorization) !== null && _f !== void 0 ? _f : '';
            if (!authorization && wsToken) {
                authorization = wsToken.startsWith('Bearer ') ? wsToken : `Bearer ${wsToken}`;
            }
            rawReq.headers = Object.assign(Object.assign({}, headers), { authorization });
            return rawReq;
        }
        const authValue = wsToken;
        const authorization = authValue.startsWith('Bearer ')
            ? authValue
            : authValue
                ? `Bearer ${authValue}`
                : '';
        return { headers: { authorization } };
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)()
], JwtAuthGuard);
//# sourceMappingURL=jwt-auth.guard.js.map