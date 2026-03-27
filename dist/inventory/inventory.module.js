"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryModule = void 0;
const common_1 = require("@nestjs/common");
const inventory_service_1 = require("./inventory.service");
const inventory_resolver_1 = require("./inventory.resolver");
const auth_module_1 = require("../auth/auth.module");
const realtime_stock_service_1 = require("./realtime-stock.service");
const stock_alerts_service_1 = require("./stock-alerts.service");
const notifications_module_1 = require("../notifications/notifications.module");
let InventoryModule = class InventoryModule {
};
exports.InventoryModule = InventoryModule;
exports.InventoryModule = InventoryModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, notifications_module_1.NotificationsModule],
        providers: [inventory_service_1.InventoryService, inventory_resolver_1.InventoryResolver, realtime_stock_service_1.RealtimeStockService, stock_alerts_service_1.StockAlertsService],
        exports: [inventory_service_1.InventoryService, realtime_stock_service_1.RealtimeStockService],
    })
], InventoryModule);
//# sourceMappingURL=inventory.module.js.map