"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const product_entity_1 = require("./entities/product.entity");
const products_service_1 = require("./products.service");
const products_resolver_1 = require("./products.resolver");
const price_service_1 = require("./price.service");
const price_resolver_1 = require("./price.resolver");
const s3_upload_service_1 = require("./s3-upload.service");
let ProductsModule = class ProductsModule {
};
exports.ProductsModule = ProductsModule;
exports.ProductsModule = ProductsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([product_entity_1.Product])],
        providers: [products_service_1.ProductsService, products_resolver_1.ProductsResolver, price_service_1.PriceService, price_resolver_1.PriceResolver, s3_upload_service_1.S3UploadService],
        exports: [products_service_1.ProductsService, price_service_1.PriceService],
    })
], ProductsModule);
//# sourceMappingURL=products.module.js.map