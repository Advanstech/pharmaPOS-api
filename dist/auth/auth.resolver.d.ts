import { AuthService } from './auth.service';
import { LoginInput, RegisterInput, AuthPayload } from './dto/auth.types';
import { User } from './entities/user.entity';
import { JwtUser } from './decorators/current-user.decorator';
import { SubscriptionOverview } from './dto/subscription.types';
import { type HttpRequestLike } from './client-session-meta';
export declare class AuthResolver {
    private readonly authService;
    constructor(authService: AuthService);
    login(input: LoginInput, ctx: {
        req?: HttpRequestLike;
    }): Promise<AuthPayload>;
    register(input: RegisterInput, ctx: {
        req?: HttpRequestLike;
    }): Promise<AuthPayload>;
    refreshToken(token: string, ctx: {
        req?: HttpRequestLike;
    }): Promise<AuthPayload>;
    logout(user: JwtUser): Promise<boolean>;
    me(user: JwtUser): Promise<User>;
    subscriptionOverview(user: JwtUser): Promise<SubscriptionOverview>;
}
