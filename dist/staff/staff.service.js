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
const notifications_service_1 = require("../notifications/notifications.service");
const email_templates_1 = require("../notifications/email-templates");
const config_1 = require("@nestjs/config");
const roles_1 = require("../config/roles");
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
    constructor(users, profiles, dataSource, notifications, config) {
        this.users = users;
        this.profiles = profiles;
        this.dataSource = dataSource;
        this.notifications = notifications;
        this.config = config;
        this.logger = new common_1.Logger(StaffService_1.name);
        const raw = process.env.PII_ENCRYPTION_KEY;
        if (!raw || raw.length !== 64) {
            throw new Error('PII_ENCRYPTION_KEY must be set to exactly 64 hex characters (32 bytes). ' +
                'Generate with: python3 -c "import secrets; print(secrets.token_hex(32))"');
        }
        this.encryptionKey = Buffer.from(raw, 'hex');
    }
    async inviteStaff(input, actor) {
        var _a;
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
        let emailSent = false;
        if (input.email) {
            try {
                const [branchRow] = await this.dataSource.query(`SELECT name FROM branches WHERE id = $1`, [targetBranchId]);
                const branchName = (branchRow === null || branchRow === void 0 ? void 0 : branchRow.name) || 'PharmaPOS Branch';
                const invitedByName = actor.role === 'owner'
                    ? 'Branch Owner'
                    : actor.role === 'se_admin'
                        ? 'System Administrator'
                        : actor.role === 'manager'
                            ? 'Branch Manager'
                            : 'System Administrator';
                const template = email_templates_1.EmailTemplates.staffInvitation(input.name, input.email, tempPassword, invitedByName, branchName);
                await this.notifications.sendEmail({
                    to: input.email,
                    subject: template.subject,
                    html: template.html,
                });
                emailSent = true;
                this.logger.log(`Invitation email sent to ${input.email}`);
            }
            catch (error) {
                this.logger.error(`Failed to send invitation email to ${input.email}:`, error);
            }
        }
        const message = input.email
            ? emailSent
                ? 'Staff member invited. Check their email for login details.'
                : 'Staff member invited, but email delivery failed. Share the temporary password securely.'
            : 'Staff member invited. Share the temporary password securely — it must be changed on first login.';
        return {
            userId,
            name: input.name,
            email: (_a = input.email) !== null && _a !== void 0 ? _a : undefined,
            role: (0, roles_1.normalizeRoleForApi)(input.role),
            temporaryPassword: tempPassword,
            emailSent,
            message,
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
        if (input.photo_url !== undefined)
            updates.photo_url = input.photo_url;
        if (input.notes !== undefined && isManager)
            updates.notes = input.notes;
        if (isManager) {
            if (input.salary_amount_pesewas !== undefined)
                updates.salary_amount_pesewas = input.salary_amount_pesewas;
            if (input.salary_period !== undefined)
                updates.salary_period = input.salary_period;
            if (input.bank_name !== undefined)
                updates.bank_name = input.bank_name;
        }
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
                user_role: (0, roles_1.normalizeRoleForApi)(r.user_role),
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
        let effectiveBranchId;
        if (actor.role === 'manager') {
            effectiveBranchId = actor.branchId;
        }
        else if (branchId) {
            const [b] = await this.dataSource.query(`
        SELECT b.id
        FROM branches b
        INNER JOIN branches actor_branch ON actor_branch.id = $2
        WHERE b.id = $1 AND b.organization_id = actor_branch.organization_id
      `, [branchId, actor.branchId]);
            if (!b) {
                throw new common_1.ForbiddenException('Branch is not in your organization');
            }
            effectiveBranchId = branchId;
        }
        else {
            effectiveBranchId = actor.branchId;
        }
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
        sp.photo_url,
        sp.certificate_s3_keys,
        sp.salary_amount_pesewas,
        sp.salary_period,
        sp.bank_name,
        EXISTS (
          SELECT 1 FROM staff_sessions ss
          WHERE ss.user_id = u.id AND ss.ended_at IS NULL
        ) AS is_on_duty
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
                role: (0, roles_1.normalizeRoleForApi)(r.role),
                branch_id: r.branch_id,
                is_active: r.is_active,
                position: r.position,
                department: r.department,
                employment_type: r.employment_type,
                professional_licence_no: r.professional_licence_no,
                licence_expiry_date: r.licence_expiry_date,
                start_date: r.start_date,
                photo_url: r.photo_url,
                certificate_s3_keys: (_a = r.certificate_s3_keys) !== null && _a !== void 0 ? _a : [],
                salary_amount_pesewas: r.salary_amount_pesewas,
                salary_period: r.salary_period,
                bank_name: r.bank_name,
                is_on_duty: r.is_on_duty,
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
        sp.start_date, sp.photo_url, sp.certificate_s3_keys,
        sp.salary_amount_pesewas, sp.salary_period, sp.bank_name,
        EXISTS (
          SELECT 1 FROM staff_sessions ss
          WHERE ss.user_id = u.id AND ss.ended_at IS NULL
        ) AS is_on_duty
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
            role: (0, roles_1.normalizeRoleForApi)(r.role),
            branch_id: r.branch_id,
            is_active: r.is_active,
            position: r.position,
            department: r.department,
            employment_type: r.employment_type,
            professional_licence_no: r.professional_licence_no,
            licence_expiry_date: r.licence_expiry_date,
            start_date: r.start_date,
            photo_url: r.photo_url,
            certificate_s3_keys: (_a = r.certificate_s3_keys) !== null && _a !== void 0 ? _a : [],
            salary_amount_pesewas: r.salary_amount_pesewas,
            salary_period: r.salary_period,
            bank_name: r.bank_name,
            is_on_duty: r.is_on_duty,
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
        typeorm_2.DataSource,
        notifications_service_1.NotificationsService,
        config_1.ConfigService])
], StaffService);
//# sourceMappingURL=staff.service.js.map