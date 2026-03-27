import type { SubscriptionTier } from '../../config/constants';
export declare class Subscription {
    id: string;
    organizationId: string;
    tier: SubscriptionTier;
    status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'SUSPENDED';
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    trialEndsAt?: Date | null;
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}
