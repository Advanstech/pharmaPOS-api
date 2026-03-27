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
exports.SuppliersResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const suppliers_service_1 = require("./suppliers.service");
const supplier_entity_1 = require("./entities/supplier.entity");
const supplier_input_1 = require("./dto/supplier.input");
const supplier_watch_types_1 = require("./dto/supplier-watch.types");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
let SuppliersResolver = class SuppliersResolver {
    constructor(suppliersService) {
        this.suppliersService = suppliersService;
    }
    async listSuppliers() {
        return this.suppliersService.listSuppliers();
    }
    async getSupplier(id) {
        return this.suppliersService.getSupplierById(id);
    }
    async supplierRestockWatch(actor) {
        return this.suppliersService.getSupplierRestockWatch(actor.branchId);
    }
    async createSupplier(input) {
        return this.suppliersService.createSupplier(input);
    }
    async updateSupplier(id, input) {
        return this.suppliersService.updateSupplier(id, input);
    }
    async deleteSupplier(id) {
        return this.suppliersService.deleteSupplier(id);
    }
};
exports.SuppliersResolver = SuppliersResolver;
__decorate([
    (0, graphql_1.Query)(() => [supplier_entity_1.Supplier], { name: 'suppliers' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician', 'cashier', 'chemical_cashier'),
    (0, swagger_1.ApiOperation)({ summary: 'List all suppliers with full traceability chain' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SuppliersResolver.prototype, "listSuppliers", null);
__decorate([
    (0, graphql_1.Query)(() => supplier_entity_1.Supplier, { name: 'supplier' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician'),
    (0, swagger_1.ApiOperation)({ summary: 'Get supplier by ID' }),
    __param(0, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SuppliersResolver.prototype, "getSupplier", null);
__decorate([
    (0, graphql_1.Query)(() => [supplier_watch_types_1.SupplierRestockWatch], { name: 'supplierRestockWatch' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician'),
    (0, swagger_1.ApiOperation)({ summary: 'Branch supplier restock watch with low/critical/out stock signals' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SuppliersResolver.prototype, "supplierRestockWatch", null);
__decorate([
    (0, graphql_1.Mutation)(() => supplier_entity_1.Supplier),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist'),
    (0, swagger_1.ApiOperation)({ summary: 'Create new supplier (owner/se_admin/manager/head pharmacist)' }),
    __param(0, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [supplier_input_1.CreateSupplierInput]),
    __metadata("design:returntype", Promise)
], SuppliersResolver.prototype, "createSupplier", null);
__decorate([
    (0, graphql_1.Mutation)(() => supplier_entity_1.Supplier),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist'),
    (0, swagger_1.ApiOperation)({ summary: 'Update supplier details (owner/se_admin/manager/head pharmacist)' }),
    __param(0, (0, graphql_1.Args)('id')),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, supplier_input_1.UpdateSupplierInput]),
    __metadata("design:returntype", Promise)
], SuppliersResolver.prototype, "updateSupplier", null);
__decorate([
    (0, graphql_1.Mutation)(() => Boolean),
    (0, roles_decorator_1.Roles)('owner'),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete supplier (owner only)' }),
    __param(0, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SuppliersResolver.prototype, "deleteSupplier", null);
exports.SuppliersResolver = SuppliersResolver = __decorate([
    (0, swagger_1.ApiTags)('suppliers'),
    (0, swagger_1.ApiBearerAuth)('JWT'),
    (0, graphql_1.Resolver)(() => supplier_entity_1.Supplier),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [suppliers_service_1.SuppliersService])
], SuppliersResolver);
//# sourceMappingURL=suppliers.resolver.js.map