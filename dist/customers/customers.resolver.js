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
exports.CustomersResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const common_1 = require("@nestjs/common");
const customers_service_1 = require("./customers.service");
const customer_types_1 = require("./dto/customer.types");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const CUSTOMER_POS_ROLES = [
    'owner',
    'se_admin',
    'manager',
    'head_pharmacist',
    'pharmacist',
    'technician',
    'cashier',
    'chemical_cashier',
];
const CUSTOMER_LIST_ROLES = [
    'owner',
    'se_admin',
    'manager',
    'head_pharmacist',
    'pharmacist',
];
let CustomersResolver = class CustomersResolver {
    constructor(customersService) {
        this.customersService = customersService;
    }
    customer(id, actor) {
        return this.customersService.getCustomer(id, actor);
    }
    listCustomers(actor, limit, offset) {
        return this.customersService.listCustomers(actor, limit, offset);
    }
    searchCustomers(actor, query, limit) {
        return this.customersService.searchCustomers(actor, query, limit);
    }
    createCustomer(input, actor) {
        return this.customersService.createCustomer(input, actor);
    }
    updateCustomer(input, actor) {
        return this.customersService.updateCustomer(input, actor);
    }
};
exports.CustomersResolver = CustomersResolver;
__decorate([
    (0, graphql_1.Query)(() => customer_types_1.CustomerOutput, { name: 'customer' }),
    (0, roles_decorator_1.Roles)(...CUSTOMER_POS_ROLES),
    __param(0, (0, graphql_1.Args)('id', { type: () => graphql_1.ID })),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CustomersResolver.prototype, "customer", null);
__decorate([
    (0, graphql_1.Query)(() => [customer_types_1.CustomerOutput], { name: 'listCustomers' }),
    (0, roles_decorator_1.Roles)(...CUSTOMER_LIST_ROLES),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, graphql_1.Args)('limit', { type: () => graphql_1.Int, nullable: true })),
    __param(2, (0, graphql_1.Args)('offset', { type: () => graphql_1.Int, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", Promise)
], CustomersResolver.prototype, "listCustomers", null);
__decorate([
    (0, graphql_1.Query)(() => [customer_types_1.CustomerOutput], { name: 'searchCustomers' }),
    (0, roles_decorator_1.Roles)(...CUSTOMER_POS_ROLES),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, graphql_1.Args)('query')),
    __param(2, (0, graphql_1.Args)('limit', { type: () => graphql_1.Int, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Number]),
    __metadata("design:returntype", Promise)
], CustomersResolver.prototype, "searchCustomers", null);
__decorate([
    (0, graphql_1.Mutation)(() => customer_types_1.CustomerOutput, { name: 'createCustomer' }),
    (0, roles_decorator_1.Roles)(...CUSTOMER_POS_ROLES),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [customer_types_1.CreateCustomerInput, Object]),
    __metadata("design:returntype", Promise)
], CustomersResolver.prototype, "createCustomer", null);
__decorate([
    (0, graphql_1.Mutation)(() => customer_types_1.CustomerOutput, { name: 'updateCustomer' }),
    (0, roles_decorator_1.Roles)(...CUSTOMER_LIST_ROLES),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [customer_types_1.UpdateCustomerInput, Object]),
    __metadata("design:returntype", Promise)
], CustomersResolver.prototype, "updateCustomer", null);
exports.CustomersResolver = CustomersResolver = __decorate([
    (0, graphql_1.Resolver)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [customers_service_1.CustomersService])
], CustomersResolver);
//# sourceMappingURL=customers.resolver.js.map