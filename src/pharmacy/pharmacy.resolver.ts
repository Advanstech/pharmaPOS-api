import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PharmacyService } from './pharmacy.service';
import {
  CreatePrescriptionInput,
  VerifyPrescriptionInput,
  PrescriptionOutput,
  GmdcValidationResult,
} from './dto/pharmacy.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BranchTypeGuard } from '../auth/guards/branch-type.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class PharmacyResolver {
  constructor(private readonly pharmacyService: PharmacyService) {}

  // Ghana FDA: chemical shop cannot create Rx — BranchTypeGuard enforces this
  @Mutation(() => PrescriptionOutput, { name: 'createPrescription' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician')
  @UseGuards(BranchTypeGuard('pharmaceutical'))
  createPrescription(
    @Args('input') input: CreatePrescriptionInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<PrescriptionOutput> {
    return this.pharmacyService.createPrescription(input, actor);
  }

  // Ghana FDA: only pharmacist/head_pharmacist can verify Rx
  @Mutation(() => PrescriptionOutput, { name: 'verifyPrescription' })
  @Roles('head_pharmacist', 'pharmacist')
  @UseGuards(BranchTypeGuard('pharmaceutical'))
  verifyPrescription(
    @Args('input') input: VerifyPrescriptionInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<PrescriptionOutput> {
    return this.pharmacyService.verifyPrescription(input, actor);
  }

  @Query(() => PrescriptionOutput, { name: 'prescription' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician')
  prescription(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() _actor: JwtUser,
  ): Promise<PrescriptionOutput> {
    return this.pharmacyService.getPrescription(id);
  }

  @Query(() => [PrescriptionOutput], { name: 'pendingPrescriptions' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist')
  pendingPrescriptions(@CurrentUser() actor: JwtUser): Promise<PrescriptionOutput[]> {
    return this.pharmacyService.getPendingPrescriptions(actor.branchId);
  }

  /** POS: list prescriptions (pending or verified) that include this product — link before checkout. */
  @Query(() => [PrescriptionOutput], { name: 'prescriptionsForProduct' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician', 'cashier')
  @UseGuards(BranchTypeGuard('pharmaceutical'))
  prescriptionsForProduct(
    @Args('productId', { type: () => ID }) productId: string,
    @CurrentUser() actor: JwtUser,
  ): Promise<PrescriptionOutput[]> {
    return this.pharmacyService.getPrescriptionsForProduct(actor.branchId, productId);
  }

  // GMDC licence validation — used by UI before creating Rx
  @Query(() => GmdcValidationResult, { name: 'validateGmdcLicence' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist')
  async validateGmdcLicence(
    @Args('licenceNo') licenceNo: string,
  ): Promise<GmdcValidationResult> {
    const result = await this.pharmacyService.validateGmdcLicence(licenceNo);
    return { licenceNo, ...result };
  }
}
