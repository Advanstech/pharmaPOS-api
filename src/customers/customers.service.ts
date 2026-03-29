import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createHash, randomInt } from 'crypto';
import * as crypto from 'crypto';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import {
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerOutput,
  CustomerSex,
} from './dto/customer.types';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function encryptPii(key: Buffer, plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptPii(key: Buffer, ciphertext: string): string {
  const [ivHex, tagHex, encHex] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

const CUSTOMER_READ_ROLES = [
  'owner',
  'se_admin',
  'manager',
  'head_pharmacist',
  'pharmacist',
] as const;

const CUSTOMER_CREATE_ROLES = [
  'owner',
  'se_admin',
  'manager',
  'head_pharmacist',
  'pharmacist',
  'technician',
  'cashier',
  'chemical_cashier',
] as const;

const CUSTOMER_UPDATE_ROLES = [
  'owner',
  'se_admin',
  'manager',
  'head_pharmacist',
  'pharmacist',
] as const;

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);
  private readonly encryptionKey: Buffer;

  constructor(private readonly dataSource: DataSource) {
    const raw = process.env.PII_ENCRYPTION_KEY;
    if (!raw || raw.length !== 64) {
      throw new Error(
        'PII_ENCRYPTION_KEY must be set to exactly 64 hex characters (32 bytes). ' +
          'Generate with: python3 -c "import secrets; print(secrets.token_hex(32))"',
      );
    }
    this.encryptionKey = Buffer.from(raw, 'hex');
  }

  private assertCanRead(actor: JwtUser): void {
    if (!(CUSTOMER_READ_ROLES as readonly string[]).includes(actor.role)) {
      throw new ForbiddenException(
        `Role '${actor.role}' cannot list or open customer records.`,
      );
    }
  }

  private assertCanSearch(actor: JwtUser): void {
    const read = (CUSTOMER_READ_ROLES as readonly string[]).includes(actor.role);
    const create = (CUSTOMER_CREATE_ROLES as readonly string[]).includes(actor.role);
    if (!read && !create) {
      throw new ForbiddenException(`Role '${actor.role}' cannot search customers.`);
    }
  }

  private assertCanCreate(actor: JwtUser): void {
    if (!(CUSTOMER_CREATE_ROLES as readonly string[]).includes(actor.role)) {
      throw new ForbiddenException(`Role '${actor.role}' cannot create customers.`);
    }
  }

  private assertCanUpdate(actor: JwtUser): void {
    if (!(CUSTOMER_UPDATE_ROLES as readonly string[]).includes(actor.role)) {
      throw new ForbiddenException(`Role '${actor.role}' cannot update customers.`);
    }
  }

  private hashPhone(branchId: string, phone: string): string {
    return createHash('sha256').update(`${branchId}:${phone.trim()}`).digest('hex');
  }

  private async allocateCustomerCode(): Promise<string> {
    for (let attempt = 0; attempt < 16; attempt++) {
      let code = 'PP-';
      for (let i = 0; i < 8; i++) {
        code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      }
      const hit = await this.dataSource.query(`SELECT 1 FROM customers WHERE customer_code = $1`, [
        code,
      ]) as unknown[];
      if (hit.length === 0) return code;
    }
    throw new BadRequestException('Could not allocate a unique customer code — retry.');
  }

  private mapRow(
    r: {
      id: string;
      branch_id: string;
      customer_code: string;
      name_encrypted: string | null;
      phone_hash: string | null;
      sex: string | null;
      age_years: number | null;
      ghana_card_encrypted: string | null;
      email: string | null;
      email_verified_at: Date | null;
      receipt_preference: string;
      marketing_consent: boolean;
      created_at: Date;
    },
  ): CustomerOutput {
    let name: string | undefined;
    if (r.name_encrypted) {
      try {
        name = decryptPii(this.encryptionKey, r.name_encrypted);
      } catch {
        this.logger.warn(`Could not decrypt name for customer ${r.id}`);
      }
    }
    return {
      id: r.id,
      branchId: r.branch_id,
      customerCode: r.customer_code,
      name,
      hasPhone: r.phone_hash != null && r.phone_hash.length > 0,
      sex: (r.sex as CustomerSex) ?? undefined,
      ageYears: r.age_years ?? undefined,
      hasGhanaCard: !!r.ghana_card_encrypted,
      email: r.email ?? undefined,
      hasEmail: !!r.email,
      receiptPreference: r.receipt_preference as 'email' | 'print' | 'both',
      marketingConsent: r.marketing_consent,
      emailVerifiedAt: r.email_verified_at ?? undefined,
      createdAt: r.created_at,
    };
  }

  async createCustomer(input: CreateCustomerInput, actor: JwtUser): Promise<CustomerOutput> {
    this.assertCanCreate(actor);
    const customerCode = await this.allocateCustomerCode();
    const phoneHash =
      input.phone?.trim() ? this.hashPhone(actor.branchId, input.phone.trim()) : null;
    const nameEnc = input.name?.trim() ? encryptPii(this.encryptionKey, input.name.trim()) : null;
    const ghEnc = input.ghanaCardNumber?.trim()
      ? encryptPii(this.encryptionKey, input.ghanaCardNumber.trim())
      : null;
    const sex = input.sex ?? null;
    const ageYears = input.ageYears ?? null;
    const email = input.email?.trim().toLowerCase() || null;
    const receiptPreference = input.receiptPreference ?? 'email';
    const marketingConsent = input.marketingConsent ?? false;

    const [row] = await this.dataSource.query(
      `
      INSERT INTO customers (
        id, branch_id, phone_hash, name_encrypted, date_of_birth_encrypted, allergies_encrypted,
        is_active, customer_code, sex, age_years, ghana_card_encrypted, email, 
        receipt_preference, marketing_consent
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, NULL, NULL, true, $4, $5, $6, $7, $8, $9, $10
      )
      RETURNING id, branch_id, customer_code, name_encrypted, phone_hash, sex, age_years, 
               ghana_card_encrypted, email, email_verified_at, receipt_preference, marketing_consent, created_at
    `,
      [actor.branchId, phoneHash, nameEnc, customerCode, sex, ageYears, ghEnc, email, receiptPreference, marketingConsent],
    ) as Array<{
      id: string;
      branch_id: string;
      customer_code: string;
      name_encrypted: string | null;
      phone_hash: string | null;
      sex: string | null;
      age_years: number | null;
      ghana_card_encrypted: string | null;
      email: string | null;
      email_verified_at: Date | null;
      receipt_preference: string;
      marketing_consent: boolean;
      created_at: Date;
    }>;

    this.logger.log(`Customer created id=${row.id} code=${customerCode} branch=${actor.branchId}`);
    return this.mapRow(row);
  }

  async updateCustomer(input: UpdateCustomerInput, actor: JwtUser): Promise<CustomerOutput> {
    this.assertCanUpdate(actor);
    const existing = await this.getCustomerRow(input.customerId);
    if (existing.branch_id !== actor.branchId) {
      throw new ForbiddenException('Customer is not in your branch');
    }

    let nameEnc = existing.name_encrypted;
    if (input.name !== undefined) {
      nameEnc = input.name.trim() ? encryptPii(this.encryptionKey, input.name.trim()) : null;
    }

    let phoneHash = existing.phone_hash;
    if (input.phone !== undefined) {
      phoneHash = input.phone.trim() ? this.hashPhone(actor.branchId, input.phone.trim()) : null;
    }

    let sex: string | null = existing.sex;
    if (input.sex !== undefined) sex = input.sex;

    let ageYears: number | null = existing.age_years;
    if (input.ageYears !== undefined) ageYears = input.ageYears;

    let ghEnc = existing.ghana_card_encrypted;
    if (input.ghanaCardNumber !== undefined) {
      ghEnc = input.ghanaCardNumber.trim()
        ? encryptPii(this.encryptionKey, input.ghanaCardNumber.trim())
        : null;
    }

    const [row] = await this.dataSource.query(
      `
      UPDATE customers SET
        name_encrypted = $2,
        phone_hash = $3,
        sex = $4,
        age_years = $5,
        ghana_card_encrypted = $6,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, branch_id, customer_code, name_encrypted, phone_hash, sex, age_years,
               ghana_card_encrypted, email, email_verified_at, receipt_preference, marketing_consent, created_at
    `,
      [input.customerId, nameEnc, phoneHash, sex, ageYears, ghEnc],
    ) as Array<{
      id: string;
      branch_id: string;
      customer_code: string;
      name_encrypted: string | null;
      phone_hash: string | null;
      sex: string | null;
      age_years: number | null;
      ghana_card_encrypted: string | null;
      email: string | null;
      email_verified_at: Date | null;
      receipt_preference: string;
      marketing_consent: boolean;
      created_at: Date;
    }>;

    if (!row) throw new NotFoundException('Customer not found');
    return this.mapRow(row);
  }

  private async getCustomerRow(id: string): Promise<{
    id: string;
    branch_id: string;
    customer_code: string;
    name_encrypted: string | null;
    phone_hash: string | null;
    sex: string | null;
    age_years: number | null;
    ghana_card_encrypted: string | null;
    email: string | null;
    email_verified_at: Date | null;
    receipt_preference: string;
    marketing_consent: boolean;
    created_at: Date;
  }> {
    const [row] = await this.dataSource.query(
      `
      SELECT id, branch_id, customer_code, name_encrypted, phone_hash, sex, age_years, 
             ghana_card_encrypted, email, email_verified_at, receipt_preference, marketing_consent, created_at
      FROM customers WHERE id = $1 AND is_active = true
    `,
      [id],
    ) as Array<{
      id: string;
      branch_id: string;
      customer_code: string;
      name_encrypted: string | null;
      phone_hash: string | null;
      sex: string | null;
      age_years: number | null;
      ghana_card_encrypted: string | null;
      email: string | null;
      email_verified_at: Date | null;
      receipt_preference: string;
      marketing_consent: boolean;
      created_at: Date;
    }>;
    if (!row) throw new NotFoundException(`Customer ${id} not found`);
    return row;
  }

  async getCustomer(id: string, actor: JwtUser): Promise<CustomerOutput> {
    this.assertCanSearch(actor);
    const row = await this.getCustomerRow(id);
    if (row.branch_id !== actor.branchId) {
      throw new ForbiddenException('Customer is not in your branch');
    }
    return this.mapRow(row);
  }

  async listCustomers(actor: JwtUser, limit = 50, offset = 0): Promise<CustomerOutput[]> {
    this.assertCanRead(actor);
    const cap = Math.min(Math.max(limit, 1), 100);
    const off = Math.max(offset, 0);
    const rows = await this.dataSource.query(
      `
      SELECT id, branch_id, customer_code, name_encrypted, phone_hash, sex, age_years, 
             ghana_card_encrypted, email, email_verified_at, receipt_preference, marketing_consent, created_at
      FROM customers
      WHERE branch_id = $1 AND is_active = true
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `,
      [actor.branchId, cap, off],
    ) as Array<{
      id: string;
      branch_id: string;
      customer_code: string;
      name_encrypted: string | null;
      phone_hash: string | null;
      sex: string | null;
      age_years: number | null;
      ghana_card_encrypted: string | null;
      email: string | null;
      email_verified_at: Date | null;
      receipt_preference: string;
      marketing_consent: boolean;
      created_at: Date;
    }>;
    return rows.map((r) => this.mapRow(r));
  }

  async searchCustomers(actor: JwtUser, query: string, limit = 20): Promise<CustomerOutput[]> {
    this.assertCanSearch(actor);
    const q = query.trim();
    if (q.length < 2) {
      throw new BadRequestException('Search query must be at least 2 characters');
    }
    const cap = Math.min(Math.max(limit, 1), 50);
    const like = `%${q}%`;
    const uuidLike = /^[0-9a-f-]{8,}$/i.test(q);
    const rows = await this.dataSource.query(
      `
      SELECT id, branch_id, customer_code, name_encrypted, phone_hash, sex, age_years, 
             ghana_card_encrypted, email, email_verified_at, receipt_preference, marketing_consent, created_at
      FROM customers
      WHERE branch_id = $1 AND is_active = true
        AND (
          customer_code ILIKE $2
          ${uuidLike ? 'OR CAST(id AS TEXT) ILIKE $2' : ''}
          OR email ILIKE $2
        )
      ORDER BY created_at DESC
      LIMIT $3
    `,
      [actor.branchId, like, cap],
    ) as Array<{
      id: string;
      branch_id: string;
      customer_code: string;
      name_encrypted: string | null;
      phone_hash: string | null;
      sex: string | null;
      age_years: number | null;
      ghana_card_encrypted: string | null;
      email: string | null;
      email_verified_at: Date | null;
      receipt_preference: string;
      marketing_consent: boolean;
      created_at: Date;
    }>;
    return rows.map((r) => this.mapRow(r));
  }
}
