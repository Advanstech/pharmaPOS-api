import { Resolver, Mutation, Query, Args, Int, ObjectType, Field } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { EodService } from './eod.service';
import { CloseRegisterInput, EodRecordOutput, TodayEodStatus, ApproveEodInput } from './dto/eod.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@ObjectType()
export class StaffPendingEodItem {
  @Field() id!: string;
  @Field() name!: string;
  @Field() role!: string;
}

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class EodResolver {
  constructor(private readonly eodService: EodService) {}

  @Mutation(() => EodRecordOutput, {
    name: 'closeRegister',
    description: 'Close the daily register — saves cash count, variance, and posts GL entry if variance exists.',
  })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician', 'cashier', 'chemical_cashier')
  closeRegister(
    @Args('input') input: CloseRegisterInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<EodRecordOutput> {
    return this.eodService.closeRegister(input, actor) as Promise<EodRecordOutput>;
  }

  @Query(() => TodayEodStatus, {
    name: 'todayEodStatus',
    description: 'Check if today\'s register has been closed for this branch.',
  })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician', 'cashier', 'chemical_cashier')
  todayEodStatus(@CurrentUser() actor: JwtUser): Promise<TodayEodStatus> {
    return this.eodService.getTodayStatus(actor.branchId, actor.sub) as Promise<TodayEodStatus>;
  }

  @Query(() => [EodRecordOutput], {
    name: 'branchEodForDate',
    description: 'All staff EOD records for a branch on a given date. Manager/owner only.',
  })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist')
  branchEodForDate(
    @CurrentUser() actor: JwtUser,
    @Args('businessDate') businessDate: string,
  ): Promise<EodRecordOutput[]> {
    return this.eodService.getBranchEodForDate(actor.branchId, businessDate) as Promise<EodRecordOutput[]>;
  }

  @Query(() => [StaffPendingEodItem], {
    name: 'staffPendingEod',
    description: 'Staff members who have not yet submitted an EOD for a given date.',
  })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist')
  staffPendingEod(
    @CurrentUser() actor: JwtUser,
    @Args('businessDate') businessDate: string,
  ): Promise<StaffPendingEodItem[]> {
    return this.eodService.getStaffPendingEod(actor.branchId, businessDate);
  }

  @Query(() => [EodRecordOutput], {
    name: 'eodHistory',
    description: 'List EOD records for this branch. Manager/owner only.',
  })
  @Roles('owner', 'se_admin', 'manager')
  eodHistory(
    @CurrentUser() actor: JwtUser,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<EodRecordOutput[]> {
    return this.eodService.listEodRecords(actor, limit) as Promise<EodRecordOutput[]>;
  }

  @Query(() => [EodRecordOutput], {
    name: 'pendingEodApprovals',
    description: 'EOD records awaiting manager approval.',
  })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist')
  pendingEodApprovals(@CurrentUser() actor: JwtUser): Promise<EodRecordOutput[]> {
    return this.eodService.getPendingApprovals(actor.branchId) as Promise<EodRecordOutput[]>;
  }

  @Mutation(() => EodRecordOutput, { name: 'approveEodRecord' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist')
  approveEodRecord(
    @Args('input') input: ApproveEodInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<EodRecordOutput> {
    return this.eodService.approveEodRecord(input.eodId, actor, input.managerNotes) as Promise<EodRecordOutput>;
  }

  @Mutation(() => EodRecordOutput, { name: 'declineEodRecord' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist')
  declineEodRecord(
    @Args('input') input: ApproveEodInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<EodRecordOutput> {
    return this.eodService.declineEodRecord(input.eodId, actor, input.managerNotes) as Promise<EodRecordOutput>;
  }
}
