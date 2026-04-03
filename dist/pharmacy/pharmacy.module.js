"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PharmacyModule = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const pharmacy_service_1 = require("./pharmacy.service");
const pharmacy_resolver_1 = require("./pharmacy.resolver");
const prescription_webhook_controller_1 = require("./prescription-webhook.controller");
const auth_module_1 = require("../auth/auth.module");
let PharmacyModule = class PharmacyModule {
};
exports.PharmacyModule = PharmacyModule;
exports.PharmacyModule = PharmacyModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            cache_manager_1.CacheModule.register({ ttl: 86400 }),
        ],
        controllers: [prescription_webhook_controller_1.PrescriptionWebhookController],
        providers: [pharmacy_service_1.PharmacyService, pharmacy_resolver_1.PharmacyResolver],
        exports: [pharmacy_service_1.PharmacyService],
    })
], PharmacyModule);
//# sourceMappingURL=pharmacy.module.js.map