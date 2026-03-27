export declare class SubscriptionUsageSnapshot {
    branches: number;
    users: number;
    products: number;
    sales: number;
}
export declare class SubscriptionLimitSnapshot {
    branches: number;
    users: number;
    products: number;
    sales: number;
}
export declare class SubscriptionOverview {
    tier: string;
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    usage: SubscriptionUsageSnapshot;
    limits: SubscriptionLimitSnapshot;
}
