"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CustomersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const crypto_1 = require("crypto");
const crypto = require("crypto");
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function encryptPii(key, plaintext) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}
function decryptPii(key, ciphertext) {
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
];
const CUSTOMER_CREATE_ROLES = [
    'owner',
    'se_admin',
    'manager',
    'head_pharmacist',
    'pharmacist',
    'technician',
    'cashier',
    'chemical_cashier',
];
const CUSTOMER_UPDATE_ROLES = [
    'owner',
    'se_admin',
    'manager',
    'head_pharmacist',
    'pharmacist',
];
let CustomersService = CustomersService_1 = class CustomersService {
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(CustomersService_1.name);
        const raw = process.env.PII_ENCRYPTION_KEY;
        if (!raw || raw.length !== 64) {
            throw new Error('PII_ENCRYPTION_KEY must be set to exactly 64 hex characters (32 bytes). ' +
                'Generate with: python3 -c "import secrets; print(secrets.token_hex(32))"');
        }
        this.encryptionKey = Buffer.from(raw, 'hex');
    }
    assertCanRead(actor) {
        if (!CUSTOMER_READ_ROLES.includes(actor.role)) {
            throw new common_1.ForbiddenException(`Role '${actor.role}' cannot list or open customer records.`);
        }
    }
    assertCanSearch(actor) {
        const read = CUSTOMER_READ_ROLES.includes(actor.role);
        const create = CUSTOMER_CREATE_ROLES.includes(actor.role);
        if (!read && !create) {
            throw new common_1.ForbiddenException(`Role '${actor.role}' cannot search customers.`);
        }
    }
    assertCanCreate(actor) {
        if (!CUSTOMER_CREATE_ROLES.includes(actor.role)) {
            throw new common_1.ForbiddenException(`Role '${actor.role}' cannot create customers.`);
        }
    }
    assertCanUpdate(actor) {
        if (!CUSTOMER_UPDATE_ROLES.includes(actor.role)) {
            throw new common_1.ForbiddenException(`Role '${actor.role}' cannot update customers.`);
        }
    }
    hashPhone(branchId, phone) {
        return (0, crypto_1.createHash)('sha256').update(`${branchId}:${phone.trim()}`).digest('hex');
    }
    async allocateCustomerCode() {
        for (let attempt = 0; attempt < 16; attempt++) {
            let code = 'PP-';
            for (let i = 0; i < 8; i++) {
                code += CODE_ALPHABET[(0, crypto_1.randomInt)(CODE_ALPHABET.length)];
            }
            const hit = await this.dataSource.query(`SELECT 1 FROM customers WHERE customer_code = $1`, [
                code,
            ]);
            if (hit.length === 0)
                return code;
        }
        throw new common_1.BadRequestException('Could not allocate a unique customer code — retry.');
    }
    mapRow(r) {
        var _a, _b;
        let name;
        if (r.name_encrypted) {
            try {
                name = decryptPii(this.encryptionKey, r.name_encrypted);
            }
            catch (_c) {
                this.logger.warn(`Could not decrypt name for customer ${r.id}`);
            }
        }
        return {
            id: r.id,
            branchId: r.branch_id,
            customerCode: r.customer_code,
            name,
            hasPhone: r.phone_hash != null && r.phone_hash.length > 0,
            sex: (_a = r.sex) !== null && _a !== void 0 ? _a : undefined,
            ageYears: (_b = r.age_years) !== null && _b !== void 0 ? _b : undefined,
            hasGhanaCard: !!r.ghana_card_encrypted,
            createdAt: r.created_at,
        };
    }
    async createCustomer(input, actor) {
        var _a, _b, _c, _d, _e;
        this.assertCanCreate(actor);
        const customerCode = await this.allocateCustomerCode();
        const phoneHash = ((_a = input.phone) === null || _a === void 0 ? void 0 : _a.trim()) ? this.hashPhone(actor.branchId, input.phone.trim()) : null;
        const nameEnc = ((_b = input.name) === null || _b === void 0 ? void 0 : _b.trim()) ? encryptPii(this.encryptionKey, input.name.trim()) : null;
        const ghEnc = ((_c = input.ghanaCardNumber) === null || _c === void 0 ? void 0 : _c.trim())
            ? encryptPii(this.encryptionKey, input.ghanaCardNumber.trim())
            : null;
        const sex = (_d = input.sex) !== null && _d !== void 0 ? _d : null;
        const ageYears = (_e = input.ageYears) !== null && _e !== void 0 ? _e : null;
        const [row] = await this.dataSource.query(`
      INSERT INTO customers (
        id, branch_id, phone_hash, name_encrypted, date_of_birth_encrypted, allergies_encrypted,
        is_active, customer_code, sex, age_years, ghana_card_encrypted
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, NULL, NULL, true, $4, $5, $6, $7
      )
      RETURNING id, branch_id, customer_code, name_encrypted, phone_hash, sex, age_years, ghana_card_encrypted, created_at
    `, [actor.branchId, phoneHash, nameEnc, customerCode, sex, ageYears, ghEnc]);
        this.logger.log(`Customer created id=${row.id} code=${customerCode} branch=${actor.branchId}`);
        return this.mapRow(row);
    }
    async updateCustomer(input, actor) {
        this.assertCanUpdate(actor);
        const existing = await this.getCustomerRow(input.customerId);
        if (existing.branch_id !== actor.branchId) {
            throw new common_1.ForbiddenException('Customer is not in your branch');
        }
        let nameEnc = existing.name_encrypted;
        if (input.name !== undefined) {
            nameEnc = input.name.trim() ? encryptPii(this.encryptionKey, input.name.trim()) : null;
        }
        let phoneHash = existing.phone_hash;
        if (input.phone !== undefined) {
            phoneHash = input.phone.trim() ? this.hashPhone(actor.branchId, input.phone.trim()) : null;
        }
        let sex = existing.sex;
        if (input.sex !== undefined)
            sex = input.sex;
        let ageYears = existing.age_years;
        if (input.ageYears !== undefined)
            ageYears = input.ageYears;
        let ghEnc = existing.ghana_card_encrypted;
        if (input.ghanaCardNumber !== undefined) {
            ghEnc = input.ghanaCardNumber.trim()
                ? encryptPii(this.encryptionKey, input.ghanaCardNumber.trim())
                : null;
        }
        const [row] = await this.dataSource.query(`
      UPDATE customers SET
        name_encrypted = $2,
        phone_hash = $3,
        sex = $4,
        age_years = $5,
        ghana_card_encrypted = $6,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, branch_id, customer_code, name_encrypted, phone_hash, sex, age_years, ghana_card_encrypted, created_at
    `, [input.customerId, nameEnc, phoneHash, sex, ageYears, ghEnc]);
        if (!row)
            throw new common_1.NotFoundException('Customer not found');
        return this.mapRow(row);
    }
    async getCustomerRow(id) {
        const [row] = await this.dataSource.query(`
      SELECT id, branch_id, customer_code, name_encrypted, phone_hash, sex, age_years, ghana_card_encrypted, created_at
      FROM customers WHERE id = $1 AND is_active = true
    `, [id]);
        if (!row)
            throw new common_1.NotFoundException(`Customer ${id} not found`);
        return row;
    }
    async getCustomer(id, actor) {
        this.assertCanSearch(actor);
        const row = await this.getCustomerRow(id);
        if (row.branch_id !== actor.branchId) {
            throw new common_1.ForbiddenException('Customer is not in your branch');
        }
        return this.mapRow(row);
    }
    async listCustomers(actor, limit = 50, offset = 0) {
        this.assertCanRead(actor);
        const cap = Math.min(Math.max(limit, 1), 100);
        const off = Math.max(offset, 0);
        const rows = await this.dataSource.query(`
      SELECT id, branch_id, customer_code, name_encrypted, phone_hash, sex, age_years, ghana_card_encrypted, created_at
      FROM customers
      WHERE branch_id = $1 AND is_active = true
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [actor.branchId, cap, off]);
        return rows.map((r) => this.mapRow(r));
    }
    async searchCustomers(actor, query, limit = 20) {
        this.assertCanSearch(actor);
        const q = query.trim();
        if (q.length < 2) {
            throw new common_1.BadRequestException('Search query must be at least 2 characters');
        }
        const cap = Math.min(Math.max(limit, 1), 50);
        const like = `%${q}%`;
        const uuidLike = /^[0-9a-f-]{8,}$/i.test(q);
        const rows = await this.dataSource.query(`
      SELECT id, branch_id, customer_code, name_encrypted, phone_hash, sex, age_years, ghana_card_encrypted, created_at
      FROM customers
      WHERE branch_id = $1 AND is_active = true
        AND (
          customer_code ILIKE $2
          ${uuidLike ? 'OR CAST(id AS TEXT) ILIKE $2' : ''}
        )
      ORDER BY created_at DESC
      LIMIT $3
    `, [actor.branchId, like, cap]);
        return rows.map((r) => this.mapRow(r));
    }
};
exports.CustomersService = CustomersService;
exports.CustomersService = CustomersService = CustomersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], CustomersService);
//# sourceMappingURL=customers.service.js.map