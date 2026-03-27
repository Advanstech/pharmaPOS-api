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
exports.DashboardKpis = exports.TopProduct = exports.RevenueReport = void 0;
const graphql_1 = require("@nestjs/graphql");
let RevenueReport = class RevenueReport {
};
exports.RevenueReport = RevenueReport;
__decorate([
    (0, graphql_1.Field)({ description: 'Report period start date. ISO 8601. Example: `"2026-03-01"`' }),
    __metadata("design:type", String)
], RevenueReport.prototype, "periodStart", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Report period end date. ISO 8601. Example: `"2026-03-31"`' }),
    __metadata("design:type", String)
], RevenueReport.prototype, "periodEnd", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Total revenue in GHS pesewas (all completed sales, excl. refunds)' }),
    __metadata("design:type", Number)
], RevenueReport.prototype, "totalRevenuePesewas", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Formatted total revenue. Example: `"GH₵42,500.00"`' }),
    __metadata("design:type", String)
], RevenueReport.prototype, "totalRevenueFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        description: 'Total VAT collected in GHS pesewas. ' +
            'Ghana GRA: 15% on non-exempt items (12.5% VAT + 2.5% NHIL). ' +
            'Prescription medicines are VAT-exempt.',
    }),
    __metadata("design:type", Number)
], RevenueReport.prototype, "vatCollectedPesewas", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Formatted VAT collected. Example: `"GH₵5,625.00"`' }),
    __metadata("design:type", String)
], RevenueReport.prototype, "vatFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Total number of completed sales in the period' }),
    __metadata("design:type", Number)
], RevenueReport.prototype, "salesCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, {
        description: 'Average sale value in GHS (not pesewas). Example: `42.50`',
    }),
    __metadata("design:type", Number)
], RevenueReport.prototype, "averageSaleGhs", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        description: 'Total refunds issued in GHS pesewas (negative impact on revenue)',
    }),
    __metadata("design:type", Number)
], RevenueReport.prototype, "refundsPesewas", void 0);
exports.RevenueReport = RevenueReport = __decorate([
    (0, graphql_1.ObjectType)({
        description: 'Revenue report for a date range. All monetary values in GHS pesewas. ' +
            'Used for Ghana GRA monthly VAT returns (due 30th of following month).',
    })
], RevenueReport);
let TopProduct = class TopProduct {
};
exports.TopProduct = TopProduct;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID, { description: 'UUID of the product' }),
    __metadata("design:type", String)
], TopProduct.prototype, "productId", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Product name' }),
    __metadata("design:type", String)
], TopProduct.prototype, "productName", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Total units sold in the period' }),
    __metadata("design:type", Number)
], TopProduct.prototype, "unitsSold", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Total revenue from this product in GHS pesewas' }),
    __metadata("design:type", Number)
], TopProduct.prototype, "revenuePesewas", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Formatted revenue. Example: `"GH₵8,750.00"`' }),
    __metadata("design:type", String)
], TopProduct.prototype, "revenueFormatted", void 0);
exports.TopProduct = TopProduct = __decorate([
    (0, graphql_1.ObjectType)({ description: 'A product ranked by sales volume or revenue in a given period' })
], TopProduct);
let DashboardKpis = class DashboardKpis {
};
exports.DashboardKpis = DashboardKpis;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        description: 'Revenue earned today (midnight to now, Africa/Accra timezone) in GHS pesewas',
    }),
    __metadata("design:type", Number)
], DashboardKpis.prototype, "todayRevenuePesewas", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Formatted today\'s revenue. Example: `"GH₵4,250.00"`' }),
    __metadata("design:type", String)
], DashboardKpis.prototype, "todayRevenueFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Number of completed sales today' }),
    __metadata("design:type", Number)
], DashboardKpis.prototype, "todaySalesCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        description: 'Revenue earned this calendar month in GHS pesewas',
    }),
    __metadata("design:type", Number)
], DashboardKpis.prototype, "monthRevenuePesewas", void 0);
__decorate([
    (0, graphql_1.Field)({ description: 'Formatted month-to-date revenue. Example: `"GH₵87,300.00"`' }),
    __metadata("design:type", String)
], DashboardKpis.prototype, "monthRevenueFormatted", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Number of completed sales this month' }),
    __metadata("design:type", Number)
], DashboardKpis.prototype, "monthSalesCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, {
        description: 'Number of products currently at or below their reorder level. ' +
            'Drives the low-stock badge on the dashboard.',
    }),
    __metadata("design:type", Number)
], DashboardKpis.prototype, "lowStockCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { description: 'Number of active (non-deactivated) staff accounts at this branch' }),
    __metadata("design:type", Number)
], DashboardKpis.prototype, "activeStaffCount", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Float, {
        description: 'Month-over-month revenue change as a percentage. ' +
            'Positive = growth, negative = decline. Example: `12.5` means +12.5% vs last month.',
    }),
    __metadata("design:type", Number)
], DashboardKpis.prototype, "revenueDeltaPct", void 0);
exports.DashboardKpis = DashboardKpis = __decorate([
    (0, graphql_1.ObjectType)({
        description: 'Real-time KPI snapshot for the dashboard. ' +
            'Scoped to the authenticated user\'s branch (managers see own branch; owners see all branches). ' +
            'All monetary values in GHS pesewas.',
    })
], DashboardKpis);
//# sourceMappingURL=reports.types.js.map