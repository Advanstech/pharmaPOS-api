import { InputType, ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { IsUUID, IsString, IsDateString, IsArray, ValidateNested, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

// ── Inputs ────────────────────────────────────────────────────────────────

@InputType({ description: 'A single medicine line on a prescription' })
export class PrescriptionItemInput {
  @Field(() => ID, { description: 'UUID of the POM product being prescribed' })
  @IsUUID()
  productId!: string;

  @Field(() => Int, { description: 'Quantity prescribed. Must be >= 1.' })
  @Min(1)
  quantity!: number;

  @Field({
    nullable: true,
    description: 'Dosage instructions from the prescriber. Example: "Take 1 tablet twice daily after meals for 7 days".',
  })
  @IsOptional()
  @IsString()
  dosageInstructions?: string;
}

@InputType({
  description:
    'Create a new prescription for a customer. ' +
    'Ghana FDA: prescriber GMDC licence is validated live on creation. ' +
    'Rx expiry is set to exactly 30 days from prescribedDate — never extendable. ' +
    'Chemical shop branches are blocked by BranchTypeGuard. ' +
    'Requires role: pharmacist or head_pharmacist.',
})
export class CreatePrescriptionInput {
  @Field(() => ID, { description: 'UUID of the customer this prescription is for' })
  @IsUUID()
  customerId!: string;

  @Field({
    description:
      'Ghana Medical and Dental Council (GMDC) licence number of the prescribing doctor. ' +
      'Validated live on creation. Throws GMDC_INVALID_LICENCE if expired or not found.',
  })
  @IsString()
  prescriberLicenceNo!: string;

  @Field({ description: 'Full name of the prescribing doctor' })
  @IsString()
  prescriberName!: string;

  @Field({
    description:
      'Date the prescription was written. ISO 8601 format. Example: "2026-03-22". ' +
      'Ghana FDA: Rx is valid for exactly 30 days from this date.',
  })
  @IsDateString()
  prescribedDate!: string;

  @Field(() => [PrescriptionItemInput], {
    description: 'One or more POM medicines on this prescription. Must not be empty.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemInput)
  items!: PrescriptionItemInput[];
}

@InputType({
  description:
    'Verify (approve) a pending prescription. ' +
    'Ghana FDA: Rx expiry is re-checked, GMDC licence is re-validated. ' +
    'Controlled drugs require approval_count >= 2 (two pharmacist sign-offs). ' +
    'Requires role: pharmacist or head_pharmacist.',
})
export class VerifyPrescriptionInput {
  @Field(() => ID, { description: 'UUID of the prescription to verify' })
  @IsUUID()
  prescriptionId!: string;

  @Field({
    nullable: true,
    description: 'Optional pharmacist notes recorded against this verification',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ── Output types ──────────────────────────────────────────────────────────

@ObjectType({ description: 'A single medicine line on a prescription' })
export class PrescriptionItemOutput {
  @Field(() => ID, { description: 'UUID of this prescription item' })
  id!: string;

  @Field(() => ID, { description: 'UUID of the prescribed product' })
  productId!: string;

  @Field({ description: 'Product name at time of prescription' })
  productName!: string;

  @Field(() => Int, { description: 'Quantity prescribed' })
  quantity!: number;

  @Field({ nullable: true, description: 'Dosage instructions from the prescriber' })
  dosageInstructions?: string;
}

@ObjectType({
  description:
    'A prescription record. Lifecycle: PENDING -> VERIFIED -> DISPENSED. ' +
    'Ghana FDA: GMDC licence validated on creation and verification. ' +
    'Rx valid for exactly 30 days. Controlled drugs require approvalCount >= 2. ' +
    'Dispensed Rx PDF uploaded to S3 (5-year retention).',
})
export class PrescriptionOutput {
  @Field(() => ID, { description: 'UUID of the prescription' })
  id!: string;

  @Field(() => ID, { description: 'UUID of the branch where the prescription was created' })
  branchId!: string;

  @Field(() => ID, { description: 'UUID of the customer (no PHI — use customer lookup separately)' })
  customerId!: string;

  @Field({
    description: 'GMDC licence number of the prescribing doctor — validated on creation and verification',
  })
  prescriberLicenceNo!: string;

  @Field({ description: 'Full name of the prescribing doctor' })
  prescriberName!: string;

  @Field({ description: 'Date the prescription was written (ISO 8601, Africa/Accra timezone)' })
  prescribedDate!: Date;

  @Field({
    description:
      'Ghana FDA: Rx expiry date — exactly 30 days after prescribedDate. ' +
      'Dispensing is blocked after this date with error FDA_RX_EXPIRED.',
  })
  expiryDate!: Date;

  @Field({
    description: 'Current status. Values: PENDING | VERIFIED | DISPENSED | EXPIRED | CANCELLED',
  })
  status!: string;

  @Field(() => Int, {
    description: 'Number of pharmacist sign-offs. Ghana FDA: controlled drugs require approvalCount >= 2.',
  })
  approvalCount!: number;

  @Field(() => [PrescriptionItemOutput], { description: 'Medicines on this prescription' })
  items!: PrescriptionItemOutput[];

  @Field({ description: 'ISO 8601 timestamp when the prescription was created' })
  createdAt!: Date;
}

@ObjectType({ description: 'Result of a GMDC prescriber licence validation check' })
export class GmdcValidationResult {
  @Field({ description: 'The GMDC licence number that was checked' })
  licenceNo!: string;

  @Field({
    description:
      'true if the licence is valid and active. ' +
      'false throws GMDC_INVALID_LICENCE. ' +
      'If the GMDC API is unreachable, returns true with a warning log — never blocks due to outage.',
  })
  valid!: boolean;

  @Field({
    description: 'true if the result was served from Redis cache (24h TTL). false if a live GMDC API call was made.',
  })
  cached!: boolean;
}
