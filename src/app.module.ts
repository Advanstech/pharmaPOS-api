import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { join } from 'path';
import { SupabaseModule } from './database/supabase.module';
import { ProductsModule } from './products/products.module';
import { AuthModule } from './auth/auth.module';
import { PharmacyModule } from './pharmacy/pharmacy.module';
import { SalesModule } from './sales/sales.module';
import { InventoryModule } from './inventory/inventory.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { AccountingModule } from './accounting/accounting.module';
import { ReportsModule } from './reports/reports.module';
import { StaffModule } from './staff/staff.module';
import { AiModule } from './ai/ai.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthModule } from './health/health.module';
import { AuditModule } from './audit/audit.module';
import { SalesEffectiveAtModule } from './sales/sales-effective-at.module';
import { CustomersModule } from './customers/customers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.register({ isGlobal: true, ttl: 3600000 }), // 1h default TTL

    // Code-first GraphQL — never schema-first (ADR-01)
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useFactory: () => ({
        autoSchemaFile: process.env['NODE_ENV'] === 'production'
          ? true  // In-memory schema generation — no filesystem write needed in prod
          : join(process.cwd(), 'src/schema.gql'),
        sortSchema: true,
        // WS: graphql-ws transport for subscriptions (not subscriptions-transport-ws)
        subscriptions: {
          'graphql-ws': {
            onConnect: (ctx) => {
              // JWT auth in connection_init
              const token = (ctx.connectionParams as Record<string, string>)?.Authorization;
              if (!token) throw new Error('Unauthorized');
              return { token };
            },
          },
        },
        context: ({ req, connectionParams }: { req: unknown; connectionParams: unknown }) => ({
          req,
          connectionParams,
        }),
      }),
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        // Supabase connection string — use Transaction pooler (port 6543) for API,
        // Direct connection (port 5432) for migrations (TypeORM CLI needs direct)
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: [join(__dirname, '**/*.entity{.ts,.js}')],
        // NEVER synchronize: true in production — use migrations only
        synchronize: false,
        migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
        logging: config.get('NODE_ENV') === 'development',
        // Supabase requires SSL when connecting remotely, even in development
        ssl: { rejectUnauthorized: false },
        // Connection pool — Supabase free tier: max 15 direct connections
        extra: {
          max: config.get('NODE_ENV') === 'production' ? 10 : 5,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        },
      }),
    }),

    SalesEffectiveAtModule,
    AuthModule,
    SupabaseModule,
    NotificationsModule,
    HealthModule,
    ProductsModule,
    PharmacyModule,
    SalesModule,
    InventoryModule,
    SuppliersModule,
    AccountingModule,
    ReportsModule,
    StaffModule,
    AiModule,
    AuditModule,
    CustomersModule,
  ],
})
export class AppModule {}
