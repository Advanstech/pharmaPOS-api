import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { GraphQLError } from 'graphql';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import axios from 'axios';
import OpenAI from 'openai';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import {
  CreatePrescriptionInput,
  VerifyPrescriptionInput,
  PrescriptionOutput,
  PrescriptionItemOutput,
} from './dto/pharmacy.types';

// Ghana FDA: Rx validity window — exactly 30 days, never extendable
const RX_VALIDITY_DAYS = 30;
// GMDC cache TTL — 24 hours
const GMDC_CACHE_TTL_SECONDS = 86_400;

export type InteractionSeverity = 'MINOR' | 'MODERATE' | 'MAJOR' | 'CONTRAINDICATED';

export interface DrugInteractionResult {
  severity: InteractionSeverity;
  description: string;
  canOverride: boolean;
}

const RXNORM_BASE = 'https://rxnav.nlm.nih.gov/REST';
const SEVERITY_LEVELS: readonly InteractionSeverity[] = ['MINOR', 'MODERATE', 'MAJOR', 'CONTRAINDICATED'];

@Injectable()
export class PharmacyService {
  private readonly logger = new Logger(PharmacyService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  /**
   * Ghana FDA: Validate prescriber licence against GMDC API.
   * Cache result 24h in Redis. If API down, use cache + log warning.
   * Never block sale due to external API outage.
   */
  async validateGmdcLicence(licenceNo: string): Promise<{ valid: boolean; cached: boolean }> {
    const cacheKey = `gmdc:${licenceNo}`;

    // Check Redis cache first
    const cached = await this.cache.get<{ valid: boolean }>(cacheKey);
    if (cached !== undefined && cached !== null) {
      return { valid: cached.valid, cached: true };
    }

    try {
      // Live GMDC API call
      const result = await this.callGmdcApi(licenceNo);
      await this.cache.set(cacheKey, { valid: result.valid }, GMDC_CACHE_TTL_SECONDS);

      if (!result.valid) {
        // Ghana FDA: expired/not-found licence is a hard block
        throw new GraphQLError('Prescriber licence is invalid or expired', {
          extensions: { code: 'GMDC_INVALID_LICENCE' },
        });
      }

      return { valid: true, cached: false };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;

      // Ghana FDA: if API down, allow with WARNING — never block due to outage
      this.logger.warn(`GMDC API unavailable for licence ${licenceNo} — allowing with warning`);
      return { valid: true, cached: false };
    }
  }

  /**
   * Ghana FDA: Check Rx validity — exactly 30 days from prescribed_date.
   * Never extendable under any circumstance.
   */
  validateRxExpiry(prescribedDate: Date): void {
    const expiryDate = new Date(prescribedDate);
    expiryDate.setDate(expiryDate.getDate() + RX_VALIDITY_DAYS);

    if (new Date() > expiryDate) {
      // Ghana FDA: expired Rx is a hard block
      throw new GraphQLError('Prescription has expired', {
        extensions: {
          code: 'FDA_RX_EXPIRED',
          message: 'This prescription is older than 30 days and cannot be dispensed.',
        },
      });
    }
  }

  /**
   * Ghana FDA: Drug interaction check via RxNorm + clinical reasoning layer.
   * NIH discontinued the RxNav drug–drug interaction API (Jan 2024); we resolve RxCUIs via
   * RxNorm then run an optional OpenAI clinical pass when OPENAI_API_KEY is set.
   * Severity enforcement:
   *   MINOR         → advisory only (non-blocking)
   *   MODERATE      → pharmacist acknowledgement required
   *   MAJOR         → checkout blocked, pharmacist override required + logged
   *   CONTRAINDICATED → hard block, NO override possible, ANY role
   */
  async checkDrugInteractions(productIds: string[]): Promise<DrugInteractionResult[]> {
    if (productIds.length < 2) return [];

    const provider = this.config.get<string>('DRUG_INTERACTION_PROVIDER');
    const openAiKey = this.config.get<string>('OPENAI_API_KEY');
    if (provider === 'off' || !openAiKey) {
      this.logger.debug(
        'Drug interaction analysis skipped (set OPENAI_API_KEY and DRUG_INTERACTION_PROVIDER=openai to enable)',
      );
      return [];
    }

    const rows = await this.dataSource.query(
      `SELECT id, name, generic_name FROM products WHERE id = ANY($1::uuid[]) AND is_active = true`,
      [productIds],
    ) as Array<{ id: string; name: string; generic_name: string | null }>;

    const names = [
      ...new Set(
        rows
          .map((r) => (r.generic_name?.trim() || r.name).trim())
          .filter(Boolean),
      ),
    ];
    if (names.length < 2) return [];

    try {
      const resolved = await this.resolveRxNormIngredients(names);
      if (resolved.length < 2) {
        this.logger.warn('Drug interaction check: fewer than 2 RxNorm ingredient matches — skipping');
        return [];
      }

      return await this.analyzeInteractionsWithOpenAI(resolved, openAiKey);
    } catch (err) {
      this.logger.warn(
        `Drug interaction check failed — allowing checkout without interaction data: ${err instanceof Error ? err.message : err}`,
      );
      return [];
    }
  }

  enforceInteractionSeverity(interactions: DrugInteractionResult[]): void {
    for (const interaction of interactions) {
      if (interaction.severity === 'CONTRAINDICATED') {
        // Ghana FDA: CONTRAINDICATED — hard block, NO override possible, ANY role
        throw new GraphQLError('Contraindicated drug combination detected', {
          extensions: {
            code: 'FDA_DRUG_CONTRAINDICATED',
            message: 'These medicines cannot be dispensed together. No override is possible.',
          },
        });
      }
    }
  }

  private async callGmdcApi(licenceNo: string): Promise<{ valid: boolean }> {
    const baseUrl = (this.config.get<string>('GMDC_API_URL') ?? 'https://api.gmdc.gov.gh').replace(/\/$/, '');
    const template =
      this.config.get<string>('GMDC_LICENCE_URL_TEMPLATE') ?? `${baseUrl}/v1/licences/{licence}`;
    const url = template.replace('{licence}', encodeURIComponent(licenceNo));

    const apiKey = this.config.get<string>('GMDC_API_KEY');
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
      headers['X-API-Key'] = apiKey;
    }

    this.logger.debug(`GMDC HTTP GET ${url.replace(licenceNo, '***')}`);

    const response = await axios.get<unknown>(url, {
      headers,
      timeout: 15_000,
      validateStatus: (s) => (s >= 200 && s < 500) || s === 404,
    });

    if (response.status === 404) {
      return { valid: false };
    }
    if (response.status >= 500) {
      throw new Error(`GMDC_HTTP_${response.status}`);
    }

    const valid = this.parseGmdcValidity(response.data);
    if (valid === null) {
      throw new Error('GMDC_UNPARSEABLE_RESPONSE');
    }
    return { valid };
  }

  /**
   * RxNorm approximate match → ingredient-level RxCUI (best-effort for product display names).
   */
  private async resolveRxNormIngredients(
    names: string[],
  ): Promise<Array<{ name: string; rxcui: string }>> {
    const out: Array<{ name: string; rxcui: string }> = [];
    for (const name of names) {
      const rxcui = await this.lookupRxNormApproximate(name);
      if (rxcui) out.push({ name, rxcui });
    }
    return out;
  }

  private async lookupRxNormApproximate(term: string): Promise<string | null> {
    const { data } = await axios.get<{
      approximateGroup?: { candidate?: Array<{ rxcui?: string }> };
    }>(`${RXNORM_BASE}/approximateTerm.json`, {
      params: { term, maxEntries: 1 },
      timeout: 12_000,
    });
    const c = data?.approximateGroup?.candidate?.[0];
    const id = c?.rxcui;
    return id ? String(id) : null;
  }

  private async analyzeInteractionsWithOpenAI(
    drugs: Array<{ name: string; rxcui: string }>,
    apiKey: string,
  ): Promise<DrugInteractionResult[]> {
    const model =
      this.config.get<string>('OPENAI_DRUG_INTERACTION_MODEL') ??
      this.config.get<string>('OPENAI_MODEL') ??
      'gpt-4o-mini';

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You assist a licensed pharmacy in Ghana. Given drugs with RxNorm RxCUIs, list clinically ' +
            'significant drug–drug interactions only when evidence-based. Respond with JSON: {"interactions":[...]}. ' +
            'Each item: severity (MINOR|MODERATE|MAJOR|CONTRAINDICATED), description (concise), canOverride (boolean). ' +
            'CONTRAINDICATED means never co-administer — set canOverride to false. If none, use [].',
        },
        {
          role: 'user',
          content: JSON.stringify({
            drugs: drugs.map((d) => ({ displayName: d.name, rxnormIngredientRxcui: d.rxcui })),
          }),
        },
      ],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      this.logger.warn('OpenAI drug interaction response was not valid JSON');
      return [];
    }

    const interactions = (parsed as { interactions?: unknown }).interactions;
    if (!Array.isArray(interactions)) return [];

    const results: DrugInteractionResult[] = [];
    for (const item of interactions) {
      const row = this.normalizeInteractionResult(item);
      if (row) results.push(row);
    }
    return results;
  }

  private normalizeInteractionResult(raw: unknown): DrugInteractionResult | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    const sev = o.severity;
    const description = o.description;
    if (typeof description !== 'string' || !description.trim()) return null;
    if (typeof sev !== 'string' || !SEVERITY_LEVELS.includes(sev as InteractionSeverity)) return null;

    const severity = sev as InteractionSeverity;
    const canOverride =
      severity === 'CONTRAINDICATED'
        ? false
        : typeof o.canOverride === 'boolean'
          ? o.canOverride
          : true;

    return { severity, description: description.trim(), canOverride };
  }

  /**
   * Interpret GMDC JSON — returns null if the payload cannot be interpreted (caller fails open).
   */
  private parseGmdcValidity(data: unknown): boolean | null {
    if (data === null || data === undefined) return null;

    if (typeof data === 'boolean') return data;

    if (typeof data === 'object') {
      const o = data as Record<string, unknown>;

      if (typeof o.valid === 'boolean') return o.valid;
      if (typeof o.isValid === 'boolean') return o.isValid;
      if (typeof o.active === 'boolean') return o.active;

      if (typeof o.status === 'string') {
        const s = o.status.toLowerCase();
        if (['active', 'valid', 'licensed', 'current', 'registered'].includes(s)) return true;
        if (['expired', 'revoked', 'suspended', 'invalid', 'inactive', 'lapsed'].includes(s)) return false;
      }

      if (o.data !== undefined && o.data !== null && typeof o.data === 'object') {
        return this.parseGmdcValidity(o.data);
      }

      if (o.licence !== undefined && o.licence !== null && typeof o.licence === 'object') {
        return this.parseGmdcValidity(o.licence);
      }
    }

    return null;
  }

  // ── Prescription CRUD ─────────────────────────────────────────────────────

  /**
   * Create a new prescription.
   * Ghana FDA: validates GMDC licence on creation, sets 30-day expiry.
   * Ghana FDA: chemical shop blocked by BranchTypeGuard at resolver level.
   */
  async createPrescription(
    input: CreatePrescriptionInput,
    actor: JwtUser,
  ): Promise<PrescriptionOutput> {
    // Ghana FDA: validate GMDC licence on every Rx creation
    await this.validateGmdcLicence(input.prescriberLicenceNo);

    const prescribedDate = new Date(input.prescribedDate);
    const expiryDate = new Date(prescribedDate);
    // Ghana FDA: Rx valid for exactly 30 days — never extendable
    expiryDate.setDate(expiryDate.getDate() + RX_VALIDITY_DAYS);

    const rxId = await this.dataSource.transaction(async (em) => {
      const [rx] = await em.query(`
        INSERT INTO prescriptions
          (id, branch_id, customer_id, prescriber_licence_no, prescriber_name, prescribed_date, expiry_date, status, approval_count)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'PENDING', 0)
        RETURNING id
      `, [
        actor.branchId,
        input.customerId,
        input.prescriberLicenceNo,
        input.prescriberName,
        prescribedDate,
        expiryDate,
      ]) as Array<{ id: string }>;

      for (const item of input.items) {
        await em.query(`
          INSERT INTO prescription_items (id, prescription_id, product_id, quantity, dosage_instructions)
          VALUES (gen_random_uuid(), $1, $2, $3, $4)
        `, [rx.id, item.productId, item.quantity, item.dosageInstructions ?? null]);
      }

      // Audit log — no PHI (use customer_id, not name)
      await em.query(`
        INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
        VALUES (gen_random_uuid(), $1, $2, 'RX_CREATED', 'prescription', $3, $4)
      `, [
        actor.branchId,
        actor.sub,
        rx.id,
        JSON.stringify({ prescriber_licence: input.prescriberLicenceNo, item_count: input.items.length }),
      ]);

      return rx.id;
    });

    this.logger.log(`Prescription created: id=${rxId} by user=${actor.sub}`);
    return this.getPrescription(rxId);
  }

  /**
   * Verify a prescription — pharmacist/head_pharmacist only.
   * Ghana FDA: controlled drugs require approval_count >= 2.
   */
  async verifyPrescription(
    input: VerifyPrescriptionInput,
    actor: JwtUser,
  ): Promise<PrescriptionOutput> {
    const rx = await this.getPrescription(input.prescriptionId);

    // Ghana FDA: check Rx hasn't expired
    this.validateRxExpiry(new Date(rx.prescribedDate));

    // Ghana FDA: re-validate GMDC licence on verification
    await this.validateGmdcLicence(rx.prescriberLicenceNo);

    await this.dataSource.transaction(async (em) => {
      await em.query(`
        UPDATE prescriptions
        SET status = 'VERIFIED', approval_count = approval_count + 1, updated_at = NOW()
        WHERE id = $1
      `, [input.prescriptionId]);

      await em.query(`
        INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
        VALUES (gen_random_uuid(), $1, $2, 'RX_VERIFIED', 'prescription', $3, $4)
      `, [
        actor.branchId,
        actor.sub,
        input.prescriptionId,
        JSON.stringify({ notes: input.notes ?? null }),
      ]);
    });

    this.logger.log(`Prescription verified: id=${input.prescriptionId} by pharmacist=${actor.sub}`);
    return this.getPrescription(input.prescriptionId);
  }

  async getPrescription(id: string): Promise<PrescriptionOutput> {
    const [rx] = await this.dataSource.query(`
      SELECT id, branch_id, customer_id, prescriber_licence_no, prescriber_name,
             prescribed_date, expiry_date, status, approval_count, created_at
      FROM prescriptions WHERE id = $1
    `, [id]) as Array<{
      id: string; branch_id: string; customer_id: string;
      prescriber_licence_no: string; prescriber_name: string;
      prescribed_date: Date; expiry_date: Date; status: string;
      approval_count: number; created_at: Date;
    }>;

    if (!rx) throw new NotFoundException(`Prescription ${id} not found`);

    const items = await this.dataSource.query(`
      SELECT pi.id, pi.product_id, p.name AS product_name, pi.quantity, pi.dosage_instructions
      FROM prescription_items pi
      JOIN products p ON p.id = pi.product_id
      WHERE pi.prescription_id = $1
    `, [id]) as Array<{
      id: string; product_id: string; product_name: string;
      quantity: number; dosage_instructions: string | null;
    }>;

    return {
      id: rx.id,
      branchId: rx.branch_id,
      customerId: rx.customer_id,
      prescriberLicenceNo: rx.prescriber_licence_no,
      prescriberName: rx.prescriber_name,
      prescribedDate: rx.prescribed_date,
      expiryDate: rx.expiry_date,
      status: rx.status,
      approvalCount: rx.approval_count,
      createdAt: rx.created_at,
      items: items.map((i): PrescriptionItemOutput => ({
        id: i.id,
        productId: i.product_id,
        productName: i.product_name,
        quantity: i.quantity,
        dosageInstructions: i.dosage_instructions ?? undefined,
      })),
    };
  }

  async getPendingPrescriptions(branchId: string): Promise<PrescriptionOutput[]> {
    const rows = await this.dataSource.query(`
      SELECT id FROM prescriptions
      WHERE branch_id = $1 AND status IN ('PENDING', 'VERIFIED')
      ORDER BY created_at DESC
      LIMIT 50
    `, [branchId]) as Array<{ id: string }>;

    return Promise.all(rows.map((r) => this.getPrescription(r.id)));
  }

  /**
   * POS / dispensing: prescriptions that include a given product (pending or verified).
   */
  async getPrescriptionsForProduct(branchId: string, productId: string): Promise<PrescriptionOutput[]> {
    const rows = await this.dataSource.query(
      `
      SELECT p.id
      FROM prescriptions p
      WHERE p.branch_id = $1
        AND p.status IN ('PENDING', 'VERIFIED')
        AND EXISTS (
          SELECT 1 FROM prescription_items pi
          WHERE pi.prescription_id = p.id AND pi.product_id = $2
        )
      ORDER BY CASE p.status WHEN 'VERIFIED' THEN 0 ELSE 1 END, p.created_at DESC
      LIMIT 25
    `,
      [branchId, productId],
    ) as Array<{ id: string }>;

    return Promise.all(rows.map((r) => this.getPrescription(r.id)));
  }

  /**
   * Ghana FDA: before completing a sale, ensure the Rx is verified, in-branch, unexpired,
   * lists the product, authorizes quantity, and (controlled) has dual sign-off.
   */
  async assertPrescriptionCoversProduct(
    prescriptionId: string,
    productId: string,
    quantity: number,
    branchId: string,
  ): Promise<void> {
    const rx = await this.getPrescription(prescriptionId);
    if (rx.branchId !== branchId) {
      throw new BadRequestException('Prescription belongs to another branch');
    }
    if (rx.status !== 'VERIFIED') {
      throw new GraphQLError('Prescription must be verified before dispensing', {
        extensions: { code: 'RX_NOT_VERIFIED' },
      });
    }
    this.validateRxExpiry(new Date(rx.prescribedDate));

    const line = rx.items.find((i) => i.productId === productId);
    if (!line) {
      throw new BadRequestException('This product is not on the selected prescription');
    }
    if (line.quantity < quantity) {
      throw new BadRequestException(
        `Prescription authorizes ${line.quantity} unit(s) of this medicine; sale line has ${quantity}`,
      );
    }

    const [prod] = await this.dataSource.query(
      `SELECT classification FROM products WHERE id = $1 AND is_active = true`,
      [productId],
    ) as Array<{ classification: string }>;
    if (prod?.classification === 'CONTROLLED' && rx.approvalCount < 2) {
      throw new BadRequestException(
        'Controlled medicine requires two pharmacist sign-offs before dispensing',
      );
    }
  }
}
