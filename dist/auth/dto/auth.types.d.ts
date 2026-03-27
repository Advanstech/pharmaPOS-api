import { User } from '../entities/user.entity';
export declare class LoginInput {
    email: string;
    password: string;
}
export declare class RegisterInput {
    branch_id: string;
    name: string;
    email: string;
    password: string;
    role: string;
}
export declare class AuthPayload {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: User;
}
