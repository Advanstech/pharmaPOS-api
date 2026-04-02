import { DataSource } from 'typeorm';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { CreateCustomerInput, UpdateCustomerInput, CustomerOutput } from './dto/customer.types';
export declare class CustomersService {
    private readonly dataSource;
    private readonly logger;
    private readonly encryptionKey;
    constructor(dataSource: DataSource);
    private assertCanRead;
    private assertCanSearch;
    private assertCanCreate;
    private assertCanUpdate;
    private hashPhone;
    private allocateCustomerCode;
    private mapRow;
    createCustomer(input: CreateCustomerInput, actor: JwtUser): Promise<CustomerOutput>;
    updateCustomer(input: UpdateCustomerInput, actor: JwtUser): Promise<CustomerOutput>;
    private getOrganizationIdForBranch;
    private getCustomerRow;
    getCustomer(id: string, actor: JwtUser): Promise<CustomerOutput>;
    listCustomers(actor: JwtUser, limit?: number, offset?: number): Promise<CustomerOutput[]>;
    searchCustomers(actor: JwtUser, query: string, limit?: number): Promise<CustomerOutput[]>;
}
