import { InputType, ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import {
  IsUUID,
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  IsEnum,
  MinLength,
  IsEmail,
} from 'class-validator';

export enum CustomerSex {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say',
}

registerEnumType(CustomerSex, { name: 'CustomerSex' });

@InputType({
  description:
    'Register a customer at the branch. Name and phone are optional (walk-ins). A unique **customerCode** ' +
    '(e.g. `PP-X7K2M9P4`) is always generated for receipts and linkage. Ghana Card is stored encrypted.',
})
export class CreateCustomerInput {
  @Field({
    nullable: true,
    description: 'Display name when the customer agrees to share it.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @Field({
    nullable: true,
    description: 'Mobile number (Ghana). Stored as a salted hash for deduplication — not returned in APIs.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @Field({
    nullable: true,
    description: 'Email address for receipts and notifications. Unique per customer.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @IsEmail()
  email?: string;

  @Field({
    nullable: true,
    description: 'Customer prefers to receive receipts via email, print, or both.',
  })
  @IsOptional()
  @IsEnum(['email', 'print', 'both'])
  receiptPreference?: 'email' | 'print' | 'both';

  @Field({
    nullable: true,
    description: 'Customer consents to marketing emails and SMS.',
  })
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  @Field(() => CustomerSex, {
    nullable: true,
    description: 'Optional — clinical and reporting use only.',
  })
  @IsOptional()
  @IsEnum(CustomerSex)
  sex?: CustomerSex;

  @Field(() => Int, {
    nullable: true,
    description: 'Approximate age in years (optional alternative to full DOB).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(130)
  ageYears?: number;

  @Field({
    nullable: true,
    description: 'Ghana Card identifier — encrypted at rest (Ghana DPA 2012).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  ghanaCardNumber?: string;
}

@InputType({ description: 'Update optional profile fields for an existing customer.' })
export class UpdateCustomerInput {
  @Field(() => ID)
  @IsUUID()
  customerId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @IsEmail()
  email?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEnum(['email', 'print', 'both'])
  receiptPreference?: 'email' | 'print' | 'both';

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  @Field(() => CustomerSex, { nullable: true })
  @IsOptional()
  @IsEnum(CustomerSex)
  sex?: CustomerSex;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(130)
  ageYears?: number;

  @Field({ nullable: true, description: 'Set to empty string to clear stored Ghana Card.' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  ghanaCardNumber?: string;
}

@ObjectType({
  description:
    'Branch customer. **customerCode** is safe on receipts. Name and Ghana Card raw values are never logged.',
})
export class CustomerOutput {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  branchId!: string;

  @Field({
    description: 'Stable public reference (e.g. PP-XXXXXXXX) — use when the person declines a name.',
  })
  customerCode!: string;

  @Field({
    nullable: true,
    description: 'Decrypted name when on file; otherwise null (use customerCode on receipts).',
  })
  name?: string;

  @Field({ description: 'True when a phone number was captured (number itself is never returned).' })
  hasPhone!: boolean;

  @Field(() => CustomerSex, { nullable: true })
  sex?: CustomerSex;

  @Field(() => Int, { nullable: true })
  ageYears?: number;

  @Field({ description: 'True when an encrypted Ghana Card value exists.' })
  hasGhanaCard!: boolean;

  @Field({
    nullable: true,
    description: 'Email address when provided and verified.',
  })
  email?: string;

  @Field({ description: 'True when an email address is stored.' })
  hasEmail!: boolean;

  @Field({
    nullable: true,
    description: 'Customer receipt preference: email, print, or both.',
  })
  receiptPreference?: 'email' | 'print' | 'both';

  @Field({ description: 'Customer consented to marketing communications.' })
  marketingConsent!: boolean;

  @Field({
    nullable: true,
    description: 'When the email was verified (null if not verified).',
  })
  emailVerifiedAt?: Date;

  @Field()
  createdAt!: Date;
}
