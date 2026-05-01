import { Resolver, Mutation, Query, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginInput, RegisterInput, ChangePasswordInput, AuthPayload } from './dto/auth.types';
import { User } from './entities/user.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from './decorators/current-user.decorator';
import { SubscriptionOverview } from './dto/subscription.types';
import { extractClientSessionMeta, type HttpRequestLike } from './client-session-meta';

@ApiTags('auth')
@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthPayload)
  async login(
    @Args('input') input: LoginInput,
    @Context() ctx: { req?: HttpRequestLike },
  ): Promise<AuthPayload> {
    return this.authService.login(input, extractClientSessionMeta(ctx.req));
  }

  @Mutation(() => AuthPayload)
  async register(
    @Args('input') input: RegisterInput,
    @Context() ctx: { req?: HttpRequestLike },
  ): Promise<AuthPayload> {
    return this.authService.register(input, extractClientSessionMeta(ctx.req));
  }

  @Mutation(() => AuthPayload)
  async refreshToken(
    @Args('token') token: string,
    @Context() ctx: { req?: HttpRequestLike },
  ): Promise<AuthPayload> {
    return this.authService.refreshToken(token, extractClientSessionMeta(ctx.req));
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  async changePassword(
    @Args('input') input: ChangePasswordInput,
    @CurrentUser() user: JwtUser,
  ): Promise<boolean> {
    return this.authService.changePassword(user, input.currentPassword, input.newPassword);
  }

  @Mutation(() => Boolean)
  async requestPasswordReset(@Args('email') email: string): Promise<boolean> {
    return this.authService.requestPasswordReset(email);
  }

  @Mutation(() => Boolean)
  async resetPasswordWithToken(
    @Args('token') token: string,
    @Args('newPassword') newPassword: string,
  ): Promise<boolean> {
    return this.authService.resetPasswordWithToken(token, newPassword);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  async logout(@CurrentUser() user: JwtUser): Promise<boolean> {
    return this.authService.logout(user);
  }

  @Query(() => User)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  async me(@CurrentUser() user: JwtUser): Promise<User> {
    return this.authService.me(user.sub);
  }

  @Query(() => SubscriptionOverview)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  async subscriptionOverview(@CurrentUser() user: JwtUser): Promise<SubscriptionOverview> {
    return this.authService.getSubscriptionOverview(user);
  }
}
