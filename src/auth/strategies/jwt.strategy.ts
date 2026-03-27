import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { JwtUser } from '../decorators/current-user.decorator';

interface JwtPayload {
  sub: string;
  role: string;
  branchId: string;
  branchType: 'pharmaceutical' | 'chemical';
  sessionId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    const user = await this.users.findOne({
      where: { id: payload.sub, is_active: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Prefer live DB values so role/branch changes apply without forcing re-login; JWT stays the session key.
    return {
      sub: payload.sub,
      role: user.role,
      branchId: user.branch_id,
      branchType: payload.branchType,
      sessionId: payload.sessionId,
    };
  }
}
