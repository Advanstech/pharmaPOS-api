import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType({
  description:
    'An authenticated user account. Scoped to a single branch. ' +
    '`password_hash` is never exposed via GraphQL.',
})
@Entity('users')
export class User {
  @Field(() => ID, { description: 'UUID of the user account' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Field({ description: 'UUID of the branch this user belongs to' })
  @Column()
  branch_id!: string;

  @Field({ description: 'Full display name' })
  @Column()
  name!: string;

  @Field({
    nullable: true,
    description: 'Email address — used as login identifier. Unique across the platform.',
  })
  @Column({ nullable: true, unique: true })
  email?: string;

  @Field({
    nullable: true,
    description: 'Phone number. Stored in plain text on the user record (PII encrypted in staff_profiles).',
  })
  @Column({ nullable: true })
  phone?: string;

  @Field({
    description:
      'Assigned role. Controls access to all mutations and queries. ' +
      'Values: `owner` | `head_pharmacist` | `pharmacist` | `cashier` | `manager` | `se_admin`',
  })
  @Column()
  role!: string;

  // Never expose password_hash via GraphQL — bcrypt hash (cost 12)
  @Column()
  password_hash!: string;

  @Field({
    description:
      '`true` if multi-factor authentication is enabled for this account. ' +
      'MFA is required for `owner` and `head_pharmacist` roles in production.',
  })
  @Column({ default: false })
  mfa_enabled!: boolean;

  @Field({
    description:
      '`true` if the account is active. Deactivated accounts cannot log in. ' +
      'Use soft-deactivation instead of deletion — audit trail is preserved.',
  })
  @Column({ default: true })
  is_active!: boolean;

  @Field({ description: 'ISO 8601 timestamp when the account was created (Africa/Accra timezone)' })
  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @Field({ description: 'ISO 8601 timestamp of the last account update' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
