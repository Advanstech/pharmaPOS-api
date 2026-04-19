import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface TaxConfig {
  branchId: string;
  vatRate: number;
  nhilRate: number;
  getfundRate: number;
  covidLevyRate: number;
  totalRate: number;
  applyVatOnOtc: boolean;
  applyVatOnPom: boolean;
  applyVatOnControlled: boolean;
  updatedAt: Date;
}

export interface UpdateTaxConfigInput {
  vatRate?: number;
  nhilRate?: number;
  getfundRate?: number;
  covidLevyRate?: number;
  applyVatOnOtc?: boolean;
  applyVatOnPom?: boolean;
  applyVatOnControlled?: boolean;
}

@Injectable()
export class TaxConfigService {
  private readonly logger = new Logger(TaxConfigService.name);
  // In-memory cache per branch — refreshed on update
  private readonly cache = new Map<string, { config: TaxConfig; expiresAt: number }>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Get effective tax rate for a branch.
   * Falls back to Ghana GRA standard (15%) if no config exists.
   */
  async getTaxConfig(branchId: string): Promise<TaxConfig> {
    const cached = this.cache.get(branchId);
    if (cached && cached.expiresAt > Date.now()) return cached.config;

    const [row] = await this.dataSource.query(
      `SELECT * FROM tax_config WHERE branch_id = $1`,
      [branchId],
    );

    if (!row) {
      // Auto-create with Ghana GRA defaults
      await this.dataSource.query(
        `INSERT INTO tax_config (branch_id, vat_rate, nhil_rate, getfund_rate, covid_levy_rate)
         VALUES ($1, 0.1250, 0.0250, 0.0000, 0.0000) ON CONFLICT (branch_id) DO NOTHING`,
        [branchId],
      );
      return this.getDefaultConfig(branchId);
    }

    const config = this.mapRow(row);
    this.cache.set(branchId, { config, expiresAt: Date.now() + this.TTL_MS });
    return config;
  }

  /**
   * Get the effective VAT rate for a product classification.
   */
  async getEffectiveRate(branchId: string, classification: string): Promise<number> {
    const config = await this.getTaxConfig(branchId);
    if (classification === 'POM' && !config.applyVatOnPom) return 0;
    if (classification === 'CONTROLLED' && !config.applyVatOnControlled) return 0;
    if (classification === 'OTC' && !config.applyVatOnOtc) return 0;
    return config.totalRate;
  }

  /**
   * Update tax configuration (owner/manager only).
   */
  async updateTaxConfig(branchId: string, input: UpdateTaxConfigInput, updatedBy: string): Promise<TaxConfig> {
    const updates: string[] = [];
    const params: any[] = [branchId];
    let idx = 2;

    if (input.vatRate !== undefined) { updates.push('vat_rate = $' + idx); params.push(input.vatRate); idx++; }
    if (input.nhilRate !== undefined) { updates.push('nhil_rate = $' + idx); params.push(input.nhilRate); idx++; }
    if (input.getfundRate !== undefined) { updates.push('getfund_rate = $' + idx); params.push(input.getfundRate); idx++; }
    if (input.covidLevyRate !== undefined) { updates.push('covid_levy_rate = $' + idx); params.push(input.covidLevyRate); idx++; }
    if (input.applyVatOnOtc !== undefined) { updates.push('apply_vat_on_otc = $' + idx); params.push(input.applyVatOnOtc); idx++; }
    if (input.applyVatOnPom !== undefined) { updates.push('apply_vat_on_pom = $' + idx); params.push(input.applyVatOnPom); idx++; }
    if (input.applyVatOnControlled !== undefined) { updates.push('apply_vat_on_controlled = $' + idx); params.push(input.applyVatOnControlled); idx++; }

    if (updates.length === 0) return this.getTaxConfig(branchId);

    updates.push('updated_by = $' + idx); params.push(updatedBy); idx++;
    updates.push('updated_at = NOW()');

    await this.dataSource.query(
      `UPDATE tax_config SET ${updates.join(', ')} WHERE branch_id = $1`,
      params,
    );

    // Invalidate cache
    this.cache.delete(branchId);
    this.logger.log('Tax config updated for branch ' + branchId + ' by ' + updatedBy);
    return this.getTaxConfig(branchId);
  }

  private mapRow(row: any): TaxConfig {
    const vat = parseFloat(row.vat_rate);
    const nhil = parseFloat(row.nhil_rate);
    const getfund = parseFloat(row.getfund_rate);
    const covid = parseFloat(row.covid_levy_rate);
    return {
      branchId: row.branch_id,
      vatRate: vat,
      nhilRate: nhil,
      getfundRate: getfund,
      covidLevyRate: covid,
      totalRate: vat + nhil + getfund + covid,
      applyVatOnOtc: row.apply_vat_on_otc,
      applyVatOnPom: row.apply_vat_on_pom,
      applyVatOnControlled: row.apply_vat_on_controlled,
      updatedAt: row.updated_at,
    };
  }

  private getDefaultConfig(branchId: string): TaxConfig {
    return {
      branchId,
      vatRate: 0.125,
      nhilRate: 0.025,
      getfundRate: 0,
      covidLevyRate: 0,
      totalRate: 0.15,
      applyVatOnOtc: true,
      applyVatOnPom: false,
      applyVatOnControlled: false,
      updatedAt: new Date(),
    };
  }
}
