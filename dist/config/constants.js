"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUBSCRIPTION_TIERS = exports.PAGINATION = exports.SMS_CONFIG = exports.GMDC_CONFIG = exports.FDA_CONFIG = exports.VAT_CONFIG = exports.APP_CONFIG = void 0;
exports.APP_CONFIG = {
    name: 'PharmaPOS Pro',
    client: 'Azzay Pharmacy',
    country: 'GH',
    timezone: 'Africa/Accra',
    currency: 'GHS',
    currencySymbol: 'GH₵',
    locale: 'en-GH',
};
exports.VAT_CONFIG = {
    standardRate: 0.15,
    prescriptionRate: 0,
    vatAccountCode: '2200',
};
exports.FDA_CONFIG = {
    rxValidityDays: 30,
    controlledDrugSignoffs: 2,
    rxRetentionYears: 5,
};
exports.GMDC_CONFIG = {
    cacheTtlSeconds: 86400,
    cacheKeyPrefix: 'gmdc:',
};
exports.SMS_CONFIG = {
    senderId: 'AZZAYPHARM',
    maxPerCustomerPerDay: 5,
};
exports.PAGINATION = {
    defaultLimit: 20,
    maxLimit: 100,
};
exports.SUBSCRIPTION_TIERS = {
    FREE: {
        name: 'Free',
        maxBranches: 1,
        maxUsers: 3,
        maxProducts: 500,
        maxSalesPerMonth: 1000,
        features: ['basic_pos', 'inventory', 'reports'],
        priceGhs: 0,
    },
    STARTER: {
        name: 'Starter',
        maxBranches: 2,
        maxUsers: 10,
        maxProducts: 5000,
        maxSalesPerMonth: 10000,
        features: ['basic_pos', 'inventory', 'reports', 'multi_branch', 'sms_notifications'],
        priceGhs: 15000,
    },
    PROFESSIONAL: {
        name: 'Professional',
        maxBranches: 5,
        maxUsers: 50,
        maxProducts: 50000,
        maxSalesPerMonth: 100000,
        features: [
            'basic_pos',
            'inventory',
            'reports',
            'multi_branch',
            'sms_notifications',
            'ai_insights',
            'supplier_scoring',
            'drug_interaction_checks',
            'priority_support',
        ],
        priceGhs: 50000,
    },
    ENTERPRISE: {
        name: 'Enterprise',
        maxBranches: 999,
        maxUsers: 999,
        maxProducts: 999999,
        maxSalesPerMonth: 999999,
        features: [
            'basic_pos',
            'inventory',
            'reports',
            'multi_branch',
            'sms_notifications',
            'ai_insights',
            'supplier_scoring',
            'drug_interaction_checks',
            'priority_support',
            'custom_integrations',
            'dedicated_account_manager',
            'sla_99_9',
        ],
        priceGhs: 150000,
    },
};
//# sourceMappingURL=constants.js.map