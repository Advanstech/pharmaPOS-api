import { StaffService } from './staff.service';
import { InviteStaffInput, UpdateStaffProfileInput, ResetStaffPasswordInput, StaffMemberOutput, StaffSessionOutput, InviteStaffResult } from './dto/staff.dto';
import { JwtUser } from '../auth/decorators/current-user.decorator';
export declare class StaffResolver {
    private readonly staffService;
    constructor(staffService: StaffService);
    listStaff(actor: JwtUser, branchId?: string): Promise<StaffMemberOutput[]>;
    staffSessionHistory(actor: JwtUser, branchId?: string, limit?: number, offset?: number, fromDate?: string, toDate?: string): Promise<StaffSessionOutput[]>;
    staffMember(userId: string, actor: JwtUser): Promise<StaffMemberOutput>;
    inviteStaff(input: InviteStaffInput, actor: JwtUser): Promise<InviteStaffResult>;
    updateStaffProfile(input: UpdateStaffProfileInput, actor: JwtUser): Promise<StaffMemberOutput>;
    deactivateStaff(userId: string, actor: JwtUser): Promise<boolean>;
    resetStaffPassword(input: ResetStaffPasswordInput, actor: JwtUser): Promise<boolean>;
}
