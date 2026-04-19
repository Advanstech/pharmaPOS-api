import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bull';
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
import { TaxConfigService } from './config/tax-config.service';
import { TaxConfigResolver } from './config/tax-config.resolver';
import { isOriginAllowed } from './config/cors-origins';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.register({ isGlobal: true, ttl: 3600000 }),

    // Bull queue — Redis connection (used by invoice-ocr and image-pipeline queues)
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        if (redisUrl) {
          // Parse the Redis URL manually to support TLS (rediss://)
          const url = new URL(redisUrl);
          const isTls = url.protocol === 'rediss:';
          return {
            redis: {
              host: url.hostname,
              port: parseInt(url.port || '6379', 10),
              password: url.password || undefined,
              username: url.username || undefined,
              tls: isTls ? { rejectUnauthorized: false } : undefined,
            },
          };
        }
        return {
          redis: {
            host: config.get('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
          },
        };
      },
    }),

    // Code-first GraphQL — never schema-first (ADR-01)
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useFactory: () => ({
        autoSchemaFile: process.env['NODE_ENV'] === 'production'
          ? true  // In-memory schema generation — no filesystem write needed in prod
          : join(process.cwd(), 'src/schema.gql'),
        sortSchema: true,
        // Apollo Server 5 defaults CSRF checks that reject some valid clients; we use Bearer JWT, not cookies.
        csrfPrevention: false,
        // WS: graphql-ws transport for subscriptions (not subscriptions-transport-ws)
        subscriptions: {
          'graphql-ws': {
            onConnect: (ctx) => {
              const req = (ctx as { extra: { request: { headers: { origin?: string | string[] } } } }).extra
                .request;
              const raw = req.headers.origin;
              const origin = Array.isArray(raw) ? raw[0] : raw;
              if (typeof origin === 'string' && !isOriginAllowed(origin)) {
                return false;
              }
              const params = (ctx as { connectionParams?: Record<string, unknown> }).connectionParams;
              const token = params?.Authorization;
              if (typeof token !== 'string' || !token) throw new Error('Unauthorized');
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
          max: config.get('NODE_ENV') === 'production' ? 10 : 8,
          idleTimeoutMillis: 60000,
          connectionTimeoutMillis: 10000,
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
  providers: [TaxConfigService, TaxConfigResolver],
})
export class AppModule {}
