import { OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
export declare class SalesEffectiveAtService implements OnModuleInit {
    private readonly dataSource;
    private readonly logger;
    private hasSalesSoldAtColumn;
    constructor(dataSource: DataSource);
    onModuleInit(): Promise<void>;
    get hasSoldAt(): boolean;
    sql(tableAlias: string): string;
}
