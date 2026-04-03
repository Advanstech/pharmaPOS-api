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
exports.InventoryResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const common_1 = require("@nestjs/common");
const inventory_service_1 = require("./inventory.service");
const inventory_types_1 = require("./dto/inventory.types");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const realtime_stock_service_1 = require("./realtime-stock.service");
const stock_count_service_1 = require("./stock-count.service");
let InventoryResolver = class InventoryResolver {
    constructor(inventoryService, realtimeStock, stockCountService) {
        this.inventoryService = inventoryService;
        this.realtimeStock = realtimeStock;
        this.stockCountService = stockCountService;
    }
    inventory(actor) {
        return this.inventoryService.listInventory(actor.branchId);
    }
    lowStockAlerts(actor) {
        return this.inventoryService.getLowStockAlerts(actor.branchId);
    }
    stockMovements(productId, actor, limit) {
        return this.inventoryService.getStockMovements(productId, actor.branchId, limit);
    }
    adjustStock(input, actor) {
        return this.inventoryService.adjustStock(input, actor);
    }
    receiveStock(input, actor) {
        return this.inventoryService.receiveStock(input, actor);
    }
    createGRN(input, actor) {
        return this.inventoryService.createGRN(input, actor);
    }
    grn(id, _actor) {
        return this.inventoryService.getGRN(id);
    }
    listGRNs(actor, limit) {
        return this.inventoryService.listGRNs(actor.branchId, limit);
    }
    async createStockCount(input, actor) {
        return this.stockCountService.createStockCount(input, actor);
    }
    async updateStockCounts(input, actor) {
        const items = await this.stockCountService.updateStockCounts(input, actor);
        return items;
    }
    async completeStockCount(input, actor) {
        return this.stockCountService.completeStockCount(input, actor);
    }
    async stockCountSession(id, actor) {
        return this.stockCountService.getStockCountSession(id);
    }
    async stockCountItems(sessionId, actor) {
        const items = await this.stockCountService.getStockCountItems(sessionId);
        return items;
    }
    async listStockCounts(actor, limit) {
        const sessions = await this.stockCountService.listStockCounts(actor.branchId, limit);
        return sessions;
    }
    async cancelStockCount(sessionId, actor) {
        return this.stockCountService.cancelStockCount(sessionId, actor);
    }
    stockChanged(_branchId) {
        return this.realtimeStock.asyncIterator();
    }
};
exports.InventoryResolver = InventoryResolver;
__decorate([
    (0, graphql_1.Query)(() => [inventory_types_1.InventoryItem], { name: 'inventory' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InventoryResolver.prototype, "inventory", null);
__decorate([
    (0, graphql_1.Query)(() => [inventory_types_1.LowStockAlert], { name: 'lowStockAlerts' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InventoryResolver.prototype, "lowStockAlerts", null);
__decorate([
    (0, graphql_1.Query)(() => [inventory_types_1.StockMovementOutput], { name: 'stockMovements' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician'),
    __param(0, (0, graphql_1.Args)('productId', { type: () => graphql_1.ID })),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, graphql_1.Args)('limit', { type: () => graphql_1.Int, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Number]),
    __metadata("design:returntype", Promise)
], InventoryResolver.prototype, "stockMovements", null);
__decorate([
    (0, graphql_1.Mutation)(() => inventory_types_1.InventoryItem, { name: 'adjustStock' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_types_1.AdjustStockInput, Object]),
    __metadata("design:returntype", Promise)
], InventoryResolver.prototype, "adjustStock", null);
__decorate([
    (0, graphql_1.Mutation)(() => inventory_types_1.InventoryItem, { name: 'receiveStock' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_types_1.ReceiveStockInput, Object]),
    __metadata("design:returntype", Promise)
], InventoryResolver.prototype, "receiveStock", null);
__decorate([
    (0, graphql_1.Mutation)(() => inventory_types_1.GRNOutput, { name: 'createGRN' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'technician'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_types_1.CreateGRNInput, Object]),
    __metadata("design:returntype", Promise)
], InventoryResolver.prototype, "createGRN", null);
__decorate([
    (0, graphql_1.Query)(() => inventory_types_1.GRNOutput, { name: 'grn' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist'),
    __param(0, (0, graphql_1.Args)('id', { type: () => graphql_1.ID })),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], InventoryResolver.prototype, "grn", null);
__decorate([
    (0, graphql_1.Query)(() => [inventory_types_1.GRNOutput], { name: 'listGRNs' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, graphql_1.Args)('limit', { type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], InventoryResolver.prototype, "listGRNs", null);
__decorate([
    (0, graphql_1.Mutation)(() => inventory_types_1.StockCountSessionOutput, { name: 'createStockCount' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_types_1.CreateStockCountInput, Object]),
    __metadata("design:returntype", Promise)
], InventoryResolver.prototype, "createStockCount", null);
__decorate([
    (0, graphql_1.Mutation)(() => [inventory_types_1.StockCountItemOutput], { name: 'updateStockCounts' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'technician'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_types_1.UpdateStockCountInput, Object]),
    __metadata("design:returntype", Promise)
], InventoryResolver.prototype, "updateStockCounts", null);
__decorate([
    (0, graphql_1.Mutation)(() => inventory_types_1.StockCountSessionOutput, { name: 'completeStockCount' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_types_1.CompleteStockCountInput, Object]),
    __metadata("design:returntype", Promise)
], InventoryResolver.prototype, "completeStockCount", null);
__decorate([
    (0, graphql_1.Query)(() => inventory_types_1.StockCountSessionOutput, { name: 'stockCountSession' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist'),
    __param(0, (0, graphql_1.Args)('id', { type: () => graphql_1.ID })),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], InventoryResolver.prototype, "stockCountSession", null);
__decorate([
    (0, graphql_1.Query)(() => [inventory_types_1.StockCountItemOutput], { name: 'stockCountItems' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'technician'),
    __param(0, (0, graphql_1.Args)('sessionId', { type: () => graphql_1.ID })),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], InventoryResolver.prototype, "stockCountItems", null);
__decorate([
    (0, graphql_1.Query)(() => [inventory_types_1.StockCountSessionOutput], { name: 'listStockCounts' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, graphql_1.Args)('limit', { type: () => graphql_1.Int, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], InventoryResolver.prototype, "listStockCounts", null);
__decorate([
    (0, graphql_1.Mutation)(() => Boolean, { name: 'cancelStockCount' }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist'),
    __param(0, (0, graphql_1.Args)('sessionId', { type: () => graphql_1.ID })),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], InventoryResolver.prototype, "cancelStockCount", null);
__decorate([
    (0, graphql_1.Subscription)(() => inventory_types_1.StockChangedEvent, {
        name: 'stockChanged',
        filter: (payload, variables) => !variables.branchId || payload.stockChanged.branchId === variables.branchId,
        resolve: (payload) => payload.stockChanged,
    }),
    (0, roles_decorator_1.Roles)('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician', 'cashier', 'chemical_cashier'),
    __param(0, (0, graphql_1.Args)('branchId', { type: () => graphql_1.ID, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Object)
], InventoryResolver.prototype, "stockChanged", null);
exports.InventoryResolver = InventoryResolver = __decorate([
    (0, graphql_1.Resolver)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [inventory_service_1.InventoryService,
        realtime_stock_service_1.RealtimeStockService,
        stock_count_service_1.StockCountService])
], InventoryResolver);
//# sourceMappingURL=inventory.resolver.js.map