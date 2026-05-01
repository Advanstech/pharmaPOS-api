import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { BranchesResolver } from './branches.resolver';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { User } from './entities/user.entity';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionGuard } from './guards/subscription.guard';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Subscription]),
    NotificationsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  providers: [AuthService, AuthResolver, BranchesResolver, JwtStrategy, JwtAuthGuard, RolesGuard, SubscriptionGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard, SubscriptionGuard, JwtModule, PassportModule, TypeOrmModule],
})
export class AuthModule {}
