import { Resolver, Mutation, Query, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { EodService } from './eod.service';
import { CloseRegisterInput, EodRecordOutput, TodayEodStatus } from './dto/eod.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

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
    return this.eodService.getTodayStatus(actor.branchId) as Promise<TodayEodStatus>;
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
}
