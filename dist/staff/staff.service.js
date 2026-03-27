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
var StaffService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const user_entity_1 = require("../auth/entities/user.entity");
const staff_profile_entity_1 = require("./entities/staff_profile.entity");
const STAFF_MANAGER_ROLES = ['owner', 'se_admin', 'manager'];
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
let StaffService = StaffService_1 = class StaffService {
    constructor(users, profiles, dataSource) {
        this.users = users;
        this.profiles = profiles;
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(StaffService_1.name);
        const raw = process.env.PII_ENCRYPTION_KEY;
        if (!raw || raw.length !== 64) {
            throw new Error('PII_ENCRYPTION_KEY must be set to exactly 64 hex characters (32 bytes). ' +
                'Generate with: python3 -c "import secrets; print(secrets.token_hex(32))"');
        }
        this.encryptionKey = Buffer.from(raw, 'hex');
    }
    async inviteStaff(input, actor) {
        this.assertStaffManager(actor);
        const targetBranchId = actor.branchId;
        if (input.email) {
            const existing = await this.users.findOne({ where: { email: input.email } });
            if (existing)
                throw new common_1.ConflictException(`Email ${input.email} already in use`);
        }
        const tempPassword = crypto.randomBytes(8).toString('hex');
        const passwordHash = await bcrypt.hash(tempPassword, 12);
        const userId = await this.dataSource.transaction(async (em) => {
            var _a, _b, _c, _d, _e;
            const [userRow] = await em.query(`
        INSERT INTO users (id, branch_id, name, email, phone, role, password_hash, is_active)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, true)
        RETURNING id
      `, [
                targetBranchId,
                input.name,
                (_a = input.email) !== null && _a !== void 0 ? _a : null,
                (_b = input.phone) !== null && _b !== void 0 ? _b : null,
                input.role,
                passwordHash,
            ]);
            await em.query(`
        INSERT INTO staff_profiles (id, user_id, branch_id, position, department, employment_type)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
      `, [
                userRow.id,
                targetBranchId,
                (_c = input.position) !== null && _c !== void 0 ? _c : null,
                (_d = input.department) !== null && _d !== void 0 ? _d : null,
                (_e = input.employment_type) !== null && _e !== void 0 ? _e : 'full_time',
            ]);
            await em.query(`
        INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
        VALUES (gen_random_uuid(), $1, $2, 'STAFF_INVITED', 'user', $3, $4)
      `, [
                targetBranchId,
                actor.sub,
                userRow.id,
                JSON.stringify({ role: input.role, invited_by: actor.sub }),
            ]);
            return userRow.id;
        });
        this.logger.log(`Staff invited: user=${userId} role=${input.role} by actor=${actor.sub}`);
        return {
            userId,
            name: input.name,
            temporaryPassword: tempPassword,
            message: 'Staff member invited. Share the temporary password securely — it must be changed on first login.',
        };
    }
    async updateProfile(input, actor) {
        const isSelf = actor.sub === input.userId;
        const isManager = STAFF_MANAGER_ROLES.includes(actor.role);
        if (!isSelf && !isManager) {
            throw new common_1.ForbiddenException('You can only update your own profile');
        }
        const profile = await this.profiles.findOne({ where: { user_id: input.userId } });
        if (!profile)
            throw new common_1.NotFoundException(`Staff profile not found for user ${input.userId}`);
        const updates = {};
        if (input.position !== undefined)
            updates.position = input.position;
        if (input.department !== undefined)
            updates.department = input.department;
        if (input.employment_type !== undefined)
            updates.employment_type = input.employment_type;
        if (input.gender !== undefined)
            updates.gender = input.gender;
        if (input.start_date !== undefined)
            updates.start_date = input.start_date;
        if (input.end_date !== undefined)
            updates.end_date = input.end_date;
        if (input.professional_licence_no !== undefined)
            updates.professional_licence_no = input.professional_licence_no;
        if (input.licence_expiry_date !== undefined)
            updates.licence_expiry_date = input.licence_expiry_date;
        if (input.emergency_contact_name !== undefined)
            updates.emergency_contact_name = input.emergency_contact_name;
        if (input.emergency_contact_phone !== undefined)
            updates.emergency_contact_phone = input.emergency_contact_phone;
        if (input.notes !== undefined && isManager)
            updates.notes = input.notes;
        if (input.phone !== undefined)
            updates.phone_encrypted = encryptPii(this.encryptionKey, input.phone);
        if (input.address !== undefined)
            updates.address_encrypted = encryptPii(this.encryptionKey, input.address);
        if (input.date_of_birth !== undefined)
            updates.date_of_birth_encrypted = encryptPii(this.encryptionKey, input.date_of_birth);
        if (input.ghana_card_number !== undefined)
            updates.ghana_card_number_encrypted = encryptPii(this.encryptionKey, input.ghana_card_number);
        if (Object.keys(updates).length > 0) {
            updates.updated_at = new Date();
            await this.profiles.update({ user_id: input.userId }, updates);
        }
        this.logger.log(`Staff profile updated: user=${input.userId} by actor=${actor.sub}`);
        return this.getStaffMember(input.userId, actor);
    }
    async deactivateStaff(userId, actor) {
        this.assertStaffManager(actor);
        const user = await this.users.findOne({ where: { id: userId } });
        if (!user)
            throw new common_1.NotFoundException(`User ${userId} not found`);
        if (userId === actor.sub)
            throw new common_1.ForbiddenException('Cannot deactivate your own account');
        await this.dataSource.transaction(async (em) => {
            await em.update(user_entity_1.User, { id: userId }, { is_active: false });
            await em.update(staff_profile_entity_1.StaffProfile, { user_id: userId }, { is_active: false });
            await em.query(`UPDATE staff_sessions SET ended_at = NOW() WHERE user_id = $1 AND ended_at IS NULL`, [userId]);
            await em.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
            await em.query(`
        INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
        VALUES (gen_random_uuid(), $1, $2, 'STAFF_DEACTIVATED', 'user', $3, $4)
      `, [
                actor.branchId,
                actor.sub,
                userId,
                JSON.stringify({ deactivated_by: actor.sub }),
            ]);
        });
        this.logger.log(`Staff deactivated: user=${userId} by actor=${actor.sub}`);
        return true;
    }
    async resetPassword(input, actor) {
        this.assertStaffManager(actor);
        const user = await this.users.findOne({ where: { id: input.userId } });
        if (!user)
            throw new common_1.NotFoundException(`User ${input.userId} not found`);
        const newHash = await bcrypt.hash(input.newPassword, 12);
        await this.dataSource.transaction(async (em) => {
            await em.update(user_entity_1.User, { id: input.userId }, { password_hash: newHash });
            await em.query(`UPDATE staff_sessions SET ended_at = NOW() WHERE user_id = $1 AND ended_at IS NULL`, [input.userId]);
            await em.query(`DELETE FROM sessions WHERE user_id = $1`, [input.userId]);
            await em.query(`
        INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
        VALUES (gen_random_uuid(), $1, $2, 'PASSWORD_RESET', 'user', $3, $4)
      `, [
                actor.branchId,
                actor.sub,
                input.userId,
                JSON.stringify({ reset_by: actor.sub }),
            ]);
        });
        this.logger.log(`Password reset: user=${input.userId} by actor=${actor.sub}`);
        return true;
    }
    async listStaffSessionHistory(actor, options = {}) {
        var _a, _b, _c, _d;
        this.assertStaffManager(actor);
        const [orgRow] = await this.dataSource.query(`SELECT organization_id FROM branches WHERE id = $1`, [actor.branchId]);
        if (!(orgRow === null || orgRow === void 0 ? void 0 : orgRow.organization_id)) {
            throw new common_1.NotFoundException('Branch not found');
        }
        const limit = Math.min(Math.max((_a = options.limit) !== null && _a !== void 0 ? _a : 50, 1), 100);
        const offset = Math.max((_b = options.offset) !== null && _b !== void 0 ? _b : 0, 0);
        const params = [];
        let branchClause;
        if (actor.role === 'manager') {
            params.push(actor.branchId);
            branchClause = `ss.branch_id = $1`;
        }
        else if (options.branchId) {
            const [b] = await this.dataSource.query(`SELECT id FROM branches WHERE id = $1 AND organization_id = $2`, [options.branchId, orgRow.organization_id]);
            if (!b) {
                throw new common_1.ForbiddenException('Branch is not in your organization');
            }
            params.push(options.branchId);
            branchClause = `ss.branch_id = $1`;
        }
        else {
            params.push(orgRow.organization_id);
            branchClause = `ss.branch_id IN (SELECT id FROM branches WHERE organization_id = $1)`;
        }
        params.push((_c = options.fromDate) !== null && _c !== void 0 ? _c : null, (_d = options.toDate) !== null && _d !== void 0 ? _d : null, limit, offset);
        const iFrom = 2;
        const iTo = 3;
        const iLim = 4;
        const iOff = 5;
        const rows = await this.dataSource.query(`
      SELECT
        ss.id,
        ss.user_id,
        u.name AS user_name,
        u.role AS user_role,
        ss.branch_id,
        b.name AS branch_name,
        ss.session_id,
        ss.started_at,
        ss.ended_at,
        ss.last_seen_at,
        ss.ip_address,
        ss.user_agent
      FROM staff_sessions ss
      INNER JOIN users u ON u.id = ss.user_id
      INNER JOIN branches b ON b.id = ss.branch_id
      WHERE ${branchClause}
        AND (ss.started_at AT TIME ZONE 'Africa/Accra')::date >= COALESCE($${iFrom}::date, (NOW() AT TIME ZONE 'Africa/Accra')::date - 14)
        AND (ss.started_at AT TIME ZONE 'Africa/Accra')::date <= COALESCE($${iTo}::date, (NOW() AT TIME ZONE 'Africa/Accra')::date)
      ORDER BY ss.started_at DESC
      LIMIT $${iLim} OFFSET $${iOff}
    `, params);
        return rows.map((r) => {
            var _a, _b, _c;
            return ({
                id: r.id,
                user_id: r.user_id,
                user_name: r.user_name,
                user_role: r.user_role,
                branch_id: r.branch_id,
                branch_name: r.branch_name,
                session_id: r.session_id,
                started_at: r.started_at,
                ended_at: (_a = r.ended_at) !== null && _a !== void 0 ? _a : undefined,
                last_seen_at: r.last_seen_at,
                ip_address: (_b = r.ip_address) !== null && _b !== void 0 ? _b : undefined,
                user_agent: (_c = r.user_agent) !== null && _c !== void 0 ? _c : undefined,
                is_open: r.ended_at == null,
            });
        });
    }
    async listStaff(actor, branchId) {
        this.assertStaffManager(actor);
        const effectiveBranchId = actor.role === 'manager' ? actor.branchId : (branchId !== null && branchId !== void 0 ? branchId : actor.branchId);
        const rows = await this.dataSource.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.branch_id,
        u.is_active,
        u.created_at,
        sp.position,
        sp.department,
        sp.employment_type,
        sp.professional_licence_no,
        sp.licence_expiry_date,
        sp.start_date,
        sp.certificate_s3_keys
      FROM users u
      LEFT JOIN staff_profiles sp ON sp.user_id = u.id
      WHERE u.branch_id = $1
        AND u.role != 'se_admin'
      ORDER BY u.name ASC
    `, [effectiveBranchId]);
        return rows.map((r) => {
            var _a;
            return ({
                id: r.id,
                name: r.name,
                email: r.email,
                role: r.role,
                branch_id: r.branch_id,
                is_active: r.is_active,
                position: r.position,
                department: r.department,
                employment_type: r.employment_type,
                professional_licence_no: r.professional_licence_no,
                licence_expiry_date: r.licence_expiry_date,
                start_date: r.start_date,
                certificate_s3_keys: (_a = r.certificate_s3_keys) !== null && _a !== void 0 ? _a : [],
                created_at: r.created_at,
            });
        });
    }
    async getStaffMember(userId, actor) {
        var _a;
        const rows = await this.dataSource.query(`
      SELECT
        u.id, u.name, u.email, u.role, u.branch_id, u.is_active, u.created_at,
        sp.position, sp.department, sp.employment_type,
        sp.professional_licence_no, sp.licence_expiry_date,
        sp.start_date, sp.certificate_s3_keys
      FROM users u
      LEFT JOIN staff_profiles sp ON sp.user_id = u.id
      WHERE u.id = $1
    `, [userId]);
        if (!rows[0])
            throw new common_1.NotFoundException(`Staff member ${userId} not found`);
        const r = rows[0];
        return {
            id: r.id,
            name: r.name,
            email: r.email,
            role: r.role,
            branch_id: r.branch_id,
            is_active: r.is_active,
            position: r.position,
            department: r.department,
            employment_type: r.employment_type,
            professional_licence_no: r.professional_licence_no,
            licence_expiry_date: r.licence_expiry_date,
            start_date: r.start_date,
            certificate_s3_keys: (_a = r.certificate_s3_keys) !== null && _a !== void 0 ? _a : [],
            created_at: r.created_at,
        };
    }
    assertStaffManager(actor) {
        if (!STAFF_MANAGER_ROLES.includes(actor.role)) {
            throw new common_1.ForbiddenException(`Role '${actor.role}' cannot manage staff. Required: ${STAFF_MANAGER_ROLES.join(', ')}`);
        }
    }
};
exports.StaffService = StaffService;
exports.StaffService = StaffService = StaffService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(staff_profile_entity_1.StaffProfile)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource])
], StaffService);
//# sourceMappingURL=staff.service.js.map