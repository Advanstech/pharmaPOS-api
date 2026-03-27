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
exports.PharmacyResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const common_1 = require("@nestjs/common");
const pharmacy_service_1 = require("./pharmacy.service");
const pharmacy_types_1 = require("./dto/pharmacy.types");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const branch_type_guard_1 = require("../auth/guards/branch-type.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
let PharmacyResolver = class PharmacyResolver {
    constructor(pharmacyService) {
        this.pharmacyService = pharmacyService;
    }
    createPrescription(input, actor) {
        return this.pharmacyService.createPrescription(input, actor);
    }
    verifyPrescription(input, actor) {
        return this.pharmacyService.verifyPrescription(input, actor);
    }
    prescription(id, _actor) {
        return this.pharmacyService.getPrescription(id);
    }
    pendingPrescriptions(actor) {
        return this.pharmacyService.getPendingPrescriptions(actor.branchId);
    }
    prescriptionsForProduct(productId, actor) {
        return this.pharmacyService.getPrescriptionsForProduct(actor.branchId, productId);
    }
    async validateGmdcLicence(licenceNo) {
        const result = await this.pharmacyService.validateGmdcLicence(licenceNo);
        return Object.assign({ licenceNo }, result);
    }
};
exports.PharmacyResolver = PharmacyResolver;
__decorate([
    (0, graphql_1.Mutation)(() => pharmacy_types_1.PrescriptionOutput, { name: 'createPrescription' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician'),
    (0, common_1.UseGuards)((0, branch_type_guard_1.BranchTypeGuard)('pharmaceutical')),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pharmacy_types_1.CreatePrescriptionInput, Object]),
    __metadata("design:returntype", Promise)
], PharmacyResolver.prototype, "createPrescription", null);
__decorate([
    (0, graphql_1.Mutation)(() => pharmacy_types_1.PrescriptionOutput, { name: 'verifyPrescription' }),
    (0, roles_decorator_1.Roles)('head_pharmacist', 'pharmacist'),
    (0, common_1.UseGuards)((0, branch_type_guard_1.BranchTypeGuard)('pharmaceutical')),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pharmacy_types_1.VerifyPrescriptionInput, Object]),
    __metadata("design:returntype", Promise)
], PharmacyResolver.prototype, "verifyPrescription", null);
__decorate([
    (0, graphql_1.Query)(() => pharmacy_types_1.PrescriptionOutput, { name: 'prescription' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician'),
    __param(0, (0, graphql_1.Args)('id', { type: () => graphql_1.ID })),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PharmacyResolver.prototype, "prescription", null);
__decorate([
    (0, graphql_1.Query)(() => [pharmacy_types_1.PrescriptionOutput], { name: 'pendingPrescriptions' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PharmacyResolver.prototype, "pendingPrescriptions", null);
__decorate([
    (0, graphql_1.Query)(() => [pharmacy_types_1.PrescriptionOutput], { name: 'prescriptionsForProduct' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician', 'cashier'),
    (0, common_1.UseGuards)((0, branch_type_guard_1.BranchTypeGuard)('pharmaceutical')),
    __param(0, (0, graphql_1.Args)('productId', { type: () => graphql_1.ID })),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PharmacyResolver.prototype, "prescriptionsForProduct", null);
__decorate([
    (0, graphql_1.Query)(() => pharmacy_types_1.GmdcValidationResult, { name: 'validateGmdcLicence' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist'),
    __param(0, (0, graphql_1.Args)('licenceNo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PharmacyResolver.prototype, "validateGmdcLicence", null);
exports.PharmacyResolver = PharmacyResolver = __decorate([
    (0, graphql_1.Resolver)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [pharmacy_service_1.PharmacyService])
], PharmacyResolver);
//# sourceMappingURL=pharmacy.resolver.js.map