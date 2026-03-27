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
exports.AuthPayload = exports.RegisterInput = exports.LoginInput = void 0;
const graphql_1 = require("@nestjs/graphql");
const class_validator_1 = require("class-validator");
const user_entity_1 = require("../entities/user.entity");
let LoginInput = class LoginInput {
};
exports.LoginInput = LoginInput;
__decorate([
    (0, graphql_1.Field)({ description: 'Registered email address' }),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], LoginInput.prototype, "email", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Account password (min 6 characters)' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(6),
    __metadata("design:type", String)
], LoginInput.prototype, "password", void 0);
exports.LoginInput = LoginInput = __decorate([
    (0, graphql_1.InputType)({ description: 'Credentials for authenticating an existing user' })
], LoginInput);
let RegisterInput = class RegisterInput {
};
exports.RegisterInput = RegisterInput;
__decorate([
    (0, graphql_1.Field)({ description: 'UUID of the branch this user belongs to' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegisterInput.prototype, "branch_id", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Full display name of the user' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegisterInput.prototype, "name", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Unique email address — used as login identifier' }),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], RegisterInput.prototype, "email", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Password — minimum 8 characters. Stored as bcrypt hash (cost 12).' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    __metadata("design:type", String)
], RegisterInput.prototype, "password", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Role assigned to this user. Valid values: `owner` | `head_pharmacist` | `pharmacist` | `cashier` | `manager` | `se_admin`',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegisterInput.prototype, "role", void 0);
exports.RegisterInput = RegisterInput = __decorate([
    (0, graphql_1.InputType)({ description: 'Register a new user account within a branch' })
], RegisterInput);
let AuthPayload = class AuthPayload {
};
exports.AuthPayload = AuthPayload;
__decorate([
    (0, graphql_1.Field)({
        description: 'Short-lived JWT access token. Valid for **15 minutes**. ' +
            'Include as `Authorization: Bearer <token>` on every GraphQL request.',
    }),
    __metadata("design:type", String)
], AuthPayload.prototype, "access_token", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Long-lived refresh token. Valid for **30 days**. ' +
            'Use with the `refreshToken` mutation to obtain a new access token. ' +
            'Invalidated on logout.',
    }),
    __metadata("design:type", String)
], AuthPayload.prototype, "refresh_token", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Access token lifetime in seconds. Always `900` (15 minutes).',
    }),
    __metadata("design:type", Number)
], AuthPayload.prototype, "expires_in", void 0);
__decorate([
    (0, graphql_1.Field)(() => user_entity_1.User, { description: 'Authenticated user profile' }),
    __metadata("design:type", user_entity_1.User)
], AuthPayload.prototype, "user", void 0);
exports.AuthPayload = AuthPayload = __decorate([
    (0, graphql_1.ObjectType)({
        description: 'Returned on successful login, register, or token refresh. ' +
            'Store `access_token` in memory (never localStorage). ' +
            'Store `refresh_token` in an httpOnly cookie.',
    })
], AuthPayload);
//# sourceMappingURL=auth.types.js.map