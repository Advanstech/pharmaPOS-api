import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

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
