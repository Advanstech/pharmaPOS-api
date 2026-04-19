import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';

// ── Payment Method Enum ───────────────────────────────────────────────────────

export enum SupplierPaymentMethod {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  MTN_MOMO = 'MTN_MOMO',
  VODAFONE_CASH = 'VODAFONE_CASH',
  AIRTELTIGO_MONEY = 'AIRTELTIGO_MONEY',
  VISA = 'VISA',
  MASTERCARD = 'MASTERCARD',
  CHEQUE = 'CHEQUE',
}

registerEnumType(SupplierPaymentMethod, {
  name: 'SupplierPaymentMethod',
  description: 'Accepted payment methods for a supplier',
});

// ── Bank Details ──────────────────────────────────────────────────────────────

@ObjectType({ description: 'Supplier bank account details for direct transfer' })
export class SupplierBankDetails {
  @Field({ nullable: true }) bankName?: string;
  @Field({ nullable: true }) accountName?: string;
  @Field({ nullable: true }) accountNumber?: string;
  @Field({ nullable: true }) branch?: string;
  @Field({ nullable: true }) swiftCode?: string;
  @Field({ nullable: true }) sortCode?: string;
}

// ── Mobile Money Details ──────────────────────────────────────────────────────

@ObjectType({ description: 'Supplier mobile money details' })
export class SupplierMomoDetails {
  @Field({ nullable: true }) network?: string;   // MTN, Vodafone, AirtelTigo
  @Field({ nullable: true }) number?: string;
  @Field({ nullable: true }) accountName?: string;
}

// ── Card Details ──────────────────────────────────────────────────────────────

@ObjectType({ description: 'Supplier card payment details' })
export class SupplierCardDetails {
  @Field({ nullable: true }) merchantId?: string;
  @Field({ nullable: true }) paymentLink?: string;  // e.g. Paystack/Flutterwave link
  @Field({ nullable: true }) instructions?: string;
}

// ── Payment Instructions ──────────────────────────────────────────────────────

@ObjectType({ description: 'Full payment instructions for a supplier' })
export class SupplierPaymentInstructions {
  @Field(() => [SupplierPaymentMethod], { nullable: true, description: 'Accepted payment methods' })
  acceptedMethods?: SupplierPaymentMethod[];

  @Field({ nullable: true, description: 'Preferred payment method' })
  preferredMethod?: string;

  @Field({ nullable: true, description: 'Payment terms e.g. NET_30, NET_60, IMMEDIATE' })
  paymentTerms?: string;

  @Field({ nullable: true, description: 'Payment notes or special instructions' })
  notes?: string;

  @Field(() => SupplierBankDetails, { nullable: true })
  bankDetails?: SupplierBankDetails;

  @Field(() => SupplierMomoDetails, { nullable: true })
  momoDetails?: SupplierMomoDetails;

  @Field(() => SupplierCardDetails, { nullable: true })
  cardDetails?: SupplierCardDetails;

  @Field({ nullable: true, description: 'TIN number for tax purposes' })
  tin?: string;
}

// ── Supplier Entity ───────────────────────────────────────────────────────────

@ObjectType({
  description:
    'A medicine or health product supplier. ' +
    'Linked to products and sale items for full supply chain traceability — a Ghana FDA requirement. ' +
    'Soft-deleted via `is_active = false` — never hard deleted.',
})
@Entity('suppliers')
export class Supplier {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Field({ description: 'Supplier trading name' })
  @Column()
  name!: string;

  @Field({ nullable: true, description: 'Primary contact person name' })
  @Column({ name: 'contact_name', nullable: true })
  contactName?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  address?: string;

  @Field({ nullable: true, description: 'Tax Identification Number' })
  @Column({ nullable: true })
  tin?: string;

  @Field({ nullable: true, description: 'Supplier website URL' })
  @Column({ nullable: true })
  website?: string;

  @Field(() => SupplierPaymentInstructions, { nullable: true, description: 'Payment instructions and banking details' })
  @Column({ name: 'payment_instructions', type: 'jsonb', nullable: true })
  paymentInstructions?: SupplierPaymentInstructions;

  @Field(() => Int, {
    nullable: true,
    description: 'AI reliability score 0–100. Updated nightly.',
  })
  @Column({ name: 'ai_score', type: 'integer', nullable: true })
  aiScore?: number;

  @Field()
  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Field()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Field()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
