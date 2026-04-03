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
var ReportsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const sales_effective_at_service_1 = require("../sales/sales-effective-at.service");
let ReportsService = ReportsService_1 = class ReportsService {
    constructor(dataSource, effectiveSaleAt) {
        this.dataSource = dataSource;
        this.effectiveSaleAt = effectiveSaleAt;
        this.logger = new common_1.Logger(ReportsService_1.name);
    }
    async getRevenueReport(branchId, periodStart, periodEnd) {
        var _a, _b, _c, _d, _e;
        const at = this.effectiveSaleAt.sql('s');
        const saleAccraDay = `(${at} AT TIME ZONE 'Africa/Accra')::date`;
        const [row] = await this.dataSource.query(`
      SELECT
        COALESCE(SUM(CASE WHEN s.status = 'COMPLETED' THEN s.total_amount ELSE 0 END), 0)::int AS total_revenue,
        COALESCE(SUM(CASE WHEN s.status = 'COMPLETED' THEN s.vat_amount ELSE 0 END), 0)::int AS vat_collected,
        COUNT(CASE WHEN s.status = 'COMPLETED' THEN 1 END)::int AS sales_count,
        COALESCE(SUM(CASE WHEN s.status = 'REFUNDED' THEN s.total_amount ELSE 0 END), 0)::int AS refunds
      FROM sales s
      WHERE s.branch_id = $1
        AND ${saleAccraDay} >= $2::date
        AND ${saleAccraDay} <= $3::date
    `, [branchId, periodStart, periodEnd]);
        const revenue = (_a = row === null || row === void 0 ? void 0 : row.total_revenue) !== null && _a !== void 0 ? _a : 0;
        const count = (_b = row === null || row === void 0 ? void 0 : row.sales_count) !== null && _b !== void 0 ? _b : 0;
        return {
            periodStart,
            periodEnd,
            totalRevenuePesewas: revenue,
            totalRevenueFormatted: this.fmt(revenue),
            vatCollectedPesewas: (_c = row === null || row === void 0 ? void 0 : row.vat_collected) !== null && _c !== void 0 ? _c : 0,
            vatFormatted: this.fmt((_d = row === null || row === void 0 ? void 0 : row.vat_collected) !== null && _d !== void 0 ? _d : 0),
            salesCount: count,
            averageSaleGhs: count > 0 ? revenue / 100 / count : 0,
            refundsPesewas: (_e = row === null || row === void 0 ? void 0 : row.refunds) !== null && _e !== void 0 ? _e : 0,
        };
    }
    async getTopProducts(branchId, periodStart, periodEnd, limit = 10) {
        const at = this.effectiveSaleAt.sql('s');
        const saleAccraDay = `(${at} AT TIME ZONE 'Africa/Accra')::date`;
        const rows = await this.dataSource.query(`
      SELECT
        si.product_id,
        p.name AS product_name,
        SUM(si.quantity)::int AS units_sold,
        SUM(si.quantity * si.unit_price)::int AS revenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      WHERE s.branch_id = $1
        AND s.status = 'COMPLETED'
        AND ${saleAccraDay} >= $2::date
        AND ${saleAccraDay} <= $3::date
      GROUP BY si.product_id, p.name
      ORDER BY revenue DESC
      LIMIT $4
    `, [branchId, periodStart, periodEnd, limit]);
        return rows.map((r) => ({
            productId: r.product_id,
            productName: r.product_name,
            unitsSold: r.units_sold,
            revenuePesewas: r.revenue,
            revenueFormatted: this.fmt(r.revenue),
        }));
    }
    async getDashboardKpis(branchId) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        const at = this.effectiveSaleAt.sql('s');
        const saleAccraDay = `(${at} AT TIME ZONE 'Africa/Accra')::date`;
        const [todayRow, monthRow, prevMonthRow, lowStockRow, staffRow] = await Promise.all([
            this.dataSource.query(`
        SELECT
          COALESCE(SUM(s.total_amount), 0)::int AS revenue,
          COUNT(*)::int AS count
        FROM sales s
        WHERE s.branch_id = $1 AND s.status = 'COMPLETED'
          AND ${saleAccraDay} = (NOW() AT TIME ZONE 'Africa/Accra')::date
      `, [branchId]),
            this.dataSource.query(`
        SELECT
          COALESCE(SUM(s.total_amount), 0)::int AS revenue,
          COUNT(*)::int AS count
        FROM sales s
        WHERE s.branch_id = $1 AND s.status = 'COMPLETED'
          AND to_char(${at} AT TIME ZONE 'Africa/Accra', 'YYYY-MM')
            = to_char(NOW() AT TIME ZONE 'Africa/Accra', 'YYYY-MM')
      `, [branchId]),
            this.dataSource.query(`
        SELECT COALESCE(SUM(s.total_amount), 0)::int AS revenue
        FROM sales s
        WHERE s.branch_id = $1 AND s.status = 'COMPLETED'
          AND to_char(${at} AT TIME ZONE 'Africa/Accra', 'YYYY-MM') = to_char(
            (NOW() AT TIME ZONE 'Africa/Accra')::date - INTERVAL '1 month',
            'YYYY-MM'
          )
      `, [branchId]),
            this.dataSource.query(`
        SELECT COUNT(*)::int AS cnt
        FROM products p
        LEFT JOIN inventory inv ON inv.product_id = p.id AND inv.branch_id = $1
        WHERE p.is_active = true
          AND COALESCE(inv.quantity_on_hand, 0) <= COALESCE(inv.reorder_level, 10)
      `, [branchId]),
            this.dataSource.query(`
        SELECT COUNT(*)::int AS cnt FROM users
        WHERE branch_id = $1 AND is_active = true AND role != 'se_admin'
      `, [branchId]),
        ]);
        const todayRevenue = (_b = (_a = todayRow[0]) === null || _a === void 0 ? void 0 : _a.revenue) !== null && _b !== void 0 ? _b : 0;
        const monthRevenue = (_d = (_c = monthRow[0]) === null || _c === void 0 ? void 0 : _c.revenue) !== null && _d !== void 0 ? _d : 0;
        const prevRevenue = (_f = (_e = prevMonthRow[0]) === null || _e === void 0 ? void 0 : _e.revenue) !== null && _f !== void 0 ? _f : 0;
        const delta = prevRevenue > 0
            ? ((monthRevenue - prevRevenue) / prevRevenue) * 100
            : 0;
        return {
            todayRevenuePesewas: todayRevenue,
            todayRevenueFormatted: this.fmt(todayRevenue),
            todaySalesCount: (_h = (_g = todayRow[0]) === null || _g === void 0 ? void 0 : _g.count) !== null && _h !== void 0 ? _h : 0,
            monthRevenuePesewas: monthRevenue,
            monthRevenueFormatted: this.fmt(monthRevenue),
            monthSalesCount: (_k = (_j = monthRow[0]) === null || _j === void 0 ? void 0 : _j.count) !== null && _k !== void 0 ? _k : 0,
            lowStockCount: (_m = (_l = lowStockRow[0]) === null || _l === void 0 ? void 0 : _l.cnt) !== null && _m !== void 0 ? _m : 0,
            activeStaffCount: (_p = (_o = staffRow[0]) === null || _o === void 0 ? void 0 : _o.cnt) !== null && _p !== void 0 ? _p : 0,
            revenueDeltaPct: Math.round(delta * 10) / 10,
        };
    }
    fmt(pesewas) {
        return `GH₵${(pesewas / 100).toFixed(2)}`;
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = ReportsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        sales_effective_at_service_1.SalesEffectiveAtService])
], ReportsService);
//# sourceMappingURL=reports.service.js.map