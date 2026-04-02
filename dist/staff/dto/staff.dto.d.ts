export declare enum EmploymentType {
    FULL_TIME = "full_time",
    PART_TIME = "part_time",
    CONTRACT = "contract"
}
export declare enum Gender {
    MALE = "male",
    FEMALE = "female",
    OTHER = "other",
    PREFER_NOT_TO_SAY = "prefer_not_to_say"
}
export declare class InviteStaffInput {
    name: string;
    email?: string;
    phone?: string;
    role: string;
    position?: string;
    department?: string;
    employment_type?: EmploymentType;
}
export declare class UpdateStaffProfileInput {
    userId: string;
    position?: string;
    department?: string;
    employment_type?: EmploymentType;
    gender?: Gender;
    start_date?: string;
    end_date?: string;
    professional_licence_no?: string;
    licence_expiry_date?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    notes?: string;
    photo_url?: string;
    salary_amount_pesewas?: number;
    salary_period?: string;
    bank_name?: string;
    phone?: string;
    address?: string;
    date_of_birth?: string;
    ghana_card_number?: string;
}
export declare class ResetStaffPasswordInput {
    userId: string;
    newPassword: string;
}
export declare class StaffMemberOutput {
    id: string;
    name: string;
    email?: string;
    role: string;
    branch_id: string;
    is_active: boolean;
    position?: string;
    department?: string;
    employment_type?: string;
    professional_licence_no?: string;
    licence_expiry_date?: Date;
    start_date?: Date;
    photo_url?: string;
    certificate_s3_keys: string[];
    salary_amount_pesewas?: number;
    salary_period?: string;
    bank_name?: string;
    is_on_duty: boolean;
    created_at: Date;
}
export declare class StaffSessionOutput {
    id: string;
    user_id: string;
    user_name: string;
    user_role: string;
    branch_id: string;
    branch_name: string;
    session_id: string;
    started_at: Date;
    ended_at?: Date;
    last_seen_at: Date;
    ip_address?: string;
    user_agent?: string;
    is_open: boolean;
}
export declare class InviteStaffResult {
    userId: string;
    name: string;
    email?: string;
    role: string;
    temporaryPassword: string;
    emailSent: boolean;
    message: string;
}
