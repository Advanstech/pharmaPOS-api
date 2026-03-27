import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Runtime SQL for “business sale time”: COALESCE(sold_at, created_at) when migration
 * `1711000000009` is applied, else `created_at` only (avoids queries failing on missing column).
 */
@Injectable()
export class SalesEffectiveAtService implements OnModuleInit {
  private readonly logger = new Logger(SalesEffectiveAtService.name);
  private hasSalesSoldAtColumn = true;

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    try {
      const rows = (await this.dataSource.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'sales' AND column_name = 'sold_at'
         LIMIT 1`,
      )) as unknown[];
      this.hasSalesSoldAtColumn = Array.isArray(rows) && rows.length > 0;
      if (!this.hasSalesSoldAtColumn) {
        this.logger.warn(
          'sales.sold_at is missing — using created_at for sale-time SQL. Run migration 1711000000009 (AddSalesSoldAt).',
        );
      }
    } catch (err) {
      this.logger.error('Probe information_schema for sales.sold_at failed; using created_at only', err);
      this.hasSalesSoldAtColumn = false;
    }
  }

  /** True after init when `sales.sold_at` exists (for INSERT/SELECT shape in SalesService). */
  get hasSoldAt(): boolean {
    return this.hasSalesSoldAtColumn;
  }

  /** Fragment for WHERE/ORDER BY / expressions, e.g. `(COALESCE(s.sold_at, s.created_at))` or `(s.created_at)`. */
  sql(tableAlias: string): string {
    return this.hasSalesSoldAtColumn
      ? `COALESCE(${tableAlias}.sold_at, ${tableAlias}.created_at)`
      : `${tableAlias}.created_at`;
  }
}
