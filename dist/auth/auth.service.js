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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bcrypt = require("bcrypt");
const user_entity_1 = require("./entities/user.entity");
const auth_types_1 = require("./dto/auth.types");
const constants_1 = require("../config/constants");
const sales_effective_at_service_1 = require("../sales/sales-effective-at.service");
let AuthService = AuthService_1 = class AuthService {
    constructor(users, jwt, config, dataSource, effectiveSaleAt) {
        this.users = users;
        this.jwt = jwt;
        this.config = config;
        this.dataSource = dataSource;
        this.effectiveSaleAt = effectiveSaleAt;
        this.logger = new common_1.Logger(AuthService_1.name);
    }
    async login(input, meta) {
        const user = await this.users.findOne({ where: { email: input.email, is_active: true } });
        if (!user) {
            await bcrypt.compare(input.password, '$2b$10$invalidhashtopreventtiming00000000000000000000000000000');
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const valid = await bcrypt.compare(input.password, user.password_hash);
        if (!valid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const branch = await this.dataSource.query(`SELECT id, type FROM branches WHERE id = $1`, [user.branch_id]);
        if (!branch[0]) {
            throw new common_1.NotFoundException('Branch not found');
        }
        const sessionId = await this.createSession(user.id);
        await this.recordStaffSessionStart(user.id, user.branch_id, sessionId, meta);
        return this.buildAuthPayload(user, branch[0].type, sessionId);
    }
    async register(input, meta) {
        const existing = await this.users.findOne({ where: { email: input.email } });
        if (existing) {
            throw new common_1.ConflictException('Email already registered');
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
        const branch = await this.dataSource.query(`SELECT id, type FROM branches WHERE id = $1`, [input.branch_id]);
        if (!branch[0]) {
            throw new common_1.NotFoundException('Branch not found');
        }
        const sessionId = await this.createSession(saved.id);
        await this.recordStaffSessionStart(saved.id, saved.branch_id, sessionId, meta);
        return this.buildAuthPayload(saved, branch[0].type, sessionId);
    }
    async refreshToken(refreshToken, meta) {
        var _a, _b;
        let payload;
        try {
            payload = this.jwt.verify(refreshToken, {
                secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
            });
        }
        catch (_c) {
            throw new common_1.UnauthorizedException('Invalid or expired refresh token');
        }
        if (payload.type !== 'refresh') {
            throw new common_1.UnauthorizedException('Invalid token type');
        }
        const sessions = await this.dataSource.query(`SELECT id FROM sessions WHERE id = $1 AND user_id = $2 AND expires_at > NOW()`, [payload.sessionId, payload.sub]);
        if (!sessions[0]) {
            throw new common_1.UnauthorizedException('Session expired — please log in again');
        }
        await this.touchStaffSessionActivity(payload.sessionId, meta);
        const user = await this.users.findOne({ where: { id: payload.sub, is_active: true } });
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        const branch = await this.dataSource.query(`SELECT id, type FROM branches WHERE id = $1`, [user.branch_id]);
        return this.buildAuthPayload(user, (_b = (_a = branch[0]) === null || _a === void 0 ? void 0 : _a.type) !== null && _b !== void 0 ? _b : 'pharmaceutical', payload.sessionId);
    }
    async logout(currentUser) {
        await this.endStaffSession(currentUser.sessionId);
        await this.dataSource.query(`DELETE FROM sessions WHERE id = $1`, [currentUser.sessionId]);
        this.logger.log(`User ${currentUser.sub} logged out`);
        return true;
    }
    async me(userId) {
        const user = await this.users.findOne({ where: { id: userId, is_active: true } });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    async getSubscriptionOverview(actor) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const [org] = await this.dataSource.query(`SELECT organization_id FROM branches WHERE id = $1`, [actor.branchId]);
        if (!(org === null || org === void 0 ? void 0 : org.organization_id)) {
            throw new common_1.NotFoundException('Organization not found for branch');
        }
        const [sub] = await this.dataSource.query(`
      SELECT tier, status, current_period_start, current_period_end, cancel_at_period_end
      FROM subscriptions
      WHERE organization_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `, [org.organization_id]);
        const tier = ((_a = sub === null || sub === void 0 ? void 0 : sub.tier) !== null && _a !== void 0 ? _a : 'FREE');
        const limits = constants_1.SUBSCRIPTION_TIERS[tier];
        const [usage] = await this.dataSource.query(`
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
    `, [org.organization_id]);
        const now = new Date();
        const defaultPeriodEnd = new Date(now);
        defaultPeriodEnd.setFullYear(now.getFullYear() + 1);
        return {
            tier,
            status: (_b = sub === null || sub === void 0 ? void 0 : sub.status) !== null && _b !== void 0 ? _b : 'ACTIVE',
            currentPeriodStart: (_c = sub === null || sub === void 0 ? void 0 : sub.current_period_start) !== null && _c !== void 0 ? _c : now,
            currentPeriodEnd: (_d = sub === null || sub === void 0 ? void 0 : sub.current_period_end) !== null && _d !== void 0 ? _d : defaultPeriodEnd,
            cancelAtPeriodEnd: (_e = sub === null || sub === void 0 ? void 0 : sub.cancel_at_period_end) !== null && _e !== void 0 ? _e : false,
            usage: {
                branches: (_f = usage === null || usage === void 0 ? void 0 : usage.branches) !== null && _f !== void 0 ? _f : 0,
                users: (_g = usage === null || usage === void 0 ? void 0 : usage.users) !== null && _g !== void 0 ? _g : 0,
                products: (_h = usage === null || usage === void 0 ? void 0 : usage.products) !== null && _h !== void 0 ? _h : 0,
                sales: (_j = usage === null || usage === void 0 ? void 0 : usage.sales) !== null && _j !== void 0 ? _j : 0,
            },
            limits: {
                branches: limits.maxBranches,
                users: limits.maxUsers,
                products: limits.maxProducts,
                sales: limits.maxSalesPerMonth,
            },
        };
    }
    async createSession(userId) {
        const result = await this.dataSource.query(`
      INSERT INTO sessions (id, user_id, refresh_token_hash, expires_at)
      VALUES (gen_random_uuid(), $1, 'pending', NOW() + INTERVAL '30 days')
      RETURNING id
    `, [userId]);
        return result[0].id;
    }
    async recordStaffSessionStart(userId, branchId, sessionId, meta) {
        var _a, _b;
        await this.dataSource.query(`
      INSERT INTO staff_sessions (id, user_id, branch_id, session_id, ip_address, user_agent)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
    `, [userId, branchId, sessionId, (_a = meta === null || meta === void 0 ? void 0 : meta.ip) !== null && _a !== void 0 ? _a : null, (_b = meta === null || meta === void 0 ? void 0 : meta.userAgent) !== null && _b !== void 0 ? _b : null]);
    }
    async touchStaffSessionActivity(sessionId, meta) {
        var _a, _b;
        await this.dataSource.query(`
      UPDATE staff_sessions
      SET
        last_seen_at = NOW(),
        ip_address = COALESCE($2, ip_address),
        user_agent = COALESCE($3, user_agent)
      WHERE session_id = $1 AND ended_at IS NULL
    `, [sessionId, (_a = meta === null || meta === void 0 ? void 0 : meta.ip) !== null && _a !== void 0 ? _a : null, (_b = meta === null || meta === void 0 ? void 0 : meta.userAgent) !== null && _b !== void 0 ? _b : null]);
    }
    async endStaffSession(sessionId) {
        await this.dataSource.query(`UPDATE staff_sessions SET ended_at = NOW() WHERE session_id = $1 AND ended_at IS NULL`, [sessionId]);
    }
    buildAuthPayload(user, branchType, sessionId) {
        const jwtPayload = {
            sub: user.id,
            role: user.role,
            branchId: user.branch_id,
            branchType,
            sessionId,
        };
        const accessToken = this.jwt.sign(jwtPayload, {
            secret: this.config.getOrThrow('JWT_SECRET'),
            expiresIn: '15m',
        });
        const refreshToken = this.jwt.sign({ sub: user.id, sessionId, type: 'refresh' }, {
            secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
            expiresIn: '30d',
        });
        const payload = new auth_types_1.AuthPayload();
        payload.access_token = accessToken;
        payload.refresh_token = refreshToken;
        payload.expires_in = 900;
        payload.user = user;
        return payload;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        jwt_1.JwtService,
        config_1.ConfigService,
        typeorm_2.DataSource,
        sales_effective_at_service_1.SalesEffectiveAtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map