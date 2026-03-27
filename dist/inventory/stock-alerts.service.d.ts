import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeStockService } from './realtime-stock.service';
export declare class StockAlertsService implements OnModuleInit, OnModuleDestroy {
    private readonly realtimeStock;
    private readonly notifications;
    private readonly dataSource;
    private readonly cache;
    private readonly logger;
    private unsubscribe;
    constructor(realtimeStock: RealtimeStockService, notifications: NotificationsService, dataSource: DataSource, cache: Cache);
    onModuleInit(): void;
    onModuleDestroy(): void;
    private processStockEvent;
    private suggestReorderQty;
    private normalizeGhPhone;
}
