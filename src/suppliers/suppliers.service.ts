import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { CreateSupplierInput, UpdateSupplierInput } from './dto/supplier.input';
import { SupplierRestockWatch } from './dto/supplier-watch.types';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    private readonly dataSource: DataSource,
  ) {}

  async listSuppliers(): Promise<Supplier[]> {
    return this.supplierRepo.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  async getSupplierById(id: string): Promise<Supplier> {
    const supplier = await this.supplierRepo.findOne({ where: { id } });
    if (!supplier) throw new NotFoundException(`Supplier ${id} not found`);
    return supplier;
  }

  async createSupplier(input: CreateSupplierInput): Promise<Supplier> {
    const supplier = this.supplierRepo.create({ ...input });
    return this.supplierRepo.save(supplier);
  }

  async updateSupplier(id: string, input: UpdateSupplierInput): Promise<Supplier> {
    const supplier = await this.getSupplierById(id);
    Object.assign(supplier, input);
    return this.supplierRepo.save(supplier);
  }

  async deleteSupplier(id: string): Promise<boolean> {
    const supplier = await this.getSupplierById(id);
    supplier.isActive = false;
    await this.supplierRepo.save(supplier);
    return true;
  }

  async getSupplierRestockWatch(branchId: string): Promise<SupplierRestockWatch[]> {
    const rows = await this.dataSource.query(`
      SELECT
        s.id AS supplier_id,
        s.name AS supplier_name,
        s.phone AS supplier_phone,
        s.email AS supplier_email,
        s.ai_score AS supplier_ai_score,
        p.id AS product_id,
        p.name AS product_name,
        COALESCE(inv.quantity_on_hand, 0)::int AS quantity_on_hand,
        COALESCE(inv.reorder_level, 10)::int AS reorder_level
      FROM products p
      INNER JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN inventory inv ON inv.product_id = p.id AND inv.branch_id = $1
      WHERE p.is_active = true
        AND s.is_active = true
      ORDER BY s.name ASC, p.name ASC
    `, [branchId]) as Array<{
      supplier_id: string;
      supplier_name: string;
      supplier_phone: string | null;
      supplier_email: string | null;
      supplier_ai_score: number | null;
      product_id: string;
      product_name: string;
      quantity_on_hand: number;
      reorder_level: number;
    }>;

    const map = new Map<string, SupplierRestockWatch>();
    for (const row of rows) {
      const status = this.calcStockStatus(row.quantity_on_hand, row.reorder_level);
      const existing = map.get(row.supplier_id);
      const watch: SupplierRestockWatch = existing ?? {
        supplierId: row.supplier_id,
        supplierName: row.supplier_name,
        supplierPhone: row.supplier_phone ?? undefined,
        supplierEmail: row.supplier_email ?? undefined,
        supplierAiScore: row.supplier_ai_score ?? undefined,
        totalTrackedProducts: 0,
        lowStockCount: 0,
        criticalStockCount: 0,
        outOfStockCount: 0,
        affectedProducts: [],
      };

      watch.totalTrackedProducts += 1;
      if (status === 'low') watch.lowStockCount += 1;
      if (status === 'critical') watch.criticalStockCount += 1;
      if (status === 'out') watch.outOfStockCount += 1;

      if (status !== 'ok') {
        watch.affectedProducts.push({
          productId: row.product_id,
          productName: row.product_name,
          quantityOnHand: row.quantity_on_hand,
          reorderLevel: row.reorder_level,
          stockStatus: status,
        });
      }

      map.set(row.supplier_id, watch);
    }

    return Array.from(map.values()).sort((a, b) => {
      const scoreA = a.outOfStockCount * 3 + a.criticalStockCount * 2 + a.lowStockCount;
      const scoreB = b.outOfStockCount * 3 + b.criticalStockCount * 2 + b.lowStockCount;
      return scoreB - scoreA || a.supplierName.localeCompare(b.supplierName);
    });
  }

  private calcStockStatus(quantityOnHand: number, reorderLevel: number): string {
    if (quantityOnHand <= 0) return 'out';
    if (quantityOnHand <= Math.max(1, Math.floor(reorderLevel * 0.2))) return 'critical';
    if (quantityOnHand <= reorderLevel) return 'low';
    return 'ok';
  }
}
