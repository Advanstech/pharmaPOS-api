import { CustomersService } from './customers.service';
import { CreateCustomerInput, UpdateCustomerInput, CustomerOutput } from './dto/customer.types';
import { JwtUser } from '../auth/decorators/current-user.decorator';
export declare class CustomersResolver {
    private readonly customersService;
    constructor(customersService: CustomersService);
    customer(id: string, actor: JwtUser): Promise<CustomerOutput>;
    listCustomers(actor: JwtUser, limit?: number, offset?: number): Promise<CustomerOutput[]>;
    searchCustomers(actor: JwtUser, query: string, limit?: number): Promise<CustomerOutput[]>;
    createCustomer(input: CreateCustomerInput, actor: JwtUser): Promise<CustomerOutput>;
    updateCustomer(input: UpdateCustomerInput, actor: JwtUser): Promise<CustomerOutput>;
}
