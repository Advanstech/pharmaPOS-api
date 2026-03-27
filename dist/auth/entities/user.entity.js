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
exports.User = void 0;
const typeorm_1 = require("typeorm");
const graphql_1 = require("@nestjs/graphql");
let User = class User {
};
exports.User = User;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the user account' }),
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], User.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'UUID of the branch this user belongs to' }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], User.prototype, "branch_id", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Full display name' }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], User.prototype, "name", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Email address — used as login identifier. Unique across the platform.',
    }),
    (0, typeorm_1.Column)({ nullable: true, unique: true }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, graphql_1.Field)({
        nullable: true,
        description: 'Phone number. Stored in plain text on the user record (PII encrypted in staff_profiles).',
    }),
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], User.prototype, "phone", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: 'Assigned role. Controls access to all mutations and queries. ' +
            'Values: `owner` | `head_pharmacist` | `pharmacist` | `cashier` | `manager` | `se_admin`',
    }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], User.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], User.prototype, "password_hash", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: '`true` if multi-factor authentication is enabled for this account. ' +
            'MFA is required for `owner` and `head_pharmacist` roles in production.',
    }),
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "mfa_enabled", void 0);
__decorate([
    (0, graphql_1.Field)({
        description: '`true` if the account is active. Deactivated accounts cannot log in. ' +
            'Use soft-deactivation instead of deletion — audit trail is preserved.',
    }),
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], User.prototype, "is_active", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'ISO 8601 timestamp when the account was created (Africa/Accra timezone)' }),
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], User.prototype, "created_at", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'ISO 8601 timestamp of the last account update' }),
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], User.prototype, "updated_at", void 0);
exports.User = User = __decorate([
    (0, graphql_1.ObjectType)({
        description: 'An authenticated user account. Scoped to a single branch. ' +
            '`password_hash` is never exposed via GraphQL.',
    }),
    (0, typeorm_1.Entity)('users')
], User);
//# sourceMappingURL=user.entity.js.map