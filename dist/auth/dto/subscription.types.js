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
exports.SubscriptionOverview = exports.SubscriptionLimitSnapshot = exports.SubscriptionUsageSnapshot = void 0;
const graphql_1 = require("@nestjs/graphql");
let SubscriptionUsageSnapshot = class SubscriptionUsageSnapshot {
};
exports.SubscriptionUsageSnapshot = SubscriptionUsageSnapshot;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], SubscriptionUsageSnapshot.prototype, "branches", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], SubscriptionUsageSnapshot.prototype, "users", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], SubscriptionUsageSnapshot.prototype, "products", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], SubscriptionUsageSnapshot.prototype, "sales", void 0);
exports.SubscriptionUsageSnapshot = SubscriptionUsageSnapshot = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Current usage counters for the active subscription period' })
], SubscriptionUsageSnapshot);
let SubscriptionLimitSnapshot = class SubscriptionLimitSnapshot {
};
exports.SubscriptionLimitSnapshot = SubscriptionLimitSnapshot;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], SubscriptionLimitSnapshot.prototype, "branches", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], SubscriptionLimitSnapshot.prototype, "users", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], SubscriptionLimitSnapshot.prototype, "products", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], SubscriptionLimitSnapshot.prototype, "sales", void 0);
exports.SubscriptionLimitSnapshot = SubscriptionLimitSnapshot = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Tier limits applied to the organization' })
], SubscriptionLimitSnapshot);
let SubscriptionOverview = class SubscriptionOverview {
};
exports.SubscriptionOverview = SubscriptionOverview;
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], SubscriptionOverview.prototype, "tier", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], SubscriptionOverview.prototype, "status", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Date)
], SubscriptionOverview.prototype, "currentPeriodStart", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Date)
], SubscriptionOverview.prototype, "currentPeriodEnd", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Boolean)
], SubscriptionOverview.prototype, "cancelAtPeriodEnd", void 0);
__decorate([
    (0, graphql_1.Field)(() => SubscriptionUsageSnapshot),
    __metadata("design:type", SubscriptionUsageSnapshot)
], SubscriptionOverview.prototype, "usage", void 0);
__decorate([
    (0, graphql_1.Field)(() => SubscriptionLimitSnapshot),
    __metadata("design:type", SubscriptionLimitSnapshot)
], SubscriptionOverview.prototype, "limits", void 0);
exports.SubscriptionOverview = SubscriptionOverview = __decorate([
    (0, graphql_1.ObjectType)({ description: 'Organization subscription overview for billing and plan UI' })
], SubscriptionOverview);
//# sourceMappingURL=subscription.types.js.map