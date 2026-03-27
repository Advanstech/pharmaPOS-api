import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository, DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { LoginInput, RegisterInput, AuthPayload } from './dto/auth.types';
import { JwtUser } from './decorators/current-user.decorator';
import { SubscriptionOverview } from './dto/subscription.types';
import { SalesEffectiveAtService } from '../sales/sales-effective-at.service';
import type { ClientSessionMeta } from './client-session-meta';
export declare class AuthService {
    private readonly users;
    private readonly jwt;
    private readonly config;
    private readonly dataSource;
    private readonly effectiveSaleAt;
    private readonly logger;
    constructor(users: Repository<User>, jwt: JwtService, config: ConfigService, dataSource: DataSource, effectiveSaleAt: SalesEffectiveAtService);
    login(input: LoginInput, meta?: ClientSessionMeta): Promise<AuthPayload>;
    register(input: RegisterInput, meta?: ClientSessionMeta): Promise<AuthPayload>;
    refreshToken(refreshToken: string, meta?: ClientSessionMeta): Promise<AuthPayload>;
    logout(currentUser: JwtUser): Promise<boolean>;
    me(userId: string): Promise<User>;
    getSubscriptionOverview(actor: JwtUser): Promise<SubscriptionOverview>;
    private createSession;
    private recordStaffSessionStart;
    private touchStaffSessionActivity;
    private endStaffSession;
    private buildAuthPayload;
}
