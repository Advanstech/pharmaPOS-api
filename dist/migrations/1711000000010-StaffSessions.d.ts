import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class StaffSessions1711000000010 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
