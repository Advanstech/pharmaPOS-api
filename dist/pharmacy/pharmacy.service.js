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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PharmacyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PharmacyService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("typeorm");
const graphql_1 = require("graphql");
const common_2 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const axios_1 = require("axios");
const openai_1 = require("openai");
const RX_VALIDITY_DAYS = 30;
const GMDC_CACHE_TTL_SECONDS = 86400;
const RXNORM_BASE = 'https://rxnav.nlm.nih.gov/REST';
const SEVERITY_LEVELS = ['MINOR', 'MODERATE', 'MAJOR', 'CONTRAINDICATED'];
let PharmacyService = PharmacyService_1 = class PharmacyService {
    constructor(cache, dataSource, config) {
        this.cache = cache;
        this.dataSource = dataSource;
        this.config = config;
        this.logger = new common_1.Logger(PharmacyService_1.name);
    }
    async validateGmdcLicence(licenceNo) {
        const cacheKey = `gmdc:${licenceNo}`;
        const cached = await this.cache.get(cacheKey);
        if (cached !== undefined && cached !== null) {
            return { valid: cached.valid, cached: true };
        }
        try {
            const result = await this.callGmdcApi(licenceNo);
            await this.cache.set(cacheKey, { valid: result.valid }, GMDC_CACHE_TTL_SECONDS);
            if (!result.valid) {
                throw new graphql_1.GraphQLError('Prescriber licence is invalid or expired', {
                    extensions: { code: 'GMDC_INVALID_LICENCE' },
                });
            }
            return { valid: true, cached: false };
        }
        catch (err) {
            if (err instanceof graphql_1.GraphQLError)
                throw err;
            this.logger.warn(`GMDC API unavailable for licence ${licenceNo} — allowing with warning`);
            return { valid: true, cached: false };
        }
    }
    validateRxExpiry(prescribedDate) {
        const expiryDate = new Date(prescribedDate);
        expiryDate.setDate(expiryDate.getDate() + RX_VALIDITY_DAYS);
        if (new Date() > expiryDate) {
            throw new graphql_1.GraphQLError('Prescription has expired', {
                extensions: {
                    code: 'FDA_RX_EXPIRED',
                    message: 'This prescription is older than 30 days and cannot be dispensed.',
                },
            });
        }
    }
    async checkDrugInteractions(productIds) {
        if (productIds.length < 2)
            return [];
        const provider = this.config.get('DRUG_INTERACTION_PROVIDER');
        const openAiKey = this.config.get('OPENAI_API_KEY');
        if (provider === 'off' || !openAiKey) {
            this.logger.debug('Drug interaction analysis skipped (set OPENAI_API_KEY and DRUG_INTERACTION_PROVIDER=openai to enable)');
            return [];
        }
        const rows = await this.dataSource.query(`SELECT id, name, generic_name FROM products WHERE id = ANY($1::uuid[]) AND is_active = true`, [productIds]);
        const names = [
            ...new Set(rows
                .map((r) => { var _a; return (((_a = r.generic_name) === null || _a === void 0 ? void 0 : _a.trim()) || r.name).trim(); })
                .filter(Boolean)),
        ];
        if (names.length < 2)
            return [];
        try {
            const resolved = await this.resolveRxNormIngredients(names);
            if (resolved.length < 2) {
                this.logger.warn('Drug interaction check: fewer than 2 RxNorm ingredient matches — skipping');
                return [];
            }
            return await this.analyzeInteractionsWithOpenAI(resolved, openAiKey);
        }
        catch (err) {
            this.logger.warn(`Drug interaction check failed — allowing checkout without interaction data: ${err instanceof Error ? err.message : err}`);
            return [];
        }
    }
    enforceInteractionSeverity(interactions) {
        for (const interaction of interactions) {
            if (interaction.severity === 'CONTRAINDICATED') {
                throw new graphql_1.GraphQLError('Contraindicated drug combination detected', {
                    extensions: {
                        code: 'FDA_DRUG_CONTRAINDICATED',
                        message: 'These medicines cannot be dispensed together. No override is possible.',
                    },
                });
            }
        }
    }
    async callGmdcApi(licenceNo) {
        var _a, _b;
        const baseUrl = ((_a = this.config.get('GMDC_API_URL')) !== null && _a !== void 0 ? _a : 'https://api.gmdc.gov.gh').replace(/\/$/, '');
        const template = (_b = this.config.get('GMDC_LICENCE_URL_TEMPLATE')) !== null && _b !== void 0 ? _b : `${baseUrl}/v1/licences/{licence}`;
        const url = template.replace('{licence}', encodeURIComponent(licenceNo));
        const apiKey = this.config.get('GMDC_API_KEY');
        const headers = { Accept: 'application/json' };
        if (apiKey) {
            headers.Authorization = `Bearer ${apiKey}`;
            headers['X-API-Key'] = apiKey;
        }
        this.logger.debug(`GMDC HTTP GET ${url.replace(licenceNo, '***')}`);
        const response = await axios_1.default.get(url, {
            headers,
            timeout: 15000,
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
    async resolveRxNormIngredients(names) {
        const out = [];
        for (const name of names) {
            const rxcui = await this.lookupRxNormApproximate(name);
            if (rxcui)
                out.push({ name, rxcui });
        }
        return out;
    }
    async lookupRxNormApproximate(term) {
        var _a, _b;
        const { data } = await axios_1.default.get(`${RXNORM_BASE}/approximateTerm.json`, {
            params: { term, maxEntries: 1 },
            timeout: 12000,
        });
        const c = (_b = (_a = data === null || data === void 0 ? void 0 : data.approximateGroup) === null || _a === void 0 ? void 0 : _a.candidate) === null || _b === void 0 ? void 0 : _b[0];
        const id = c === null || c === void 0 ? void 0 : c.rxcui;
        return id ? String(id) : null;
    }
    async analyzeInteractionsWithOpenAI(drugs, apiKey) {
        var _a, _b, _c, _d;
        const model = (_b = (_a = this.config.get('OPENAI_DRUG_INTERACTION_MODEL')) !== null && _a !== void 0 ? _a : this.config.get('OPENAI_MODEL')) !== null && _b !== void 0 ? _b : 'gpt-4o-mini';
        const client = new openai_1.default({ apiKey });
        const completion = await client.chat.completions.create({
            model,
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: 'You assist a licensed pharmacy in Ghana. Given drugs with RxNorm RxCUIs, list clinically ' +
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
        const text = (_d = (_c = completion.choices[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content;
        if (!text)
            return [];
        let parsed;
        try {
            parsed = JSON.parse(text);
        }
        catch (_e) {
            this.logger.warn('OpenAI drug interaction response was not valid JSON');
            return [];
        }
        const interactions = parsed.interactions;
        if (!Array.isArray(interactions))
            return [];
        const results = [];
        for (const item of interactions) {
            const row = this.normalizeInteractionResult(item);
            if (row)
                results.push(row);
        }
        return results;
    }
    normalizeInteractionResult(raw) {
        if (!raw || typeof raw !== 'object')
            return null;
        const o = raw;
        const sev = o.severity;
        const description = o.description;
        if (typeof description !== 'string' || !description.trim())
            return null;
        if (typeof sev !== 'string' || !SEVERITY_LEVELS.includes(sev))
            return null;
        const severity = sev;
        const canOverride = severity === 'CONTRAINDICATED'
            ? false
            : typeof o.canOverride === 'boolean'
                ? o.canOverride
                : true;
        return { severity, description: description.trim(), canOverride };
    }
    parseGmdcValidity(data) {
        if (data === null || data === undefined)
            return null;
        if (typeof data === 'boolean')
            return data;
        if (typeof data === 'object') {
            const o = data;
            if (typeof o.valid === 'boolean')
                return o.valid;
            if (typeof o.isValid === 'boolean')
                return o.isValid;
            if (typeof o.active === 'boolean')
                return o.active;
            if (typeof o.status === 'string') {
                const s = o.status.toLowerCase();
                if (['active', 'valid', 'licensed', 'current', 'registered'].includes(s))
                    return true;
                if (['expired', 'revoked', 'suspended', 'invalid', 'inactive', 'lapsed'].includes(s))
                    return false;
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
    async createPrescription(input, actor) {
        await this.validateGmdcLicence(input.prescriberLicenceNo);
        const prescribedDate = new Date(input.prescribedDate);
        const expiryDate = new Date(prescribedDate);
        expiryDate.setDate(expiryDate.getDate() + RX_VALIDITY_DAYS);
        const rxId = await this.dataSource.transaction(async (em) => {
            var _a;
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
            ]);
            for (const item of input.items) {
                await em.query(`
          INSERT INTO prescription_items (id, prescription_id, product_id, quantity, dosage_instructions)
          VALUES (gen_random_uuid(), $1, $2, $3, $4)
        `, [rx.id, item.productId, item.quantity, (_a = item.dosageInstructions) !== null && _a !== void 0 ? _a : null]);
            }
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
    async verifyPrescription(input, actor) {
        const rx = await this.getPrescription(input.prescriptionId);
        this.validateRxExpiry(new Date(rx.prescribedDate));
        await this.validateGmdcLicence(rx.prescriberLicenceNo);
        await this.dataSource.transaction(async (em) => {
            var _a;
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
                JSON.stringify({ notes: (_a = input.notes) !== null && _a !== void 0 ? _a : null }),
            ]);
        });
        this.logger.log(`Prescription verified: id=${input.prescriptionId} by pharmacist=${actor.sub}`);
        return this.getPrescription(input.prescriptionId);
    }
    async getPrescription(id) {
        const [rx] = await this.dataSource.query(`
      SELECT id, branch_id, customer_id, prescriber_licence_no, prescriber_name,
             prescribed_date, expiry_date, status, approval_count, created_at
      FROM prescriptions WHERE id = $1
    `, [id]);
        if (!rx)
            throw new common_1.NotFoundException(`Prescription ${id} not found`);
        const items = await this.dataSource.query(`
      SELECT pi.id, pi.product_id, p.name AS product_name, pi.quantity, pi.dosage_instructions
      FROM prescription_items pi
      JOIN products p ON p.id = pi.product_id
      WHERE pi.prescription_id = $1
    `, [id]);
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
            items: items.map((i) => {
                var _a;
                return ({
                    id: i.id,
                    productId: i.product_id,
                    productName: i.product_name,
                    quantity: i.quantity,
                    dosageInstructions: (_a = i.dosage_instructions) !== null && _a !== void 0 ? _a : undefined,
                });
            }),
        };
    }
    async getPendingPrescriptions(branchId) {
        const rows = await this.dataSource.query(`
      SELECT id FROM prescriptions
      WHERE branch_id = $1 AND status IN ('PENDING', 'VERIFIED')
      ORDER BY created_at DESC
      LIMIT 50
    `, [branchId]);
        return Promise.all(rows.map((r) => this.getPrescription(r.id)));
    }
    async getPrescriptionsForProduct(branchId, productId) {
        const rows = await this.dataSource.query(`
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
    `, [branchId, productId]);
        return Promise.all(rows.map((r) => this.getPrescription(r.id)));
    }
    async assertPrescriptionCoversProduct(prescriptionId, productId, quantity, branchId) {
        const rx = await this.getPrescription(prescriptionId);
        if (rx.branchId !== branchId) {
            throw new common_1.BadRequestException('Prescription belongs to another branch');
        }
        if (rx.status !== 'VERIFIED') {
            throw new graphql_1.GraphQLError('Prescription must be verified before dispensing', {
                extensions: { code: 'RX_NOT_VERIFIED' },
            });
        }
        this.validateRxExpiry(new Date(rx.prescribedDate));
        const line = rx.items.find((i) => i.productId === productId);
        if (!line) {
            throw new common_1.BadRequestException('This product is not on the selected prescription');
        }
        if (line.quantity < quantity) {
            throw new common_1.BadRequestException(`Prescription authorizes ${line.quantity} unit(s) of this medicine; sale line has ${quantity}`);
        }
        const [prod] = await this.dataSource.query(`SELECT classification FROM products WHERE id = $1 AND is_active = true`, [productId]);
        if ((prod === null || prod === void 0 ? void 0 : prod.classification) === 'CONTROLLED' && rx.approvalCount < 2) {
            throw new common_1.BadRequestException('Controlled medicine requires two pharmacist sign-offs before dispensing');
        }
    }
};
exports.PharmacyService = PharmacyService;
exports.PharmacyService = PharmacyService = PharmacyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_2.Inject)(cache_manager_1.CACHE_MANAGER)),
    __metadata("design:paramtypes", [Object, typeorm_1.DataSource,
        config_1.ConfigService])
], PharmacyService);
//# sourceMappingURL=pharmacy.service.js.map