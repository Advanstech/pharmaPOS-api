"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const graphql_1 = require("@nestjs/graphql");
const apollo_1 = require("@nestjs/apollo");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const cache_manager_1 = require("@nestjs/cache-manager");
const path_1 = require("path");
const supabase_module_1 = require("./database/supabase.module");
const products_module_1 = require("./products/products.module");
const auth_module_1 = require("./auth/auth.module");
const pharmacy_module_1 = require("./pharmacy/pharmacy.module");
const sales_module_1 = require("./sales/sales.module");
const inventory_module_1 = require("./inventory/inventory.module");
const suppliers_module_1 = require("./suppliers/suppliers.module");
const accounting_module_1 = require("./accounting/accounting.module");
const reports_module_1 = require("./reports/reports.module");
const staff_module_1 = require("./staff/staff.module");
const ai_module_1 = require("./ai/ai.module");
const notifications_module_1 = require("./notifications/notifications.module");
const health_module_1 = require("./health/health.module");
const audit_module_1 = require("./audit/audit.module");
const sales_effective_at_module_1 = require("./sales/sales-effective-at.module");
const customers_module_1 = require("./customers/customers.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            cache_manager_1.CacheModule.register({ isGlobal: true, ttl: 3600000 }),
            graphql_1.GraphQLModule.forRootAsync({
                driver: apollo_1.ApolloDriver,
                useFactory: () => ({
                    autoSchemaFile: (0, path_1.join)(process.cwd(), 'src/schema.gql'),
                    sortSchema: true,
                    subscriptions: {
                        'graphql-ws': {
                            onConnect: (ctx) => {
                                var _a;
                                const token = (_a = ctx.connectionParams) === null || _a === void 0 ? void 0 : _a.Authorization;
                                if (!token)
                                    throw new Error('Unauthorized');
                                return { token };
                            },
                        },
                    },
                    context: ({ req, connectionParams }) => ({
                        req,
                        connectionParams,
                    }),
                }),
            }),
            typeorm_1.TypeOrmModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    type: 'postgres',
                    url: config.getOrThrow('DATABASE_URL'),
                    entities: [(0, path_1.join)(__dirname, '**/*.entity{.ts,.js}')],
                    synchronize: false,
                    migrations: [(0, path_1.join)(__dirname, 'migrations/*{.ts,.js}')],
                    logging: config.get('NODE_ENV') === 'development',
                    ssl: { rejectUnauthorized: false },
                    extra: {
                        max: config.get('NODE_ENV') === 'production' ? 10 : 5,
                        idleTimeoutMillis: 30000,
                        connectionTimeoutMillis: 5000,
                    },
                }),
            }),
            sales_effective_at_module_1.SalesEffectiveAtModule,
            auth_module_1.AuthModule,
            supabase_module_1.SupabaseModule,
            notifications_module_1.NotificationsModule,
            health_module_1.HealthModule,
            products_module_1.ProductsModule,
            pharmacy_module_1.PharmacyModule,
            sales_module_1.SalesModule,
            inventory_module_1.InventoryModule,
            suppliers_module_1.SuppliersModule,
            accounting_module_1.AccountingModule,
            reports_module_1.ReportsModule,
            staff_module_1.StaffModule,
            ai_module_1.AiModule,
            audit_module_1.AuditModule,
            customers_module_1.CustomersModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map