import { InputType, Field, Int } from '@nestjs/graphql';
import { SupplierPaymentMethod } from '../entities/supplier.entity';

@InputType()
export class BankDetailsInput {
  @Field({ nullable: true }) bankName?: string;
  @Field({ nullable: true }) accountName?: string;
  @Field({ nullable: true }) accountNumber?: string;
  @Field({ nullable: true }) branch?: string;
  @Field({ nullable: true }) swiftCode?: string;
  @Field({ nullable: true }) sortCode?: string;
}

@InputType()
export class MomoDetailsInput {
  @Field({ nullable: true }) network?: string;
  @Field({ nullable: true }) number?: string;
  @Field({ nullable: true }) accountName?: string;
}

@InputType()
export class CardDetailsInput {
  @Field({ nullable: true }) merchantId?: string;
  @Field({ nullable: true }) paymentLink?: string;
  @Field({ nullable: true }) instructions?: string;
}

@InputType()
export class PaymentInstructionsInput {
  @Field(() => [SupplierPaymentMethod], { nullable: true })
  acceptedMethods?: SupplierPaymentMethod[];

  @Field({ nullable: true }) preferredMethod?: string;
  @Field({ nullable: true }) paymentTerms?: string;
  @Field({ nullable: true }) notes?: string;
  @Field({ nullable: true }) tin?: string;

  @Field(() => BankDetailsInput, { nullable: true })
  bankDetails?: BankDetailsInput;

  @Field(() => MomoDetailsInput, { nullable: true })
  momoDetails?: MomoDetailsInput;

  @Field(() => CardDetailsInput, { nullable: true })
  cardDetails?: CardDetailsInput;
}

@InputType({ description: 'Create a new supplier' })
export class CreateSupplierInput {
  @Field() name!: string;
  @Field({ nullable: true }) contactName?: string;
  @Field({ nullable: true }) phone?: string;
  @Field({ nullable: true }) email?: string;
  @Field({ nullable: true }) address?: string;
  @Field({ nullable: true }) tin?: string;
  @Field({ nullable: true }) website?: string;
  @Field(() => PaymentInstructionsInput, { nullable: true }) paymentInstructions?: PaymentInstructionsInput;
}

@InputType({ description: 'Update an existing supplier' })
export class UpdateSupplierInput {
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) contactName?: string;
  @Field({ nullable: true }) phone?: string;
  @Field({ nullable: true }) email?: string;
  @Field({ nullable: true }) address?: string;
  @Field({ nullable: true }) tin?: string;
  @Field({ nullable: true }) website?: string;
  @Field(() => Int, { nullable: true }) aiScore?: number;
  @Field({ nullable: true }) isActive?: boolean;
  @Field(() => PaymentInstructionsInput, { nullable: true }) paymentInstructions?: PaymentInstructionsInput;
}
