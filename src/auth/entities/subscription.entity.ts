import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { SubscriptionTier } from '../../config/constants';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'varchar', length: 20 })
  tier!: SubscriptionTier;

  @Column({ type: 'varchar', length: 20 })
  status!: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'SUSPENDED';

  @Column({ name: 'current_period_start', type: 'timestamptz' })
  currentPeriodStart!: Date;

  @Column({ name: 'current_period_end', type: 'timestamptz' })
  currentPeriodEnd!: Date;

  @Column({ name: 'cancel_at_period_end', default: false })
  cancelAtPeriodEnd!: boolean;

  @Column({ name: 'trial_ends_at', type: 'timestamptz', nullable: true })
  trialEndsAt?: Date | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
