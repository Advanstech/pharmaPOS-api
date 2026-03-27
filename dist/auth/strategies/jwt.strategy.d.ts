import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
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
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithoutRequest] | [opt: import("passport-jwt").StrategyOptionsWithRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly users;
    constructor(config: ConfigService, users: Repository<User>);
    validate(payload: JwtPayload): Promise<JwtUser>;
}
export {};
