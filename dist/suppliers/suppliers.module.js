"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuppliersModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const bull_1 = require("@nestjs/bull");
const suppliers_service_1 = require("./suppliers.service");
const suppliers_resolver_1 = require("./suppliers.resolver");
const invoice_ocr_service_1 = require("./invoice-ocr.service");
const invoice_ocr_resolver_1 = require("./invoice-ocr.resolver");
const invoice_ocr_processor_1 = require("./invoice-ocr.processor");
const supplier_entity_1 = require("./entities/supplier.entity");
const products_module_1 = require("../products/products.module");
const ai_module_1 = require("../ai/ai.module");
let SuppliersModule = class SuppliersModule {
};
exports.SuppliersModule = SuppliersModule;
exports.SuppliersModule = SuppliersModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([supplier_entity_1.Supplier]),
            bull_1.BullModule.registerQueue({
                name: 'invoice-ocr',
            }),
            products_module_1.ProductsModule,
            ai_module_1.AiModule,
        ],
        providers: [
            suppliers_service_1.SuppliersService,
            suppliers_resolver_1.SuppliersResolver,
            invoice_ocr_service_1.InvoiceOcrService,
            invoice_ocr_resolver_1.InvoiceOcrResolver,
            invoice_ocr_processor_1.InvoiceOcrProcessor,
        ],
        exports: [suppliers_service_1.SuppliersService, invoice_ocr_service_1.InvoiceOcrService],
    })
], SuppliersModule);
//# sourceMappingURL=suppliers.module.js.map