export declare class User {
    id: string;
    branch_id: string;
    name: string;
    email?: string;
    phone?: string;
    role: string;
    password_hash: string;
    mfa_enabled: boolean;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}
