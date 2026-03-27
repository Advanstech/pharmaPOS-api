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
exports.AuditResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const subscription_guard_1 = require("../auth/guards/subscription.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const audit_service_1 = require("./audit.service");
const audit_types_1 = require("./dto/audit.types");
let AuditResolver = class AuditResolver {
    constructor(auditService) {
        this.auditService = auditService;
    }
    async internalAuditReport(input, user) {
        return this.auditService.getInternalAuditReport(user.branchId, input);
    }
    async dispensingComplianceAudit(input, user) {
        return this.auditService.getDispensingComplianceAudit(user.branchId, input);
    }
    async financialIntegrityAudit(input, user) {
        return this.auditService.getFinancialIntegrityAudit(user.branchId, input);
    }
    async inventoryIntegrityAudit(input, user) {
        return this.auditService.getInventoryIntegrityAudit(user.branchId, input);
    }
    async taxComplianceAudit(input, user) {
        return this.auditService.getTaxComplianceAudit(user.branchId, input);
    }
    async licenceComplianceAudit(user) {
        return this.auditService.getLicenceComplianceAudit(user.branchId);
    }
    async staffBehaviourProfiles(input, user) {
        return this.auditService.getStaffBehaviourProfiles(user.branchId, input);
    }
    async staffBehaviourProfile(input, branchId) {
        return this.auditService.getStaffBehaviourProfile(branchId, input);
    }
};
exports.AuditResolver = AuditResolver;
__decorate([
    (0, graphql_1.Query)(() => audit_types_1.InternalAuditReport, {
        description: 'Full internal audit report — Ghana FDA compliance, GRA tax, financial integrity, ' +
            'inventory integrity, licence compliance, staff behaviour profiling, and risk matrix. ' +
            'RBAC: owner and se_admin only.',
    }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [audit_types_1.AuditPeriodInput, Object]),
    __metadata("design:returntype", Promise)
], AuditResolver.prototype, "internalAuditReport", null);
__decorate([
    (0, graphql_1.Query)(() => audit_types_1.DispensingComplianceAudit, {
        description: 'Ghana FDA dispensing compliance audit — POM enforcement, Rx validity, GMDC validation, ' +
            'controlled drug sign-offs, PDF retention. RBAC: owner, se_admin, manager, head_pharmacist.',
    }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [audit_types_1.AuditPeriodInput, Object]),
    __metadata("design:returntype", Promise)
], AuditResolver.prototype, "dispensingComplianceAudit", null);
__decorate([
    (0, graphql_1.Query)(() => audit_types_1.FinancialIntegrityAudit, {
        description: 'Financial integrity audit — revenue reconciliation, void/refund analysis, ' +
            'cash dominance, duplicate invoices, expense fraud signals, GL integrity. ' +
            'RBAC: owner, se_admin only.',
    }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [audit_types_1.AuditPeriodInput, Object]),
    __metadata("design:returntype", Promise)
], AuditResolver.prototype, "financialIntegrityAudit", null);
__decorate([
    (0, graphql_1.Query)(() => audit_types_1.InventoryIntegrityAudit, {
        description: 'Inventory integrity audit — shrinkage, phantom stock, expired dispensing, ' +
            'GRN integrity, high-value adjustments. RBAC: owner, se_admin, manager.',
    }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [audit_types_1.AuditPeriodInput, Object]),
    __metadata("design:returntype", Promise)
], AuditResolver.prototype, "inventoryIntegrityAudit", null);
__decorate([
    (0, graphql_1.Query)(() => audit_types_1.TaxComplianceAudit, {
        description: 'Ghana GRA tax compliance audit — VAT gap, exemption abuse, PAYE compliance, ' +
            'withholding tax on supplier payments. RBAC: owner, se_admin only.',
    }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [audit_types_1.AuditPeriodInput, Object]),
    __metadata("design:returntype", Promise)
], AuditResolver.prototype, "taxComplianceAudit", null);
__decorate([
    (0, graphql_1.Query)(() => audit_types_1.LicenceComplianceAudit, {
        description: 'Licence and regulatory compliance — pharmacist licences, HeFRA branch licence, ' +
            'controlled drug register, cold chain. RBAC: owner, se_admin, manager.',
    }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuditResolver.prototype, "licenceComplianceAudit", null);
__decorate([
    (0, graphql_1.Query)(() => [audit_types_1.StaffBehaviourProfile], {
        description: 'Behavioural profiles for all active staff, ranked by risk score. ' +
            'Detects void abuse, discount abuse, after-hours activity, speed anomalies, ' +
            'POM bypass attempts, and refund patterns. ' +
            'Ghana DPA 2012: user IDs only — no names in findings. ' +
            'RBAC: owner, se_admin only.',
    }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [audit_types_1.AuditPeriodInput, Object]),
    __metadata("design:returntype", Promise)
], AuditResolver.prototype, "staffBehaviourProfiles", null);
__decorate([
    (0, graphql_1.Query)(() => audit_types_1.StaffBehaviourProfile, {
        description: 'Deep-dive behavioural profile for a single staff member. ' +
            'Ghana DPA 2012: user IDs only — no names in findings. ' +
            'RBAC: owner, se_admin only.',
    }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, graphql_1.Args)('branchId', { type: () => graphql_1.ID })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [audit_types_1.StaffInvestigationInput, String]),
    __metadata("design:returntype", Promise)
], AuditResolver.prototype, "staffBehaviourProfile", null);
exports.AuditResolver = AuditResolver = __decorate([
    (0, graphql_1.Resolver)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [audit_service_1.AuditService])
], AuditResolver);
//# sourceMappingURL=audit.resolver.js.map