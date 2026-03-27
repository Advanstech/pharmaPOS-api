export declare const APP_CONFIG: {
    readonly name: "PharmaPOS Pro";
    readonly client: "Azzay Pharmacy";
    readonly country: "GH";
    readonly timezone: "Africa/Accra";
    readonly currency: "GHS";
    readonly currencySymbol: "GH₵";
    readonly locale: "en-GH";
};
export declare const VAT_CONFIG: {
    readonly standardRate: 0.15;
    readonly prescriptionRate: 0;
    readonly vatAccountCode: "2200";
};
export declare const FDA_CONFIG: {
    readonly rxValidityDays: 30;
    readonly controlledDrugSignoffs: 2;
    readonly rxRetentionYears: 5;
};
export declare const GMDC_CONFIG: {
    readonly cacheTtlSeconds: 86400;
    readonly cacheKeyPrefix: "gmdc:";
};
export declare const SMS_CONFIG: {
    readonly senderId: "AZZAYPHARM";
    readonly maxPerCustomerPerDay: 5;
};
export declare const PAGINATION: {
    readonly defaultLimit: 20;
    readonly maxLimit: 100;
};
export declare const SUBSCRIPTION_TIERS: {
    readonly FREE: {
        readonly name: "Free";
        readonly maxBranches: 1;
        readonly maxUsers: 3;
        readonly maxProducts: 500;
        readonly maxSalesPerMonth: 1000;
        readonly features: readonly ["basic_pos", "inventory", "reports"];
        readonly priceGhs: 0;
    };
    readonly STARTER: {
        readonly name: "Starter";
        readonly maxBranches: 2;
        readonly maxUsers: 10;
        readonly maxProducts: 5000;
        readonly maxSalesPerMonth: 10000;
        readonly features: readonly ["basic_pos", "inventory", "reports", "multi_branch", "sms_notifications"];
        readonly priceGhs: 15000;
    };
    readonly PROFESSIONAL: {
        readonly name: "Professional";
        readonly maxBranches: 5;
        readonly maxUsers: 50;
        readonly maxProducts: 50000;
        readonly maxSalesPerMonth: 100000;
        readonly features: readonly ["basic_pos", "inventory", "reports", "multi_branch", "sms_notifications", "ai_insights", "supplier_scoring", "drug_interaction_checks", "priority_support"];
        readonly priceGhs: 50000;
    };
    readonly ENTERPRISE: {
        readonly name: "Enterprise";
        readonly maxBranches: 999;
        readonly maxUsers: 999;
        readonly maxProducts: 999999;
        readonly maxSalesPerMonth: 999999;
        readonly features: readonly ["basic_pos", "inventory", "reports", "multi_branch", "sms_notifications", "ai_insights", "supplier_scoring", "drug_interaction_checks", "priority_support", "custom_integrations", "dedicated_account_manager", "sla_99_9"];
        readonly priceGhs: 150000;
    };
};
export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;
