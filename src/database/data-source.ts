import { DataSource } from 'typeorm';
import { join } from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

// Used by TypeORM CLI for migrations — use DIRECT connection (port 5432), not pooler
export const AppDataSource = new DataSource({
  type: 'postgres',
  // Supabase direct connection string — set DATABASE_DIRECT_URL in .env
  // Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
  url: process.env['DATABASE_DIRECT_URL'] ?? process.env['DATABASE_URL'],
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, '../migrations/*{.ts,.js}')],
  // NEVER synchronize: true — use migrations only
  synchronize: false,
  // Supabase requires SSL when connecting remotely, even in development
  ssl: { rejectUnauthorized: false },
});
