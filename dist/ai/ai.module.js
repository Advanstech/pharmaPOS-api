"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiModule = void 0;
const common_1 = require("@nestjs/common");
const bull_1 = require("@nestjs/bull");
const product_image_service_1 = require("./product-image.service");
const image_pipeline_processor_1 = require("./image-pipeline.processor");
const products_module_1 = require("../products/products.module");
let AiModule = class AiModule {
};
exports.AiModule = AiModule;
exports.AiModule = AiModule = __decorate([
    (0, common_1.Module)({
        imports: [
            bull_1.BullModule.registerQueue({
                name: 'image-pipeline',
            }),
            products_module_1.ProductsModule,
        ],
        providers: [
            product_image_service_1.ProductImageService,
            image_pipeline_processor_1.ImagePipelineProcessor,
        ],
        exports: [product_image_service_1.ProductImageService],
    })
], AiModule);
//# sourceMappingURL=ai.module.js.map