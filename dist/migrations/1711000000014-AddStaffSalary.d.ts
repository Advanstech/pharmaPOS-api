import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddStaffSalary1711000000014 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
