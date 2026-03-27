import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../auth/entities/user.entity';
import { StaffProfile } from './entities/staff_profile.entity';
import {
  InviteStaffInput,
  UpdateStaffProfileInput,
  ResetStaffPasswordInput,
  StaffMemberOutput,
  StaffSessionOutput,
  InviteStaffResult,
} from './dto/staff.dto';
import { JwtUser } from '../auth/decorators/current-user.decorator';

// RBAC: roles that can manage staff
const STAFF_MANAGER_ROLES = ['owner', 'se_admin', 'manager'] as const;

export interface StaffSessionHistoryOptions {
  branchId?: string;
  limit?: number;
  offset?: number;
  /** Inclusive Accra calendar date (YYYY-MM-DD). Defaults to 14 days ago. */
  fromDate?: string;
  /** Inclusive Accra calendar date (YYYY-MM-DD). Defaults to today Accra. */
  toDate?: string;
}

// AES-256-GCM helpers for PII (Ghana Data Protection Act 2012)
// Key is validated in the constructor — fail fast at startup, not at module load time
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

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);
  private readonly encryptionKey: Buffer;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(StaffProfile) private readonly profiles: Repository<StaffProfile>,
    private readonly dataSource: DataSource,
  ) {
    // Fail fast at startup — never silently use a weak or missing key
    const raw = process.env.PII_ENCRYPTION_KEY;
    if (!raw || raw.length !== 64) {
      throw new Error(
        'PII_ENCRYPTION_KEY must be set to exactly 64 hex characters (32 bytes). ' +
        'Generate with: python3 -c "import secrets; print(secrets.token_hex(32))"',
      );
    }
    this.encryptionKey = Buffer.from(raw, 'hex');
  }

  // ── Invite staff ──────────────────────────────────────────────────────────

  /**
   * Invite a new staff member — creates user + staff_profile.
   * RBAC: owner, se_admin, manager only.
   * Returns a temporary password that must be changed on first login.
   */
  async inviteStaff(input: InviteStaffInput, actor: JwtUser): Promise<InviteStaffResult> {
    // RBAC: owner, se_admin, manager only
    this.assertStaffManager(actor);

    // Managers can only invite to their own branch
    const targetBranchId = actor.branchId;

    if (input.email) {
      const existing = await this.users.findOne({ where: { email: input.email } });
      if (existing) throw new ConflictException(`Email ${input.email} already in use`);
    }

    const tempPassword = crypto.randomBytes(8).toString('hex'); // 16-char hex
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const userId = await this.dataSource.transaction(async (em) => {
      const [userRow] = await em.query(`
        INSERT INTO users (id, branch_id, name, email, phone, role, password_hash, is_active)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, true)
        RETURNING id
      `, [
        targetBranchId,
        input.name,
        input.email ?? null,
        input.phone ?? null,
        input.role,
        passwordHash,
      ]) as Array<{ id: string }>;

      await em.query(`
        INSERT INTO staff_profiles (id, user_id, branch_id, position, department, employment_type)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
      `, [
        userRow.id,
        targetBranchId,
        input.position ?? null,
        input.department ?? null,
        input.employment_type ?? 'full_time',
      ]);

      // Audit log — no PHI (use user_id, not name/email)
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

  // ── Update profile ────────────────────────────────────────────────────────

  /**
   * Update staff profile HR data.
   * RBAC: owner, se_admin, manager — or the staff member updating their own non-sensitive fields.
   */
  async updateProfile(input: UpdateStaffProfileInput, actor: JwtUser): Promise<StaffMemberOutput> {
    const isSelf = actor.sub === input.userId;
    const isManager = (STAFF_MANAGER_ROLES as readonly string[]).includes(actor.role);

    if (!isSelf && !isManager) {
      throw new ForbiddenException('You can only update your own profile');
    }

    const profile = await this.profiles.findOne({ where: { user_id: input.userId } });
    if (!profile) throw new NotFoundException(`Staff profile not found for user ${input.userId}`);

    // Build update fields
    const updates: Record<string, unknown> = {};

    if (input.position !== undefined) updates.position = input.position;
    if (input.department !== undefined) updates.department = input.department;
    if (input.employment_type !== undefined) updates.employment_type = input.employment_type;
    if (input.gender !== undefined) updates.gender = input.gender;
    if (input.start_date !== undefined) updates.start_date = input.start_date;
    if (input.end_date !== undefined) updates.end_date = input.end_date;
    if (input.professional_licence_no !== undefined) updates.professional_licence_no = input.professional_licence_no;
    if (input.licence_expiry_date !== undefined) updates.licence_expiry_date = input.licence_expiry_date;
    if (input.emergency_contact_name !== undefined) updates.emergency_contact_name = input.emergency_contact_name;
    if (input.emergency_contact_phone !== undefined) updates.emergency_contact_phone = input.emergency_contact_phone;

    // RBAC: notes only for managers
    if (input.notes !== undefined && isManager) updates.notes = input.notes;

    // PII — encrypt before storing (Ghana Data Protection Act 2012)
    if (input.phone !== undefined) updates.phone_encrypted = encryptPii(this.encryptionKey, input.phone);
    if (input.address !== undefined) updates.address_encrypted = encryptPii(this.encryptionKey, input.address);
    if (input.date_of_birth !== undefined) updates.date_of_birth_encrypted = encryptPii(this.encryptionKey, input.date_of_birth);
    if (input.ghana_card_number !== undefined) updates.ghana_card_number_encrypted = encryptPii(this.encryptionKey, input.ghana_card_number);

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date();
      await this.profiles.update({ user_id: input.userId }, updates);
    }

    this.logger.log(`Staff profile updated: user=${input.userId} by actor=${actor.sub}`);
    return this.getStaffMember(input.userId, actor);
  }

  // ── Deactivate staff ──────────────────────────────────────────────────────

  /**
   * Soft-deactivate a staff member.
   * RBAC: owner, se_admin, manager only.
   */
  async deactivateStaff(userId: string, actor: JwtUser): Promise<boolean> {
    this.assertStaffManager(actor);

    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    // Prevent self-deactivation
    if (userId === actor.sub) throw new ForbiddenException('Cannot deactivate your own account');

    await this.dataSource.transaction(async (em) => {
      await em.update(User, { id: userId }, { is_active: false });
      await em.update(StaffProfile, { user_id: userId }, { is_active: false });

      await em.query(
        `UPDATE staff_sessions SET ended_at = NOW() WHERE user_id = $1 AND ended_at IS NULL`,
        [userId],
      );
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

  // ── Reset password ────────────────────────────────────────────────────────

  /**
   * Reset a staff member's password.
   * RBAC: owner, se_admin, manager only.
   * Never touches the actor's own password — use auth mutation for that.
   */
  async resetPassword(input: ResetStaffPasswordInput, actor: JwtUser): Promise<boolean> {
    this.assertStaffManager(actor);

    const user = await this.users.findOne({ where: { id: input.userId } });
    if (!user) throw new NotFoundException(`User ${input.userId} not found`);

    const newHash = await bcrypt.hash(input.newPassword, 12);

    await this.dataSource.transaction(async (em) => {
      await em.update(User, { id: input.userId }, { password_hash: newHash });
      await em.query(
        `UPDATE staff_sessions SET ended_at = NOW() WHERE user_id = $1 AND ended_at IS NULL`,
        [input.userId],
      );
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

  // ── Staff session history (login / refresh / logout) ─────────────────────

  /**
   * Login and token-refresh history for oversight.
   * RBAC: manager — own branch only. Owner / se_admin — all org branches, or one branch when `branchId` is set.
   */
  async listStaffSessionHistory(
    actor: JwtUser,
    options: StaffSessionHistoryOptions = {},
  ): Promise<StaffSessionOutput[]> {
    this.assertStaffManager(actor);

    const [orgRow] = await this.dataSource.query(
      `SELECT organization_id FROM branches WHERE id = $1`,
      [actor.branchId],
    ) as Array<{ organization_id: string }>;
    if (!orgRow?.organization_id) {
      throw new NotFoundException('Branch not found');
    }

    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);

    const params: unknown[] = [];
    let branchClause: string;

    if (actor.role === 'manager') {
      params.push(actor.branchId);
      branchClause = `ss.branch_id = $1`;
    } else if (options.branchId) {
      const [b] = await this.dataSource.query(
        `SELECT id FROM branches WHERE id = $1 AND organization_id = $2`,
        [options.branchId, orgRow.organization_id],
      ) as Array<{ id: string }>;
      if (!b) {
        throw new ForbiddenException('Branch is not in your organization');
      }
      params.push(options.branchId);
      branchClause = `ss.branch_id = $1`;
    } else {
      params.push(orgRow.organization_id);
      branchClause = `ss.branch_id IN (SELECT id FROM branches WHERE organization_id = $1)`;
    }

    params.push(options.fromDate ?? null, options.toDate ?? null, limit, offset);
    const iFrom = 2;
    const iTo = 3;
    const iLim = 4;
    const iOff = 5;

    const rows = await this.dataSource.query(
      `
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
    `,
      params,
    ) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      id: r.id as string,
      user_id: r.user_id as string,
      user_name: r.user_name as string,
      user_role: r.user_role as string,
      branch_id: r.branch_id as string,
      branch_name: r.branch_name as string,
      session_id: r.session_id as string,
      started_at: r.started_at as Date,
      ended_at: (r.ended_at as Date | null) ?? undefined,
      last_seen_at: r.last_seen_at as Date,
      ip_address: (r.ip_address as string | null) ?? undefined,
      user_agent: (r.user_agent as string | null) ?? undefined,
      is_open: r.ended_at == null,
    }));
  }

  // ── List staff ────────────────────────────────────────────────────────────

  /**
   * List staff members.
   * RBAC: manager sees own branch; owner/se_admin see all branches.
   */
  async listStaff(actor: JwtUser, branchId?: string): Promise<StaffMemberOutput[]> {
    this.assertStaffManager(actor);

    // Managers are scoped to their own branch
    const effectiveBranchId =
      actor.role === 'manager' ? actor.branchId : (branchId ?? actor.branchId);

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
    `, [effectiveBranchId]) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      email: r.email as string | undefined,
      role: r.role as string,
      branch_id: r.branch_id as string,
      is_active: r.is_active as boolean,
      position: r.position as string | undefined,
      department: r.department as string | undefined,
      employment_type: r.employment_type as string | undefined,
      professional_licence_no: r.professional_licence_no as string | undefined,
      licence_expiry_date: r.licence_expiry_date as Date | undefined,
      start_date: r.start_date as Date | undefined,
      certificate_s3_keys: (r.certificate_s3_keys as string[]) ?? [],
      created_at: r.created_at as Date,
    }));
  }

  // ── Get single staff member ───────────────────────────────────────────────

  async getStaffMember(userId: string, actor: JwtUser): Promise<StaffMemberOutput> {
    const rows = await this.dataSource.query(`
      SELECT
        u.id, u.name, u.email, u.role, u.branch_id, u.is_active, u.created_at,
        sp.position, sp.department, sp.employment_type,
        sp.professional_licence_no, sp.licence_expiry_date,
        sp.start_date, sp.certificate_s3_keys
      FROM users u
      LEFT JOIN staff_profiles sp ON sp.user_id = u.id
      WHERE u.id = $1
    `, [userId]) as Array<Record<string, unknown>>;

    if (!rows[0]) throw new NotFoundException(`Staff member ${userId} not found`);
    const r = rows[0];

    return {
      id: r.id as string,
      name: r.name as string,
      email: r.email as string | undefined,
      role: r.role as string,
      branch_id: r.branch_id as string,
      is_active: r.is_active as boolean,
      position: r.position as string | undefined,
      department: r.department as string | undefined,
      employment_type: r.employment_type as string | undefined,
      professional_licence_no: r.professional_licence_no as string | undefined,
      licence_expiry_date: r.licence_expiry_date as Date | undefined,
      start_date: r.start_date as Date | undefined,
      certificate_s3_keys: (r.certificate_s3_keys as string[]) ?? [],
      created_at: r.created_at as Date,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private assertStaffManager(actor: JwtUser): void {
    // RBAC: owner, se_admin, manager only — cashiers/pharmacists cannot manage staff
    if (!(STAFF_MANAGER_ROLES as readonly string[]).includes(actor.role)) {
      throw new ForbiddenException(
        `Role '${actor.role}' cannot manage staff. Required: ${STAFF_MANAGER_ROLES.join(', ')}`,
      );
    }
  }
}
