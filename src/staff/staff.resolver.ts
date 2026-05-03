import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { StaffService } from './staff.service';
import {
  InviteStaffInput,
  UpdateStaffProfileInput,
  ResetStaffPasswordInput,
  StaffMemberOutput,
  StaffSessionOutput,
  InviteStaffResult,
  GeneratedPasswordResult,
} from './dto/staff.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffResolver {
  constructor(private readonly staffService: StaffService) {}

  // ── Queries ───────────────────────────────────────────────────────────────

  // RBAC: owner, se_admin, manager only
  @Query(() => [StaffMemberOutput], { name: 'listStaff' })
  @Roles('owner', 'se_admin', 'manager')
  listStaff(
    @CurrentUser() actor: JwtUser,
    @Args('branchId', { type: () => ID, nullable: true }) branchId?: string,
  ): Promise<StaffMemberOutput[]> {
    return this.staffService.listStaff(actor, branchId);
  }

  /** Sign-in and refresh activity. Manager: own branch. Owner / se_admin: whole org or one branch. */
  @Query(() => [StaffSessionOutput], { name: 'staffSessionHistory' })
  @Roles('owner', 'se_admin', 'manager')
  staffSessionHistory(
    @CurrentUser() actor: JwtUser,
    @Args('branchId', { type: () => ID, nullable: true }) branchId?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
    @Args('fromDate', { type: () => String, nullable: true, description: 'YYYY-MM-DD (Accra calendar day)' })
    fromDate?: string,
    @Args('toDate', { type: () => String, nullable: true, description: 'YYYY-MM-DD (Accra calendar day)' })
    toDate?: string,
  ): Promise<StaffSessionOutput[]> {
    return this.staffService.listStaffSessionHistory(actor, {
      branchId,
      limit,
      offset,
      fromDate,
      toDate,
    });
  }

  // RBAC: owner, se_admin, manager — or self
  @Query(() => StaffMemberOutput, { name: 'staffMember' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician', 'cashier', 'chemical_cashier')
  staffMember(
    @Args('userId', { type: () => ID }) userId: string,
    @CurrentUser() actor: JwtUser,
  ): Promise<StaffMemberOutput> {
    return this.staffService.getStaffMember(userId, actor);
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  // RBAC: owner, se_admin, manager only
  @Mutation(() => InviteStaffResult, { name: 'inviteStaff' })
  @Roles('owner', 'se_admin', 'manager')
  inviteStaff(
    @Args('input') input: InviteStaffInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<InviteStaffResult> {
    return this.staffService.inviteStaff(input, actor);
  }

  // RBAC: manager+ or self
  @Mutation(() => StaffMemberOutput, { name: 'updateStaffProfile' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician', 'cashier', 'chemical_cashier')
  updateStaffProfile(
    @Args('input') input: UpdateStaffProfileInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<StaffMemberOutput> {
    return this.staffService.updateProfile(input, actor);
  }

  // RBAC: owner, se_admin, manager only
  @Mutation(() => Boolean, { name: 'deactivateStaff' })
  @Roles('owner', 'se_admin', 'manager')
  deactivateStaff(
    @Args('userId', { type: () => ID }) userId: string,
    @CurrentUser() actor: JwtUser,
  ): Promise<boolean> {
    return this.staffService.deactivateStaff(userId, actor);
  }

  // RBAC: owner, se_admin, manager only
  @Mutation(() => Boolean, { name: 'deleteStaff' })
  @Roles('owner', 'se_admin', 'manager')
  deleteStaff(
    @Args('userId', { type: () => ID }) userId: string,
    @CurrentUser() actor: JwtUser,
  ): Promise<boolean> {
    return this.staffService.deleteStaff(userId, actor);
  }

  // RBAC: owner, se_admin, manager only
  @Mutation(() => Boolean, { name: 'resetStaffPassword' })
  @Roles('owner', 'se_admin', 'manager')
  resetStaffPassword(
    @Args('input') input: ResetStaffPasswordInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<boolean> {
    return this.staffService.resetPassword(input, actor);
  }

  // RBAC: owner, se_admin, manager only
  @Mutation(() => GeneratedPasswordResult, {
    name: 'generateStaffPassword',
    description: 'Auto-generate a secure temporary password for a staff member and invalidate all active sessions.',
  })
  @Roles('owner', 'se_admin', 'manager')
  generateStaffPassword(
    @Args('userId', { type: () => ID }) userId: string,
    @CurrentUser() actor: JwtUser,
  ): Promise<GeneratedPasswordResult> {
    return this.staffService.generateStaffPassword(userId, actor);
  }
}
