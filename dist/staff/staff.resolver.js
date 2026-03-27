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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const common_1 = require("@nestjs/common");
const staff_service_1 = require("./staff.service");
const staff_dto_1 = require("./dto/staff.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
let StaffResolver = class StaffResolver {
    constructor(staffService) {
        this.staffService = staffService;
    }
    listStaff(actor, branchId) {
        return this.staffService.listStaff(actor, branchId);
    }
    staffSessionHistory(actor, branchId, limit, offset, fromDate, toDate) {
        return this.staffService.listStaffSessionHistory(actor, {
            branchId,
            limit,
            offset,
            fromDate,
            toDate,
        });
    }
    staffMember(userId, actor) {
        return this.staffService.getStaffMember(userId, actor);
    }
    inviteStaff(input, actor) {
        return this.staffService.inviteStaff(input, actor);
    }
    updateStaffProfile(input, actor) {
        return this.staffService.updateProfile(input, actor);
    }
    deactivateStaff(userId, actor) {
        return this.staffService.deactivateStaff(userId, actor);
    }
    resetStaffPassword(input, actor) {
        return this.staffService.resetPassword(input, actor);
    }
};
exports.StaffResolver = StaffResolver;
__decorate([
    (0, graphql_1.Query)(() => [staff_dto_1.StaffMemberOutput], { name: 'listStaff' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, graphql_1.Args)('branchId', { type: () => graphql_1.ID, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], StaffResolver.prototype, "listStaff", null);
__decorate([
    (0, graphql_1.Query)(() => [staff_dto_1.StaffSessionOutput], { name: 'staffSessionHistory' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, graphql_1.Args)('branchId', { type: () => graphql_1.ID, nullable: true })),
    __param(2, (0, graphql_1.Args)('limit', { type: () => graphql_1.Int, nullable: true })),
    __param(3, (0, graphql_1.Args)('offset', { type: () => graphql_1.Int, nullable: true })),
    __param(4, (0, graphql_1.Args)('fromDate', { type: () => String, nullable: true, description: 'YYYY-MM-DD (Accra calendar day)' })),
    __param(5, (0, graphql_1.Args)('toDate', { type: () => String, nullable: true, description: 'YYYY-MM-DD (Accra calendar day)' })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Number, Number, String, String]),
    __metadata("design:returntype", Promise)
], StaffResolver.prototype, "staffSessionHistory", null);
__decorate([
    (0, graphql_1.Query)(() => staff_dto_1.StaffMemberOutput, { name: 'staffMember' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician', 'cashier', 'chemical_cashier'),
    __param(0, (0, graphql_1.Args)('userId', { type: () => graphql_1.ID })),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], StaffResolver.prototype, "staffMember", null);
__decorate([
    (0, graphql_1.Mutation)(() => staff_dto_1.InviteStaffResult, { name: 'inviteStaff' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [staff_dto_1.InviteStaffInput, Object]),
    __metadata("design:returntype", Promise)
], StaffResolver.prototype, "inviteStaff", null);
__decorate([
    (0, graphql_1.Mutation)(() => staff_dto_1.StaffMemberOutput, { name: 'updateStaffProfile' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician', 'cashier', 'chemical_cashier'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [staff_dto_1.UpdateStaffProfileInput, Object]),
    __metadata("design:returntype", Promise)
], StaffResolver.prototype, "updateStaffProfile", null);
__decorate([
    (0, graphql_1.Mutation)(() => Boolean, { name: 'deactivateStaff' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, graphql_1.Args)('userId', { type: () => graphql_1.ID })),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], StaffResolver.prototype, "deactivateStaff", null);
__decorate([
    (0, graphql_1.Mutation)(() => Boolean, { name: 'resetStaffPassword' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [staff_dto_1.ResetStaffPasswordInput, Object]),
    __metadata("design:returntype", Promise)
], StaffResolver.prototype, "resetStaffPassword", null);
exports.StaffResolver = StaffResolver = __decorate([
    (0, graphql_1.Resolver)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [staff_service_1.StaffService])
], StaffResolver);
//# sourceMappingURL=staff.resolver.js.map