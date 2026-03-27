import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Repository, DataSource } from 'typeorm';
import { Subscription } from '../entities/subscription.entity';
import { SalesEffectiveAtService } from '../../sales/sales-effective-at.service';
export declare class SubscriptionGuard implements CanActivate {
    private readonly reflector;
    private readonly subscriptionRepo;
    private readonly dataSource;
    private readonly effectiveSaleAt;
    constructor(reflector: Reflector, subscriptionRepo: Repository<Subscription>, dataSource: DataSource, effectiveSaleAt: SalesEffectiveAtService);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private resolveOrganizationId;
    private assertUsageWithinLimits;
}
export declare const RequireFeature: (feature: string) => {
    (target: Function): void;
    (target: Object, propertyKey: string | symbol): void;
};
