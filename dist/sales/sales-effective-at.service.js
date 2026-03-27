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
var SalesEffectiveAtService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesEffectiveAtService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
let SalesEffectiveAtService = SalesEffectiveAtService_1 = class SalesEffectiveAtService {
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(SalesEffectiveAtService_1.name);
        this.hasSalesSoldAtColumn = true;
    }
    async onModuleInit() {
        try {
            const rows = (await this.dataSource.query(`SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'sales' AND column_name = 'sold_at'
         LIMIT 1`));
            this.hasSalesSoldAtColumn = Array.isArray(rows) && rows.length > 0;
            if (!this.hasSalesSoldAtColumn) {
                this.logger.warn('sales.sold_at is missing — using created_at for sale-time SQL. Run migration 1711000000009 (AddSalesSoldAt).');
            }
        }
        catch (err) {
            this.logger.error('Probe information_schema for sales.sold_at failed; using created_at only', err);
            this.hasSalesSoldAtColumn = false;
        }
    }
    get hasSoldAt() {
        return this.hasSalesSoldAtColumn;
    }
    sql(tableAlias) {
        return this.hasSalesSoldAtColumn
            ? `COALESCE(${tableAlias}.sold_at, ${tableAlias}.created_at)`
            : `${tableAlias}.created_at`;
    }
};
exports.SalesEffectiveAtService = SalesEffectiveAtService;
exports.SalesEffectiveAtService = SalesEffectiveAtService = SalesEffectiveAtService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], SalesEffectiveAtService);
//# sourceMappingURL=sales-effective-at.service.js.map