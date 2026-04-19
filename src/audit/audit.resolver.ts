import { Resolver, Query, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SubscriptionGuard } from '../auth/guards/subscription.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from './audit.service';
import {
  AuditPeriodInput,
  DispensingComplianceAudit,
  FinancialIntegrityAudit,
  InventoryIntegrityAudit,
  InternalAuditReport,
  LicenceComplianceAudit,
  StaffBehaviourProfile,
  StaffInvestigationInput,
  TaxComplianceAudit,
  StaffActivityEntry,
} from './dto/audit.types';

interface AuthUser {
  id: string;
  role: string;
  branchId: string;
  organizationId: string;
}

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
export class AuditResolver {
  constructor(private readonly auditService: AuditService) {}

  // RBAC: owner, se_admin only — full audit report is the most sensitive query in the system
  @Query(() => InternalAuditReport, {
    description:
      'Full internal audit report — Ghana FDA compliance, GRA tax, financial integrity, ' +
      'inventory integrity, licence compliance, staff behaviour profiling, and risk matrix. ' +
      'RBAC: owner and se_admin only.',
  })
  @Roles('owner', 'se_admin')
  async internalAuditReport(
    @Args('input') input: AuditPeriodInput,
    @CurrentUser() user: AuthUser,
  ): Promise<InternalAuditReport> {
    return this.auditService.getInternalAuditReport(user.branchId, input);
  }

  // RBAC: owner, se_admin, manager, head_pharmacist — dispensing compliance visible to branch clinical leads
  @Query(() => DispensingComplianceAudit, {
    description:
      'Ghana FDA dispensing compliance audit — POM enforcement, Rx validity, GMDC validation, ' +
      'controlled drug sign-offs, PDF retention. RBAC: owner, se_admin, manager, head_pharmacist.',
  })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist')
  async dispensingComplianceAudit(
    @Args('input') input: AuditPeriodInput,
    @CurrentUser() user: AuthUser,
  ): Promise<DispensingComplianceAudit> {
    return this.auditService.getDispensingComplianceAudit(user.branchId, input);
  }

  // RBAC: owner, se_admin only — financial fraud data is owner-only
  @Query(() => FinancialIntegrityAudit, {
    description:
      'Financial integrity audit — revenue reconciliation, void/refund analysis, ' +
      'cash dominance, duplicate invoices, expense fraud signals, GL integrity. ' +
      'RBAC: owner, se_admin only.',
  })
  @Roles('owner', 'se_admin')
  async financialIntegrityAudit(
    @Args('input') input: AuditPeriodInput,
    @CurrentUser() user: AuthUser,
  ): Promise<FinancialIntegrityAudit> {
    return this.auditService.getFinancialIntegrityAudit(user.branchId, input);
  }

  // RBAC: owner, se_admin, manager — inventory visible to managers
  @Query(() => InventoryIntegrityAudit, {
    description:
      'Inventory integrity audit — shrinkage, phantom stock, expired dispensing, ' +
      'GRN integrity, high-value adjustments. RBAC: owner, se_admin, manager.',
  })
  @Roles('owner', 'se_admin', 'manager')
  async inventoryIntegrityAudit(
    @Args('input') input: AuditPeriodInput,
    @CurrentUser() user: AuthUser,
  ): Promise<InventoryIntegrityAudit> {
    return this.auditService.getInventoryIntegrityAudit(user.branchId, input);
  }

  // RBAC: owner, se_admin only — tax data is owner-only
  @Query(() => TaxComplianceAudit, {
    description:
      'Ghana GRA tax compliance audit — VAT gap, exemption abuse, PAYE compliance, ' +
      'withholding tax on supplier payments. RBAC: owner, se_admin only.',
  })
  @Roles('owner', 'se_admin')
  async taxComplianceAudit(
    @Args('input') input: AuditPeriodInput,
    @CurrentUser() user: AuthUser,
  ): Promise<TaxComplianceAudit> {
    return this.auditService.getTaxComplianceAudit(user.branchId, input);
  }

  // RBAC: owner, se_admin, manager — licence status visible to managers
  @Query(() => LicenceComplianceAudit, {
    description:
      'Licence and regulatory compliance — pharmacist licences, HeFRA branch licence, ' +
      'controlled drug register, cold chain. RBAC: owner, se_admin, manager.',
  })
  @Roles('owner', 'se_admin', 'manager')
  async licenceComplianceAudit(
    @CurrentUser() user: AuthUser,
  ): Promise<LicenceComplianceAudit> {
    return this.auditService.getLicenceComplianceAudit(user.branchId);
  }

  // RBAC: owner, se_admin only — staff spy report is owner-only (Ghana DPA 2012)
  @Query(() => [StaffBehaviourProfile], {
    description:
      'Behavioural profiles for all active staff, ranked by risk score. ' +
      'Detects void abuse, discount abuse, after-hours activity, speed anomalies, ' +
      'POM bypass attempts, and refund patterns. ' +
      'Ghana DPA 2012: user IDs only — no names in findings. ' +
      'RBAC: owner, se_admin only.',
  })
  @Roles('owner', 'se_admin')
  async staffBehaviourProfiles(
    @Args('input') input: AuditPeriodInput,
    @CurrentUser() user: AuthUser,
  ): Promise<StaffBehaviourProfile[]> {
    return this.auditService.getStaffBehaviourProfiles(user.branchId, input);
  }

  // RBAC: owner, se_admin only — deep-dive on a single staff member
  @Query(() => StaffBehaviourProfile, {
    description:
      'Deep-dive behavioural profile for a single staff member. ' +
      'Ghana DPA 2012: user IDs only — no names in findings. ' +
      'RBAC: owner, se_admin only.',
  })
  @Roles('owner', 'se_admin')
  async staffBehaviourProfile(
    @Args('input') input: StaffInvestigationInput,
    @Args('branchId', { type: () => ID }) branchId: string,
  ): Promise<StaffBehaviourProfile> {
    return this.auditService.getStaffBehaviourProfile(branchId, input);
  }

  @Query(() => [StaffActivityEntry], {
    name: 'staffActivityLog',
    description: 'Recent activity log for a staff member — pages visited, actions taken.',
  })
  @Roles('owner', 'se_admin', 'manager')
  async staffActivityLog(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<StaffActivityEntry[]> {
    const rows = await this.auditService.getStaffActivityLog(userId, limit || 50);
    return rows;
  }
}
