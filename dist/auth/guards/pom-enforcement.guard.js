"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PomEnforcementGuard = void 0;
const common_1 = require("@nestjs/common");
const graphql_1 = require("@nestjs/graphql");
const graphql_2 = require("graphql");
let PomEnforcementGuard = class PomEnforcementGuard {
    canActivate(context) {
        var _a, _b;
        const ctx = graphql_1.GqlExecutionContext.create(context);
        const args = ctx.getArgs();
        const items = (_b = (_a = args.input) === null || _a === void 0 ? void 0 : _a.items) !== null && _b !== void 0 ? _b : [];
        for (const item of items) {
            if (item.requiresRx && !item.prescriptionId) {
                throw new graphql_2.GraphQLError('Prescription required for POM product', {
                    extensions: {
                        code: 'FDA_POM_VIOLATION',
                        message: 'A valid prescription is required before dispensing this medicine.',
                    },
                });
            }
        }
        return true;
    }
};
exports.PomEnforcementGuard = PomEnforcementGuard;
exports.PomEnforcementGuard = PomEnforcementGuard = __decorate([
    (0, common_1.Injectable)()
], PomEnforcementGuard);
//# sourceMappingURL=pom-enforcement.guard.js.map