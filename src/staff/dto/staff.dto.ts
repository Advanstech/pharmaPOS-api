import { InputType, ObjectType, Field, ID } from '@nestjs/graphql';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsEnum,
  MinLength,
  IsDateString,
} from 'class-validator';

// ── Enums ─────────────────────────────────────────────────────────────────

export enum EmploymentType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say',
}

// ── Inputs ────────────────────────────────────────────────────────────────

@InputType({
  description:
    'Invite a new staff member to the branch. ' +
    'A temporary password is generated and returned — share it securely with the staff member. ' +
    'PII fields (phone, address, Ghana Card) are AES-256 encrypted at rest per Ghana Data Protection Act 2012. ' +
    'Requires role: `owner` or `manager`.',
})
export class InviteStaffInput {
  @Field({ description: 'Full legal name of the staff member' })
  @IsString()
  name!: string;

  @Field({
    nullable: true,
    description: 'Work email address. Used as login identifier if provided.',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @Field({
    nullable: true,
    description:
      'Phone number (Ghana format preferred, e.g. `0244123456`). ' +
      'Stored AES-256 encrypted — Ghana Data Protection Act 2012.',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @Field({
    description:
      'Role assigned to this staff member. ' +
      'Values: `owner` | `head_pharmacist` | `pharmacist` | `cashier` | `manager`',
  })
  @IsString()
  role!: string;

  @Field({ nullable: true, description: 'Job title. Example: `"Senior Pharmacist"`' })
  @IsOptional()
  @IsString()
  position?: string;

  @Field({ nullable: true, description: 'Department. Example: `"Dispensary"`, `"Front Desk"`' })
  @IsOptional()
  @IsString()
  department?: string;

  @Field({
    nullable: true,
    description: 'Employment type. Values: `full_time` | `part_time` | `contract`',
  })
  @IsOptional()
  @IsEnum(EmploymentType)
  employment_type?: EmploymentType;
}

@InputType({
  description:
    'Update a staff member\'s profile. All fields are optional — only provided fields are updated. ' +
    'PII fields (phone, address, Ghana Card, date of birth) are AES-256 encrypted before storage. ' +
    'Requires role: `owner` or `manager`. Staff can update their own non-PII fields.',
})
export class UpdateStaffProfileInput {
  @Field({ description: 'UUID of the user to update' })
  @IsString()
  userId!: string;

  @Field({ nullable: true, description: 'Job title' })
  @IsOptional()
  @IsString()
  position?: string;

  @Field({ nullable: true, description: 'Department' })
  @IsOptional()
  @IsString()
  department?: string;

  @Field({ nullable: true, description: 'Employment type' })
  @IsOptional()
  @IsEnum(EmploymentType)
  employment_type?: EmploymentType;

  @Field({ nullable: true, description: 'Gender (optional, self-reported)' })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @Field({ nullable: true, description: 'Employment start date. ISO 8601. Example: `"2025-01-15"`' })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @Field({ nullable: true, description: 'Employment end date (for contract/terminated staff)' })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @Field({
    nullable: true,
    description:
      'Ghana Pharmacy Council or GMDC professional licence number. ' +
      'Required for pharmacist roles — used for regulatory compliance.',
  })
  @IsOptional()
  @IsString()
  professional_licence_no?: string;

  @Field({ nullable: true, description: 'Expiry date of the professional licence. ISO 8601.' })
  @IsOptional()
  @IsDateString()
  licence_expiry_date?: string;

  @Field({ nullable: true, description: 'Emergency contact full name' })
  @IsOptional()
  @IsString()
  emergency_contact_name?: string;

  @Field({
    nullable: true,
    description: 'Emergency contact phone number. Stored encrypted.',
  })
  @IsOptional()
  @IsString()
  emergency_contact_phone?: string;

  @Field({ nullable: true, description: 'Internal HR notes. Not visible to the staff member.' })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field({ nullable: true, description: 'Profile photo URL (CDN/S3/public URL).' })
  @IsOptional()
  @IsString()
  photo_url?: string;

  /** Salary in GHS pesewas (integer ×100). Always GHS — never USD. */
  @Field({ nullable: true, description: 'Salary in GHS pesewas (÷100 for display). Always GHS.' })
  @IsOptional()
  salary_amount_pesewas?: number;

  @Field({ nullable: true, description: 'Salary period: daily | weekly | monthly | annual' })
  @IsOptional()
  @IsString()
  salary_period?: string;

  @Field({ nullable: true, description: 'Bank name for payroll' })
  @IsOptional()
  @IsString()
  bank_name?: string;

  @Field({
    nullable: true,
    description:
      'Phone number. Stored AES-256 encrypted — Ghana Data Protection Act 2012. ' +
      'Provide in plain text — the service encrypts before storing.',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @Field({
    nullable: true,
    description: 'Residential address. Stored AES-256 encrypted.',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @Field({
    nullable: true,
    description: 'Date of birth. ISO 8601. Stored AES-256 encrypted.',
  })
  @IsOptional()
  @IsString()
  date_of_birth?: string;

  @Field({
    nullable: true,
    description:
      'Ghana Card (National ID) number. Stored AES-256 encrypted. ' +
      'Format: `GHA-XXXXXXXXX-X`.',
  })
  @IsOptional()
  @IsString()
  ghana_card_number?: string;
}

@InputType({
  description:
    'Reset a staff member\'s password. Generates a new bcrypt hash (cost 12). ' +
    'Requires role: `owner` or `manager`. ' +
    'The staff member will be required to change their password on next login.',
})
export class ResetStaffPasswordInput {
  @Field({ description: 'UUID of the user whose password is being reset' })
  @IsString()
  userId!: string;

  @Field({ description: 'New password. Minimum 8 characters.' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

// ── Output types ──────────────────────────────────────────────────────────

@ObjectType({
  description:
    'A staff member\'s profile. PII fields (phone, address, Ghana Card) are ' +
    'decrypted before returning — only accessible to `owner` and `manager` roles.',
})
export class StaffMemberOutput {
  @Field(() => ID, { description: 'UUID of the user account' })
  id!: string;

  @Field({ description: 'Full name' })
  name!: string;

  @Field({ nullable: true, description: 'Work email address' })
  email?: string;

  @Field({
    description:
      'Assigned role. Values: `owner` | `head_pharmacist` | `pharmacist` | `cashier` | `manager`',
  })
  role!: string;

  @Field({ description: 'UUID of the branch this staff member belongs to' })
  branch_id!: string;

  @Field({ description: '`true` if the account is active. Deactivated accounts cannot log in.' })
  is_active!: boolean;

  @Field({ nullable: true, description: 'Job title' })
  position?: string;

  @Field({ nullable: true, description: 'Department' })
  department?: string;

  @Field({ nullable: true, description: 'Employment type' })
  employment_type?: string;

  @Field({
    nullable: true,
    description: 'Professional licence number (pharmacists). Used for Ghana FDA compliance.',
  })
  professional_licence_no?: string;

  @Field({ nullable: true, description: 'Professional licence expiry date' })
  licence_expiry_date?: Date;

  @Field({ nullable: true, description: 'Employment start date' })
  start_date?: Date;

  @Field({ nullable: true, description: 'Profile photo URL for avatar rendering.' })
  photo_url?: string;

  @Field(() => [String], {
    description:
      'S3 keys for uploaded certificates (professional licences, training certs). ' +
      'Use the pre-signed URL endpoint to download.',
  })
  certificate_s3_keys!: string[];

  /** Salary in GHS pesewas (integer ×100). Divide by 100 for display. Always GHS. */
  @Field({ nullable: true, description: 'Salary amount in GHS pesewas (÷100 for display). Always GHS.' })
  salary_amount_pesewas?: number;

  @Field({ nullable: true, description: 'Salary period: daily | weekly | monthly | annual' })
  salary_period?: string;

  @Field({ nullable: true, description: 'Bank name for payroll' })
  bank_name?: string;

  /** True when this staff member has an open session (logged in right now) */
  @Field({ description: 'True when this staff member currently has an open session (on duty)' })
  is_on_duty!: boolean;

  @Field({ nullable: true, description: 'Last activity timestamp from staff_sessions' })
  last_seen_at?: Date;

  @Field({ description: 'ISO 8601 timestamp when the account was created' })
  created_at!: Date;
}

@ObjectType({
  description:
    'Recorded staff sign-in session: login time, last token refresh, optional explicit logout. ' +
    'Managers see their branch; owners and SE admins see all branches in the organization (or filter by branch).',
})
export class StaffSessionOutput {
  @Field(() => ID)
  id!: string;

  @Field(() => ID, { name: 'userId' })
  user_id!: string;

  @Field()
  user_name!: string;

  @Field()
  user_role!: string;

  @Field(() => ID, { name: 'branchId' })
  branch_id!: string;

  @Field()
  branch_name!: string;

  @Field(() => ID, { name: 'sessionId' })
  session_id!: string;

  @Field()
  started_at!: Date;

  @Field({ nullable: true, description: 'Set when the user logged out or sessions were invalidated.' })
  ended_at?: Date;

  @Field({ description: 'Updated on each successful refresh-token exchange while the session is open.' })
  last_seen_at!: Date;

  @Field({ nullable: true })
  ip_address?: string;

  @Field({ nullable: true })
  user_agent?: string;

  @Field({
    description: 'True when no explicit end time has been recorded (session may still be active or may have expired server-side).',
  })
  is_open!: boolean;
}

@ObjectType({ description: 'Result of a successful staff invitation' })
export class InviteStaffResult {
  @Field(() => ID, { description: 'UUID of the newly created user account' })
  userId!: string;

  @Field({ description: 'Full name of the invited staff member' })
  name!: string;

  @Field({ nullable: true, description: 'Email used for onboarding delivery, when provided.' })
  email?: string;

  @Field({ description: 'Role assigned to the newly invited staff member.' })
  role!: string;

  @Field({
    description:
      'System-generated temporary password. ' +
      'Share this securely with the staff member — it is shown only once. ' +
      'The staff member must change it on first login.',
  })
  temporaryPassword!: string;

  @Field({
    description:
      'Whether invitation email delivery succeeded. ' +
      'If false, managers should share the temporary password manually.',
  })
  emailSent!: boolean;

  @Field({ description: 'Human-readable confirmation message' })
  message!: string;
}
