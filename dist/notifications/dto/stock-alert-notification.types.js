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
exports.StockAlertNotification = void 0;
const graphql_1 = require("@nestjs/graphql");
let StockAlertNotification = class StockAlertNotification {
};
exports.StockAlertNotification = StockAlertNotification;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], StockAlertNotification.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], StockAlertNotification.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], StockAlertNotification.prototype, "productName", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], StockAlertNotification.prototype, "stockStatus", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], StockAlertNotification.prototype, "quantityOnHand", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], StockAlertNotification.prototype, "reorderLevel", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], StockAlertNotification.prototype, "suggestedReorderQty", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], StockAlertNotification.prototype, "supplierId", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], StockAlertNotification.prototype, "supplierName", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], StockAlertNotification.prototype, "supplierPhone", void 0);
__decorate([
    (0, graphql_1.Field)(() => [String]),
    __metadata("design:type", Array)
], StockAlertNotification.prototype, "channels", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], StockAlertNotification.prototype, "message", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Date)
], StockAlertNotification.prototype, "createdAt", void 0);
exports.StockAlertNotification = StockAlertNotification = __decorate([
    (0, graphql_1.ObjectType)({ description: 'In-app stock alert notification for the current user.' })
], StockAlertNotification);
//# sourceMappingURL=stock-alert-notification.types.js.map