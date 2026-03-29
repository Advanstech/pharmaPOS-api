import { DataSource, Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { CreateSupplierInput, UpdateSupplierInput } from './dto/supplier.input';
import { SupplierRestockWatch } from './dto/supplier-watch.types';
export declare class SuppliersService {
    private readonly supplierRepo;
    private readonly dataSource;
    constructor(supplierRepo: Repository<Supplier>, dataSource: DataSource);
    listSuppliers(): Promise<Supplier[]>;
    getSupplierById(id: string): Promise<Supplier>;
    createSupplier(input: CreateSupplierInput): Promise<Supplier>;
    updateSupplier(id: string, input: UpdateSupplierInput): Promise<Supplier>;
    deleteSupplier(id: string): Promise<boolean>;
    getSupplierRestockWatch(branchId: string): Promise<SupplierRestockWatch[]>;
    private calcStockStatus;
    private suggestReorderQuantity;
}
