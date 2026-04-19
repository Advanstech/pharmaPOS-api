import { Injectable, UnauthorizedException, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { LoginInput, RegisterInput, AuthPayload } from './dto/auth.types';
import { JwtUser } from './decorators/current-user.decorator';
import { SUBSCRIPTION_TIERS, type SubscriptionTier } from '../config/constants';
import { SubscriptionOverview } from './dto/subscription.types';
import { SalesEffectiveAtService } from '../sales/sales-effective-at.service';
import type { ClientSessionMeta } from './client-session-meta';
import { normalizeRoleForApi } from '../config/roles';

interface BranchRow { id: string; type: 'pharmaceutical' | 'chemical' }
interface SubscriptionRow {
  tier: SubscriptionTier;
  status: string;
  current_period_start: Date;
  current_period_end: Date;
  cancel_at_period_end: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly effectiveSaleAt: SalesEffectiveAtService,
  ) {}

  // ── Login ────────────────────────────────────────────────────────────────

  async login(input: LoginInput, meta?: ClientSessionMeta): Promise<AuthPayload> {
    const user = await this.users.findOne({ where: { email: input.email, is_active: true } });

    if (!user) {
      // Constant-time response to prevent user enumeration
      await bcrypt.compare(input.password, '$2b$10$invalidhashtopreventtiming00000000000000000000000000000');
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(input.password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Fetch branch info for JWT payload
    const branch = await this.dataSource.query(
      `SELECT id, name, type FROM branches WHERE id = $1`,
      [user.branch_id],
    ) as Array<{ id: string; name: string; type: 'pharmaceutical' | 'chemical' }>;

    if (!branch[0]) {
      throw new NotFoundException('Branch not found');
    }

    // Create session record
    const sessionId = await this.createSession(user.id);
    await this.recordStaffSessionStart(user.id, user.branch_id, sessionId, meta);

    return this.buildAuthPayload(user, branch[0].type, sessionId, branch[0].name);
  }

  // ── Register ─────────────────────────────────────────────────────────────

  async register(input: RegisterInput, meta?: ClientSessionMeta): Promise<AuthPayload> {
    // Check email uniqueness
    const existing = await this.users.findOne({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = this.users.create({
      branch_id: input.branch_id,
      name: input.name,
      email: input.email,
      password_hash: passwordHash,
      role: input.role,
      is_active: true,
    });

    const saved = await this.users.save(user);

    const branch = await this.dataSource.query(
      `SELECT id, type FROM branches WHERE id = $1`,
      [input.branch_id],
    ) as BranchRow[];

    if (!branch[0]) {
      throw new NotFoundException('Branch not found');
    }

    const sessionId = await this.createSession(saved.id);
    await this.recordStaffSessionStart(saved.id, saved.branch_id, sessionId, meta);
    return this.buildAuthPayload(saved, branch[0].type, sessionId);
  }

  // ── Refresh token ─────────────────────────────────────────────────────────

  async refreshToken(refreshToken: string, meta?: ClientSessionMeta): Promise<AuthPayload> {
    let payload: { sub: string; sessionId: string; type: string };

    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      }) as typeof payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Verify session still exists
    const sessions = await this.dataSource.query(
      `SELECT id FROM sessions WHERE id = $1 AND user_id = $2 AND expires_at > NOW()`,
      [payload.sessionId, payload.sub],
    ) as Array<{ id: string }>;

    if (!sessions[0]) {
      throw new UnauthorizedException('Session expired — please log in again');
    }

    await this.touchStaffSessionActivity(payload.sessionId, meta);

    const user = await this.users.findOne({ where: { id: payload.sub, is_active: true } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const branch = await this.dataSource.query(
      `SELECT id, type FROM branches WHERE id = $1`,
      [user.branch_id],
    ) as BranchRow[];

    return this.buildAuthPayload(user, branch[0]?.type ?? 'pharmaceutical', payload.sessionId);
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  async logout(currentUser: JwtUser): Promise<boolean> {
    await this.endStaffSession(currentUser.sessionId);
    await this.dataSource.query(
      `DELETE FROM sessions WHERE id = $1`,
      [currentUser.sessionId],
    );
    this.logger.log(`User ${currentUser.sub} logged out`);
    return true;
  }

  // ── Me ────────────────────────────────────────────────────────────────────

  async me(userId: string): Promise<User> {
    const user = await this.users.findOne({ where: { id: userId, is_active: true } });
    if (!user) throw new NotFoundException('User not found');
    return { ...user, role: normalizeRoleForApi(user.role) } as User;
  }

  async getSubscriptionOverview(actor: JwtUser): Promise<SubscriptionOverview> {
    const [org] = await this.dataSource.query(
      `SELECT organization_id FROM branches WHERE id = $1`,
      [actor.branchId],
    ) as Array<{ organization_id: string }>;

    if (!org?.organization_id) {
      throw new NotFoundException('Organization not found for branch');
    }

    const [sub] = await this.dataSource.query(
      `
      SELECT tier, status, current_period_start, current_period_end, cancel_at_period_end
      FROM subscriptions
      WHERE organization_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `,
      [org.organization_id],
    ) as SubscriptionRow[];

    const tier = (sub?.tier ?? 'FREE') as SubscriptionTier;
    const limits = SUBSCRIPTION_TIERS[tier];

    const [usage] = await this.dataSource.query(
      `
      SELECT
        (SELECT COUNT(*)::int FROM branches WHERE organization_id = $1 AND is_active = true) AS branches,
        (SELECT COUNT(*)::int
         FROM users u
         INNER JOIN branches b ON b.id = u.branch_id
         WHERE b.organization_id = $1 AND u.is_active = true) AS users,
        (SELECT COUNT(DISTINCT p.id)::int
         FROM products p
         INNER JOIN inventory i ON i.product_id = p.id
         INNER JOIN branches b ON b.id = i.branch_id
         WHERE b.organization_id = $1 AND p.is_active = true) AS products,
        (SELECT COUNT(*)::int
         FROM sales s
         INNER JOIN branches b ON b.id = s.branch_id
         WHERE b.organization_id = $1
           AND s.status = 'COMPLETED'
           AND (${this.effectiveSaleAt.sql('s')}) >= date_trunc('month', NOW() AT TIME ZONE 'Africa/Accra')) AS sales
    `,
      [org.organization_id],
    ) as Array<{ branches: number; users: number; products: number; sales: number }>;

    const now = new Date();
    const defaultPeriodEnd = new Date(now);
    defaultPeriodEnd.setFullYear(now.getFullYear() + 1);

    return {
      tier,
      status: sub?.status ?? 'ACTIVE',
      currentPeriodStart: sub?.current_period_start ?? now,
      currentPeriodEnd: sub?.current_period_end ?? defaultPeriodEnd,
      cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
      usage: {
        branches: usage?.branches ?? 0,
        users: usage?.users ?? 0,
        products: usage?.products ?? 0,
        sales: usage?.sales ?? 0,
      },
      limits: {
        branches: limits.maxBranches,
        users: limits.maxUsers,
        products: limits.maxProducts,
        sales: limits.maxSalesPerMonth,
      },
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async createSession(userId: string): Promise<string> {
    const result = await this.dataSource.query(`
      INSERT INTO sessions (id, user_id, refresh_token_hash, expires_at)
      VALUES (gen_random_uuid(), $1, 'pending', NOW() + INTERVAL '24 hours')
      RETURNING id
    `, [userId]) as Array<{ id: string }>;

    return result[0].id;
  }

  private async recordStaffSessionStart(
    userId: string,
    branchId: string,
    sessionId: string,
    meta?: ClientSessionMeta,
  ): Promise<void> {
    await this.dataSource.query(
      `
      INSERT INTO staff_sessions (id, user_id, branch_id, session_id, ip_address, user_agent)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
    `,
      [userId, branchId, sessionId, meta?.ip ?? null, meta?.userAgent ?? null],
    );
  }

  /** Updates last_seen_at (and optionally IP/UA) when access token is refreshed. */
  private async touchStaffSessionActivity(sessionId: string, meta?: ClientSessionMeta): Promise<void> {
    await this.dataSource.query(
      `
      UPDATE staff_sessions
      SET
        last_seen_at = NOW(),
        ip_address = COALESCE($2, ip_address),
        user_agent = COALESCE($3, user_agent)
      WHERE session_id = $1 AND ended_at IS NULL
    `,
      [sessionId, meta?.ip ?? null, meta?.userAgent ?? null],
    );
  }

  private async endStaffSession(sessionId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE staff_sessions SET ended_at = NOW() WHERE session_id = $1 AND ended_at IS NULL`,
      [sessionId],
    );
  }

  private buildAuthPayload(
    user: User,
    branchType: 'pharmaceutical' | 'chemical',
    sessionId: string,
    branchName?: string,
  ): AuthPayload {
    const jwtPayload = {
      sub: user.id,
      role: normalizeRoleForApi(user.role),
      branchId: user.branch_id,
      branchType,
      sessionId,
    };

    const accessToken = this.jwt.sign(jwtPayload, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = this.jwt.sign(
      { sub: user.id, sessionId, type: 'refresh' },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '24h',
      },
    );

    const payload = new AuthPayload();
    payload.access_token = accessToken;
    payload.refresh_token = refreshToken;
    payload.expires_in = 900;
    // Attach branch info to user for frontend
    const userWithBranch = { ...user, role: normalizeRoleForApi(user.role) } as any;
    userWithBranch.branch_name = branchName || null;
    userWithBranch.branch_type = branchType;
    payload.user = userWithBranch as User;
    return payload;
  }
}
