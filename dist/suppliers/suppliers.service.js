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
exports.SuppliersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const supplier_entity_1 = require("./entities/supplier.entity");
let SuppliersService = class SuppliersService {
    constructor(supplierRepo, dataSource) {
        this.supplierRepo = supplierRepo;
        this.dataSource = dataSource;
    }
    async listSuppliers() {
        return this.supplierRepo.find({ where: { isActive: true }, order: { name: 'ASC' } });
    }
    async getSupplierById(id) {
        const supplier = await this.supplierRepo.findOne({ where: { id } });
        if (!supplier)
            throw new common_1.NotFoundException(`Supplier ${id} not found`);
        return supplier;
    }
    async createSupplier(input) {
        const supplier = this.supplierRepo.create(Object.assign({}, input));
        return this.supplierRepo.save(supplier);
    }
    async updateSupplier(id, input) {
        const supplier = await this.getSupplierById(id);
        Object.assign(supplier, input);
        return this.supplierRepo.save(supplier);
    }
    async deleteSupplier(id) {
        const supplier = await this.getSupplierById(id);
        supplier.isActive = false;
        await this.supplierRepo.save(supplier);
        return true;
    }
    async getSupplierRestockWatch(branchId) {
        var _a, _b, _c;
        const rows = await this.dataSource.query(`
      SELECT
        s.id AS supplier_id,
        s.name AS supplier_name,
        s.phone AS supplier_phone,
        s.email AS supplier_email,
        s.ai_score AS supplier_ai_score,
        p.id AS product_id,
        p.name AS product_name,
        COALESCE(inv.quantity_on_hand, 0)::int AS quantity_on_hand,
        COALESCE(inv.reorder_level, 10)::int AS reorder_level
      FROM products p
      INNER JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN inventory inv ON inv.product_id = p.id AND inv.branch_id = $1
      WHERE p.is_active = true
        AND s.is_active = true
      ORDER BY s.name ASC, p.name ASC
    `, [branchId]);
        const map = new Map();
        for (const row of rows) {
            const status = this.calcStockStatus(row.quantity_on_hand, row.reorder_level);
            const existing = map.get(row.supplier_id);
            const watch = existing !== null && existing !== void 0 ? existing : {
                supplierId: row.supplier_id,
                supplierName: row.supplier_name,
                supplierPhone: (_a = row.supplier_phone) !== null && _a !== void 0 ? _a : undefined,
                supplierEmail: (_b = row.supplier_email) !== null && _b !== void 0 ? _b : undefined,
                supplierAiScore: (_c = row.supplier_ai_score) !== null && _c !== void 0 ? _c : undefined,
                totalTrackedProducts: 0,
                lowStockCount: 0,
                criticalStockCount: 0,
                outOfStockCount: 0,
                affectedProducts: [],
            };
            watch.totalTrackedProducts += 1;
            if (status === 'low')
                watch.lowStockCount += 1;
            if (status === 'critical')
                watch.criticalStockCount += 1;
            if (status === 'out')
                watch.outOfStockCount += 1;
            if (status !== 'ok') {
                watch.affectedProducts.push({
                    productId: row.product_id,
                    productName: row.product_name,
                    quantityOnHand: row.quantity_on_hand,
                    reorderLevel: row.reorder_level,
                    stockStatus: status,
                });
            }
            map.set(row.supplier_id, watch);
        }
        return Array.from(map.values()).sort((a, b) => {
            const scoreA = a.outOfStockCount * 3 + a.criticalStockCount * 2 + a.lowStockCount;
            const scoreB = b.outOfStockCount * 3 + b.criticalStockCount * 2 + b.lowStockCount;
            return scoreB - scoreA || a.supplierName.localeCompare(b.supplierName);
        });
    }
    calcStockStatus(quantityOnHand, reorderLevel) {
        if (quantityOnHand <= 0)
            return 'out';
        if (quantityOnHand <= Math.max(1, Math.floor(reorderLevel * 0.2)))
            return 'critical';
        if (quantityOnHand <= reorderLevel)
            return 'low';
        return 'ok';
    }
};
exports.SuppliersService = SuppliersService;
exports.SuppliersService = SuppliersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(supplier_entity_1.Supplier)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource])
], SuppliersService);
//# sourceMappingURL=suppliers.service.js.map