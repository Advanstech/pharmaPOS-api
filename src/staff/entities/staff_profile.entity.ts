import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../../auth/entities/user.entity';

@ObjectType()
@Entity('staff_profiles')
export class StaffProfile {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Field()
  @Column()
  user_id!: string;

  @Field()
  @Column()
  branch_id!: string;

  // Ghana Data Protection Act 2012: PII encrypted at rest — never expose raw
  @Column({ nullable: true })
  phone_encrypted?: string;

  @Column({ nullable: true })
  address_encrypted?: string;

  @Column({ nullable: true })
  date_of_birth_encrypted?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  gender?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  position?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  department?: string;

  @Field()
  @Column({ default: 'full_time' })
  employment_type!: string;

  @Field({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  start_date?: Date;

  @Field({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  end_date?: Date;

  // Ghana Card — AES-256 encrypted
  @Column({ nullable: true })
  ghana_card_number_encrypted?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  professional_licence_no?: string;

  @Field({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  licence_expiry_date?: Date;

  // S3 keys for uploaded certificates (same bucket as Rx PDFs)
  @Field(() => [String])
  @Column('text', { array: true, default: [] })
  certificate_s3_keys!: string[];

  @Field({ nullable: true })
  @Column({ nullable: true })
  emergency_contact_name?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  emergency_contact_phone?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  photo_url?: string;

  // Compensation — all amounts in GHS pesewas (×100). Never USD.
  @Field({ nullable: true })
  @Column({ type: 'bigint', nullable: true })
  salary_amount_pesewas?: number;

  @Field({ nullable: true })
  @Column({ nullable: true, default: 'monthly' })
  salary_period?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  bank_name?: string;

  @Column({ nullable: true })
  bank_account_encrypted?: string;

  @Column({ nullable: true })
  momo_number_encrypted?: string;

  // RBAC: notes visible to manager/owner/se_admin only
  @Field({ nullable: true })
  @Column({ nullable: true })
  notes?: string;

  @Field()
  @Column({ default: true })
  is_active!: boolean;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  // Relation — loaded when needed
  @Field(() => User, { nullable: true })
  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
