import { User } from '../../auth/entities/user.entity';
export declare class StaffProfile {
    id: string;
    user_id: string;
    branch_id: string;
    phone_encrypted?: string;
    address_encrypted?: string;
    date_of_birth_encrypted?: string;
    gender?: string;
    position?: string;
    department?: string;
    employment_type: string;
    start_date?: Date;
    end_date?: Date;
    ghana_card_number_encrypted?: string;
    professional_licence_no?: string;
    licence_expiry_date?: Date;
    certificate_s3_keys: string[];
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    notes?: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    user?: User;
}
