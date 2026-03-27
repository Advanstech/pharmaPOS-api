import { SuppliersService } from './suppliers.service';
import { Supplier } from './entities/supplier.entity';
import { CreateSupplierInput, UpdateSupplierInput } from './dto/supplier.input';
import { SupplierRestockWatch } from './dto/supplier-watch.types';
import { JwtUser } from '../auth/decorators/current-user.decorator';
export declare class SuppliersResolver {
    private readonly suppliersService;
    constructor(suppliersService: SuppliersService);
    listSuppliers(): Promise<Supplier[]>;
    getSupplier(id: string): Promise<Supplier>;
    supplierRestockWatch(actor: JwtUser): Promise<SupplierRestockWatch[]>;
    createSupplier(input: CreateSupplierInput): Promise<Supplier>;
    updateSupplier(id: string, input: UpdateSupplierInput): Promise<Supplier>;
    deleteSupplier(id: string): Promise<boolean>;
}
