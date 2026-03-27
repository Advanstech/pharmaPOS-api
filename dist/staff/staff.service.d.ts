import { Repository, DataSource } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { StaffProfile } from './entities/staff_profile.entity';
import { InviteStaffInput, UpdateStaffProfileInput, ResetStaffPasswordInput, StaffMemberOutput, StaffSessionOutput, InviteStaffResult } from './dto/staff.dto';
import { JwtUser } from '../auth/decorators/current-user.decorator';
export interface StaffSessionHistoryOptions {
    branchId?: string;
    limit?: number;
    offset?: number;
    fromDate?: string;
    toDate?: string;
}
export declare class StaffService {
    private readonly users;
    private readonly profiles;
    private readonly dataSource;
    private readonly logger;
    private readonly encryptionKey;
    constructor(users: Repository<User>, profiles: Repository<StaffProfile>, dataSource: DataSource);
    inviteStaff(input: InviteStaffInput, actor: JwtUser): Promise<InviteStaffResult>;
    updateProfile(input: UpdateStaffProfileInput, actor: JwtUser): Promise<StaffMemberOutput>;
    deactivateStaff(userId: string, actor: JwtUser): Promise<boolean>;
    resetPassword(input: ResetStaffPasswordInput, actor: JwtUser): Promise<boolean>;
    listStaffSessionHistory(actor: JwtUser, options?: StaffSessionHistoryOptions): Promise<StaffSessionOutput[]>;
    listStaff(actor: JwtUser, branchId?: string): Promise<StaffMemberOutput[]>;
    getStaffMember(userId: string, actor: JwtUser): Promise<StaffMemberOutput>;
    private assertStaffManager;
}
