import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddCustomerEmail1711000000012 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
