import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import {
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerOutput,
} from './dto/customer.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

/** Roles that may search / load a customer for POS attach (same branch). */
const CUSTOMER_POS_ROLES = [
  'owner',
  'se_admin',
  'manager',
  'head_pharmacist',
  'pharmacist',
  'technician',
  'cashier',
  'chemical_cashier',
] as const;

/** Roles that may browse the full branch customer list (dashboard). */
const CUSTOMER_LIST_ROLES = [
  'owner',
  'se_admin',
  'manager',
  'head_pharmacist',
  'pharmacist',
] as const;

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersResolver {
  constructor(private readonly customersService: CustomersService) {}

  @Query(() => CustomerOutput, { name: 'customer' })
  @Roles(...CUSTOMER_POS_ROLES)
  customer(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() actor: JwtUser,
  ): Promise<CustomerOutput> {
    return this.customersService.getCustomer(id, actor);
  }

  @Query(() => [CustomerOutput], { name: 'listCustomers' })
  @Roles(...CUSTOMER_LIST_ROLES)
  listCustomers(
    @CurrentUser() actor: JwtUser,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
  ): Promise<CustomerOutput[]> {
    return this.customersService.listCustomers(actor, limit, offset);
  }

  @Query(() => [CustomerOutput], { name: 'searchCustomers' })
  @Roles(...CUSTOMER_POS_ROLES)
  searchCustomers(
    @CurrentUser() actor: JwtUser,
    @Args('query') query: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<CustomerOutput[]> {
    return this.customersService.searchCustomers(actor, query, limit);
  }

  @Mutation(() => CustomerOutput, { name: 'createCustomer' })
  @Roles(...CUSTOMER_POS_ROLES)
  createCustomer(
    @Args('input') input: CreateCustomerInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<CustomerOutput> {
    return this.customersService.createCustomer(input, actor);
  }

  @Mutation(() => CustomerOutput, { name: 'updateCustomer' })
  @Roles(...CUSTOMER_LIST_ROLES)
  updateCustomer(
    @Args('input') input: UpdateCustomerInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<CustomerOutput> {
    return this.customersService.updateCustomer(input, actor);
  }
}
