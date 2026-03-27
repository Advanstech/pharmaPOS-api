import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';

export type Classification = 'OTC' | 'POM' | 'CONTROLLED';
export type BranchType = 'pharmaceutical' | 'chemical' | 'both';

@Entity('products')
export class Product {
  // PKs: UUID gen_random_uuid() — never SERIAL
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  @Index()
  name!: string;

  @Column({ name: 'generic_name', length: 255, nullable: true })
  genericName?: string;

  @Column({ length: 100, nullable: true })
  @Index()
  barcode?: string;

  // Price stored as integer pence (GHS × 100) — never float
  @Column({ name: 'unit_price', type: 'integer' })
  unitPrice!: number;

  @Column({ type: 'enum', enum: ['OTC', 'POM', 'CONTROLLED'], default: 'OTC' })
  classification!: Classification;

  @Column({ name: 'branch_type', type: 'enum', enum: ['pharmaceutical', 'chemical', 'both'], default: 'both' })
  branchType!: BranchType;

  // Ghana GRA: POM medicines are VAT exempt
  @Column({ name: 'vat_exempt', default: false })
  vatExempt!: boolean;

  // Ghana FDA: requires approved prescription before sale
  @Column({ name: 'requires_rx', default: false })
  requiresRx!: boolean;

  @Column({ name: 'image_id', nullable: true })
  imageId?: string;

  @Column({ name: 'category_id', nullable: true })
  categoryId?: string;

  @Column({ name: 'supplier_id', nullable: true })
  supplierId?: string;

  // Soft delete — NEVER hard delete
  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  // Timestamps in Africa/Accra timezone
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
