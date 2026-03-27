import { InputType, Field, Int } from '@nestjs/graphql';

@InputType({ description: 'Create a new supplier. Requires role: owner or manager.' })
export class CreateSupplierInput {
  @Field({ description: 'Supplier trading name' })
  name!: string;

  @Field({ nullable: true, description: 'Primary contact person name' })
  contactName?: string;

  @Field({ nullable: true, description: 'Contact phone number (Ghana format preferred)' })
  phone?: string;

  @Field({ nullable: true, description: 'Contact email address' })
  email?: string;

  @Field({ nullable: true, description: 'Physical or postal address' })
  address?: string;
}

@InputType({ description: 'Update an existing supplier. All fields optional. Requires role: owner or manager.' })
export class UpdateSupplierInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  contactName?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  address?: string;

  @Field(() => Int, { nullable: true, description: 'AI reliability score 0–100' })
  aiScore?: number;

  @Field({ nullable: true })
  isActive?: boolean;
}
