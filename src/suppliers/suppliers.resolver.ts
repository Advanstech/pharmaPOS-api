import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SuppliersService } from './suppliers.service';
import { Supplier } from './entities/supplier.entity';
import { CreateSupplierInput, UpdateSupplierInput } from './dto/supplier.input';
import { SupplierRestockWatch, SupplierWithProducts } from './dto/supplier-watch.types';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@ApiTags('suppliers')
@ApiBearerAuth('JWT')
@Resolver(() => Supplier)
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuppliersResolver {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Query(() => [Supplier], { name: 'suppliers' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician', 'cashier', 'chemical_cashier')
  @ApiOperation({ summary: 'List all suppliers with full traceability chain' })
  async listSuppliers(): Promise<Supplier[]> {
    return this.suppliersService.listSuppliers();
  }

  @Query(() => Supplier, { name: 'supplier' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician', 'cashier', 'chemical_cashier')
  @ApiOperation({ summary: 'Get supplier by ID' })
  async getSupplier(@Args('id') id: string): Promise<Supplier> {
    return this.suppliersService.getSupplierById(id);
  }

  @Query(() => [SupplierRestockWatch], { name: 'supplierRestockWatch' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician', 'cashier', 'chemical_cashier')
  @ApiOperation({ summary: 'Branch supplier restock watch with low/critical/out stock signals' })
  async supplierRestockWatch(@CurrentUser() actor: JwtUser): Promise<SupplierRestockWatch[]> {
    return this.suppliersService.getSupplierRestockWatch(actor.branchId);
  }

  @Query(() => SupplierWithProducts, { name: 'supplierWithProducts' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'pharmacist', 'technician', 'cashier', 'chemical_cashier')
  @ApiOperation({ summary: 'Get supplier with ALL their products (not just stock alerts)' })
  async getSupplierWithProducts(
    @Args('id') id: string,
    @CurrentUser() actor: JwtUser,
  ): Promise<SupplierWithProducts> {
    return this.suppliersService.getSupplierWithProducts(id, actor.branchId);
  }

  @Mutation(() => Supplier)
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist')
  @ApiOperation({ summary: 'Create new supplier (owner/se_admin/manager/head pharmacist)' })
  async createSupplier(@Args('input') input: CreateSupplierInput): Promise<Supplier> {
    return this.suppliersService.createSupplier(input);
  }

  @Mutation(() => Supplier)
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist')
  @ApiOperation({ summary: 'Update supplier details (owner/se_admin/manager/head pharmacist)' })
  async updateSupplier(
    @Args('id') id: string,
    @Args('input') input: UpdateSupplierInput,
  ): Promise<Supplier> {
    return this.suppliersService.updateSupplier(id, input);
  }

  @Mutation(() => Boolean)
  @Roles('owner', 'se_admin', 'manager')
  @ApiOperation({ summary: 'Soft delete supplier (owner/manager)' })
  async deleteSupplier(@Args('id') id: string): Promise<boolean> {
    return this.suppliersService.deleteSupplier(id);
  }

  @Mutation(() => Boolean)
  @Roles('owner', 'se_admin', 'manager')
  @ApiOperation({ summary: 'Suspend supplier — hides from active lists but keeps history' })
  async suspendSupplier(@Args('id') id: string): Promise<boolean> {
    return this.suppliersService.suspendSupplier(id);
  }

  @Mutation(() => Boolean)
  @Roles('owner', 'se_admin', 'manager')
  @ApiOperation({ summary: 'Reactivate a suspended supplier' })
  async reactivateSupplier(@Args('id') id: string): Promise<boolean> {
    return this.suppliersService.reactivateSupplier(id);
  }

  @Mutation(() => Boolean)
  @Roles('owner', 'se_admin', 'manager')
  @ApiOperation({ summary: 'Deactivate supplier AND all their products' })
  async deleteSupplierWithProducts(@Args('id') id: string): Promise<boolean> {
    return this.suppliersService.deleteSupplierWithProducts(id);
  }
}
