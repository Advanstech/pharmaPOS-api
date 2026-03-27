/**
 * PharmaPOS Pro — API configuration constants
 * Inlined from packages/config — no workspace dependency at deploy time
 * Never put secrets here — use environment variables
 */

export const APP_CONFIG = {
  name: 'PharmaPOS Pro',
  client: 'Azzay Pharmacy',
  country: 'GH',
  timezone: 'Africa/Accra',
  currency: 'GHS',
  currencySymbol: 'GH₵',
  locale: 'en-GH',
} as const;

// Ghana GRA VAT rates
export const VAT_CONFIG = {
  standardRate: 0.15,       // 12.5% VAT + 2.5% NHIL
  prescriptionRate: 0,      // Rx medicines are VAT exempt
  vatAccountCode: '2200',   // GL account for VAT
} as const;

// Ghana FDA compliance constants
export const FDA_CONFIG = {
  rxValidityDays: 30,             // Rx expires exactly 30 days from prescribed_date
  controlledDrugSignoffs: 2,      // Two pharmacist sign-offs required
  rxRetentionYears: 5,            // Minimum S3 retention for dispensed Rx PDFs
} as const;

// GMDC API
export const GMDC_CONFIG = {
  cacheTtlSeconds: 86_400,        // 24h Redis TTL
  cacheKeyPrefix: 'gmdc:',
} as const;

// Hubtel SMS (Ghana-native)
export const SMS_CONFIG = {
  senderId: 'AZZAYPHARM',         // NCA pre-approved sender ID
  maxPerCustomerPerDay: 5,        // Rate-limit in Redis
} as const;

// Pagination defaults
export const PAGINATION = {
  defaultLimit: 20,
  maxLimit: 100,
} as const;

// SaaS subscription tiers
export const SUBSCRIPTION_TIERS = {
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
    priceGhs: 15000, // GH₵150/month in pence
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
    priceGhs: 50000, // GH₵500/month in pence
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
    priceGhs: 150000, // GH₵1500/month in pence — custom pricing available
  },
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;
