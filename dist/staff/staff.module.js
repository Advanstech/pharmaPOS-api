"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const staff_service_1 = require("./staff.service");
const staff_resolver_1 = require("./staff.resolver");
const user_entity_1 = require("../auth/entities/user.entity");
const staff_profile_entity_1 = require("./entities/staff_profile.entity");
const notifications_module_1 = require("../notifications/notifications.module");
const config_1 = require("@nestjs/config");
let StaffModule = class StaffModule {
};
exports.StaffModule = StaffModule;
exports.StaffModule = StaffModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([user_entity_1.User, staff_profile_entity_1.StaffProfile]),
            notifications_module_1.NotificationsModule,
            config_1.ConfigModule,
        ],
        providers: [staff_service_1.StaffService, staff_resolver_1.StaffResolver],
        exports: [staff_service_1.StaffService],
    })
], StaffModule);
//# sourceMappingURL=staff.module.js.map