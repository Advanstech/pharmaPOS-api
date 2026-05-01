# Azzay Pharmacy Pro - Feature Roadmap V2
## Revolutionary Pharmaceutical POS System

## Vision
Transform Azzay Pharmacy's operations into a world-class SaaS platform that revolutionizes pharmaceutical inventory, accounting, and payment processing across West Africa.

---

## Phase 1: Invoice OCR & Intelligent Supplier Integration

### Problem Statement
Suppliers deliver goods with paper invoices. Staff manually enter:
- Invoice number, date, supplier details
- Item list with unit prices and quantities
- Total amounts

**Current pain**: Manual data entry is slow, error-prone, and doesn't capture product images.

### Solution: AI-Powered Invoice Processing

#### 1.1 Invoice Upload & OCR
```graphql
mutation UploadSupplierInvoice {
  uploadSupplierInvoice(input: {
    supplierId: "<supplier-uuid>"
    invoiceFile: Upload!  # PDF or Image (PNG, JPG)
    deliveryDate: "2026-04-10"
  }) {
    id
    status  # processing | completed | failed
    ocrJobId
    extractedData {
      invoiceNumber
      invoiceDate
      supplierName
      supplierAddress
      supplierPhone
      items {
        description
        quantity
        unitPrice
        totalPrice
      }
      subtotal
      vat
      totalAmount
      confidence  # 0-100 OCR confidence score
    }
    requiresReview  # true if confidence < 90
  }
}

# Check OCR processing status
query GetOcrJob {
  ocrJob(id: "<job-uuid>") {
    id
    status  # processing | completed | failed
    progress  # 0-100
    extractedData { ... }
    errors
  }
}
```

**OCR Technology Stack**:
- **Primary**: OpenAI GPT-4 Vision (best for invoices)
- **Fallback**: Google Cloud Vision API
- **Local**: Tesseract OCR (offline capability)

**Process Flow**:
1. Upload invoice (PDF/image) → S3
2. Queue OCR job (BullMQ)
3. Extract text with GPT-4 Vision
4. Parse structured data (invoice number, items, amounts)
5. Match supplier by name/phone
6. Auto-match products by description
7. Fetch product images for unmatched items
8. Present for review/confirmation

#### 1.2 Smart Product Matching
```graphql
mutation ReviewAndConfirmInvoice {
  reviewAndConfirmInvoice(input: {
    ocrJobId: "<job-uuid>"
    confirmedData: {
      invoiceNumber: "INV-2026-001234"
      invoiceDate: "2026-04-10"
      items: [
        {
          ocrDescription: "Paracetamol 500mg Tab x100"
          matchedProductId: "<product-uuid>"  # Auto-matched or manually selected
          quantity: 100
          unitPricePesewas: 1200
          batchNumber: "BATCH-2026-001"
          expiryDate: "2028-06-30"
          productImageUrl: "https://..."  # Auto-fetched via AI
        }
      ]
      totalAmountPesewas: 125000
    }
  }) {
    grnId  # Creates GRN automatically
    supplierInvoiceId
    stockUpdated  # true if inventory updated
    imagesProcessed  # Number of product images fetched
  }
}
```

**Smart Matching Algorithm**:
1. Fuzzy match product name (Levenshtein distance)
2. Match by barcode if present in OCR
3. Match by supplier + product history
4. Suggest top 3 matches with confidence scores
5. Allow manual selection if no match

#### 1.3 Supplier Payment Terms Tracking
```graphql
type SupplierInvoice {
  id: ID!
  invoiceNumber: String!
  invoiceDate: Date!
  dueDate: Date
  totalAmountPesewas: Int!
  paidAmountPesewas: Int!
  balancePesewas: Int!
  
  # Payment terms
  paymentTerms: PaymentTerms!  # IMMEDIATE | ON_DELIVERY | NET_7 | NET_30 | NET_60 | CUSTOM
  paymentStatus: PaymentStatus!  # UNPAID | PARTIAL | PAID | OVERDUE
  
  # Payment history
  payments: [SupplierPayment!]!
  
  # Aging
  daysOutstanding: Int!
  isOverdue: Boolean!
  overdueByDays: Int
  
  # Supplier relationship
  supplier: Supplier!
  grn: GRN
}

enum PaymentTerms {
  IMMEDIATE        # Pay on delivery
  ON_DELIVERY      # Pay when supplier returns
  NET_7            # 7 days
  NET_30           # 30 days
  NET_60           # 60 days
  CUSTOM           # Custom terms
}

enum PaymentStatus {
  UNPAID
  PARTIAL
  PAID
  OVERDUE
}
```

---

## Phase 2: Enhanced Accounting & Financial Intelligence

### 2.1 Staff Expenses Management

#### Current Gap
Staff incur expenses (fuel, utilities, supplies) but no proper tracking.

#### Solution: Comprehensive Expense Management
```graphql
mutation CreateStaffExpense {
  createStaffExpense(input: {
    category: FUEL  # FUEL | UTILITIES | SUPPLIES | TRANSPORT | MEALS | OTHER
    amountPesewas: 15000
    description: "Fuel for delivery van - April 10"
    receiptImage: Upload!  # Photo of receipt
    expenseDate: "2026-04-10"
    merchantName: "Shell Petrol Station"
    paymentMethod: CASH  # CASH | MOMO | PERSONAL_CARD
  }) {
    id
    status  # PENDING | APPROVED | REJECTED | REIMBURSED
    amountFormatted
    receiptUrl
    ocrExtractedAmount  # Auto-extracted from receipt
    requiresApproval
  }
}

# Manager/Owner approval workflow
mutation ApproveExpense {
  approveExpense(input: {
    expenseId: "<expense-uuid>"
    action: APPROVE  # APPROVE | REJECT
    notes: "Approved - valid receipt"
    reimbursementMethod: MOMO  # CASH | MOMO | BANK_TRANSFER
  }) {
    id
    status
    approvedBy
    approvedAt
    reimbursementScheduled
  }
}

# Expense analytics
query ExpenseAnalytics {
  expenseAnalytics(
    periodStart: "2026-04-01"
    periodEnd: "2026-04-30"
  ) {
    totalExpensesPesewas
    totalExpensesFormatted
    byCategory {
      category
      amountPesewas
      amountFormatted
      count
      percentOfTotal
    }
    byStaff {
      staffId
      staffName
      amountPesewas
      count
    }
    pendingApprovalCount
    pendingReimbursementPesewas
  }
}
```

### 2.2 AI Financial Intelligence (CFO Assistant)

#### Supplier Payment Intelligence
```graphql
query SupplierPaymentIntelligence {
  supplierPaymentIntelligence(supplierId: "<supplier-uuid>") {
    supplier {
      id
      name
      paymentTerms
      creditLimitPesewas
    }
    
    # Current position
    totalOutstandingPesewas
    totalOutstandingFormatted
    overdueAmountPesewas
    overdueAmountFormatted
    creditUtilizationPct  # % of credit limit used
    
    # Invoices breakdown
    unpaidInvoices {
      invoiceNumber
      amountPesewas
      dueDate
      daysOutstanding
      isOverdue
    }
    
    # Payment history
    paymentHistory {
      averagePaymentDelayDays
      onTimePaymentRate  # %
      totalPaidLast30Days
      totalPaidLast90Days
    }
    
    # AI Recommendations
    aiRecommendation {
      action  # PAY_NOW | PAY_PARTIAL | NEGOTIATE | WAIT
      reason
      suggestedAmount
      suggestedDate
      priority  # CRITICAL | HIGH | MEDIUM | LOW
      riskLevel  # HIGH | MEDIUM | LOW
    }
    
    # Cash flow impact
    cashFlowImpact {
      currentCashPesewas
      projectedCashAfterPayment
      cashRunwayDays
      safeToPayNow
    }
  }
}

# Comprehensive financial dashboard
query FinancialIntelligenceDashboard {
  financialIntelligence {
    # Cash position
    cashPosition {
      currentCashPesewas
      currentCashFormatted
      cashInBankPesewas
      momoFloatPesewas
      totalLiquidAssets
    }
    
    # Payables
    accountsPayable {
      totalOutstandingPesewas
      dueIn7DaysPesewas
      dueIn30DaysPesewas
      overduePesewas
      criticalSuppliersCount
    }
    
    # Receivables
    accountsReceivable {
      totalOutstandingPesewas
      dueIn7DaysPesewas
      overdueCustomersPesewas
    }
    
    # Revenue & Profitability
    performance {
      revenue30DaysPesewas
      revenue30DaysFormatted
      grossProfitMarginPct
      netProfitMarginPct
      burnRatePesewasPerDay
    }
    
    # AI Insights
    aiInsights {
      cashRunwayDays
      recommendedActions {
        priority
        action
        reason
        estimatedImpact
      }
      alerts {
        severity  # CRITICAL | WARNING | INFO
        message
        actionRequired
      }
    }
    
    # Forecasting
    forecast {
      projectedRevenue7Days
      projectedRevenue30Days
      projectedCashPosition7Days
      projectedCashPosition30Days
      confidenceLevel  # 0-100
    }
  }
}
```

### 2.3 Supplier Invoice Aging & Payment Tracking
```graphql
query SupplierInvoiceAging {
  supplierInvoiceAging {
    current {  # 0-30 days
      count
      totalPesewas
      totalFormatted
    }
    days30to60 {
      count
      totalPesewas
      totalFormatted
    }
    days60to90 {
      count
      totalPesewas
      totalFormatted
    }
    over90Days {
      count
      totalPesewas
      totalFormatted
    }
    
    # By supplier
    bySupplier {
      supplierId
      supplierName
      totalOutstanding
      oldestInvoiceDate
      oldestInvoiceDays
      riskLevel  # HIGH | MEDIUM | LOW
    }
  }
}

# Part payment tracking
mutation RecordPartPayment {
  recordPartPayment(input: {
    invoiceId: "<invoice-uuid>"
    amountPesewas: 50000  # Partial payment
    paymentMethod: MOMO
    momoReference: "MOMO-TXN-123456"
    notes: "Part payment - balance to be paid next week"
  }) {
    invoice {
      invoiceNumber
      totalAmountPesewas
      paidAmountPesewas
      balancePesewas
      paymentStatus  # PARTIAL
      payments {
        id
        amountPesewas
        paymentMethod
        reference
        paidAt
      }
    }
    remainingBalance
    percentagePaid
  }
}
```

---

## Phase 3: Mobile Money Integration (Ghana)

### 3.1 MoMo Payment Collection

#### Supported Providers
- MTN Mobile Money (Ghana)
- Vodafone Cash
- AirtelTigo Money

#### Payment Flow
```graphql
mutation InitiateMomoPayment {
  initiateMomoPayment(input: {
    saleId: "<sale-uuid>"  # Link to sale
    provider: MTN_MOMO  # MTN_MOMO | VODAFONE_CASH | AIRTELTIGO_MONEY
    customerPhone: "+233244000001"
    amountPesewas: 5000
    description: "Sale payment - Invoice #INV-2026-001"
  }) {
    transactionId
    referenceId  # Provider reference
    status  # PENDING | PROCESSING
    promptMessage  # "Check your phone for payment prompt"
    expiresAt
  }
}

# Check payment status
query MomoPaymentStatus {
  momoPaymentStatus(transactionId: "<txn-uuid>") {
    transactionId
    status  # PENDING | SUCCESS | FAILED | EXPIRED
    amountPesewas
    provider
    customerPhone
    providerReference
    completedAt
    failureReason
  }
}

# Webhook callback (internal - called by MoMo provider)
# POST /webhooks/momo/callback
# {
#   "transaction_id": "...",
#   "status": "SUCCESS",
#   "amount": 50.00,
#   "reference": "MOMO-TXN-123456",
#   "customer_phone": "+233244000001"
# }
```

#### MoMo Transaction History
```graphql
query MomoTransactionHistory {
  momoTransactions(
    periodStart: "2026-04-01"
    periodEnd: "2026-04-30"
    provider: MTN_MOMO
  ) {
    transactions {
      id
      transactionId
      provider
      customerPhone
      amountPesewas
      amountFormatted
      status
      saleId
      sale {
        id
        totalFormatted
        items { productName quantity }
      }
      providerReference
      createdAt
      completedAt
    }
    
    summary {
      totalTransactions
      successfulTransactions
      failedTransactions
      totalAmountPesewas
      totalAmountFormatted
      averageTransactionSize
      
      byProvider {
        provider
        count
        totalAmount
      }
    }
  }
}
```

### 3.2 Enhanced Sale Receipt with Payment Method
```graphql
type Sale {
  id: ID!
  totalPesewas: Int!
  totalFormatted: String!
  
  # Enhanced payment tracking
  tenders: [SaleTender!]!
  paymentSummary: PaymentSummary!
  
  # Receipt generation
  receiptUrl: String  # PDF receipt URL
  receiptNumber: String!
}

type SaleTender {
  id: ID!
  method: PaymentMethod!
  amountPesewas: Int!
  amountFormatted: String!
  
  # MoMo specific
  momoProvider: MomoProvider
  momoReference: String
  momoPhone: String
  momoTransactionId: String
  
  # Cash specific
  cashReceivedPesewas: Int
  changePesewas: Int
  
  # Card specific
  cardLast4: String
  cardType: String
  
  createdAt: DateTime!
}

type PaymentSummary {
  totalPesewas: Int!
  cashPesewas: Int!
  momoPesewas: Int!
  cardPesewas: Int!
  
  breakdown {
    method: PaymentMethod!
    amountPesewas: Int!
    amountFormatted: String!
    percentage: Float!
  }
}

enum PaymentMethod {
  CASH
  MTN_MOMO
  VODAFONE_CASH
  AIRTELTIGO_MONEY
  CARD
  BANK_TRANSFER
  SPLIT
}
```

### 3.3 MoMo Reconciliation
```graphql
query MomoReconciliation {
  momoReconciliation(date: "2026-04-10") {
    date
    
    # System records
    systemTotal {
      transactionCount
      totalAmountPesewas
      totalAmountFormatted
    }
    
    # Provider records (from API)
    providerTotal {
      transactionCount
      totalAmountPesewas
      totalAmountFormatted
    }
    
    # Discrepancies
    discrepancies {
      transactionId
      systemAmount
      providerAmount
      difference
      status
      reason
    }
    
    # Reconciliation status
    isReconciled: Boolean!
    variancePesewas: Int!
    varianceFormatted: String!
  }
}
```

---

## Phase 4: SaaS Onboarding & API Keys

### 4.1 Multi-Tenant Onboarding
```graphql
mutation RegisterOrganization {
  registerOrganization(input: {
    organizationName: "Kofi Pharmacy"
    ownerName: "Kofi Mensah"
    ownerEmail: "kofi@kofipharmacy.com"
    ownerPhone: "+233244000002"
    businessType: PHARMACY  # PHARMACY | CHEMICAL_SHOP | BOTH
    country: "GH"
    timezone: "Africa/Accra"
    
    # Subscription
    subscriptionTier: STARTER  # FREE | STARTER | PROFESSIONAL | ENTERPRISE
    paymentMethod: STRIPE  # STRIPE | PAYSTACK | FLUTTERWAVE
  }) {
    organizationId
    ownerId
    temporaryPassword
    apiKey  # For integrations
    webhookSecret
    
    # Onboarding checklist
    onboardingSteps {
      step
      completed
      url
    }
  }
}
```

### 4.2 API Key Management
```graphql
type ApiKey {
  id: ID!
  name: String!
  key: String!  # Only shown once on creation
  keyPrefix: String!  # "pk_live_..." for display
  environment: Environment!  # PRODUCTION | SANDBOX
  permissions: [Permission!]!
  rateLimit: Int!  # Requests per minute
  isActive: Boolean!
  lastUsedAt: DateTime
  expiresAt: DateTime
  createdAt: DateTime!
}

mutation CreateApiKey {
  createApiKey(input: {
    name: "POS Integration"
    environment: PRODUCTION
    permissions: [READ_PRODUCTS, CREATE_SALES, READ_INVENTORY]
    rateLimit: 1000
    expiresAt: "2027-04-10"
  }) {
    apiKey {
      id
      name
      key  # "pk_live_abc123..." - ONLY shown once
      keyPrefix
    }
    warning: "Store this key securely - it won't be shown again"
  }
}

mutation RevokeApiKey {
  revokeApiKey(apiKeyId: "<key-uuid>") {
    success
    message
  }
}
```

### 4.3 Subscription & Billing (Stripe/Paystack)
```graphql
type Subscription {
  id: ID!
  organizationId: ID!
  tier: SubscriptionTier!
  status: SubscriptionStatus!
  
  # Limits
  limits {
    maxUsers: Int!
    maxProducts: Int!
    maxSalesPerMonth: Int!
    maxBranches: Int!
    apiRateLimit: Int!
  }
  
  # Usage
  currentUsage {
    users: Int!
    products: Int!
    salesThisMonth: Int!
    branches: Int!
  }
  
  # Billing
  currentPeriodStart: DateTime!
  currentPeriodEnd: DateTime!
  nextBillingDate: DateTime!
  amountPesewas: Int!
  amountFormatted: String!
  
  # Payment
  paymentMethod: PaymentMethod!
  stripeCustomerId: String
  paystackCustomerCode: String
}

mutation UpgradeSubscription {
  upgradeSubscription(input: {
    newTier: PROFESSIONAL
    paymentMethod: STRIPE
  }) {
    subscription {
      tier
      amountPesewas
      nextBillingDate
    }
    paymentUrl  # Redirect to Stripe/Paystack
  }
}
```

---

## Implementation Priority

### Week 1-2: Invoice OCR & Supplier Integration
- [ ] Invoice upload endpoint
- [ ] GPT-4 Vision OCR integration
- [ ] Smart product matching algorithm
- [ ] Auto product image fetching
- [ ] GRN creation from OCR data
- [ ] Supplier payment terms tracking

### Week 3-4: Enhanced Accounting
- [ ] Staff expense management
- [ ] Expense approval workflow
- [ ] Supplier payment intelligence
- [ ] Financial dashboard with AI insights
- [ ] Invoice aging reports
- [ ] Part payment tracking

### Week 5-6: Mobile Money Integration
- [ ] MTN MoMo API integration
- [ ] Vodafone Cash API integration
- [ ] AirtelTigo Money API integration
- [ ] Payment webhook handling
- [ ] Transaction history & reconciliation
- [ ] Enhanced receipt generation

### Week 7-8: SaaS Onboarding
- [ ] Multi-tenant registration
- [ ] API key management
- [ ] Stripe/Paystack integration
- [ ] Subscription management
- [ ] Usage tracking & limits
- [ ] Billing automation

---

## Success Metrics

### Operational Efficiency
- **Invoice processing time**: 5 minutes → 30 seconds (90% reduction)
- **Data entry errors**: 15% → <1% (OCR accuracy)
- **Product image coverage**: 50% → 95% (automated)

### Financial Intelligence
- **Payment decision time**: 2 hours → 5 minutes (AI recommendations)
- **Cash flow visibility**: Weekly → Real-time
- **Supplier relationship**: Reactive → Proactive

### Payment Processing
- **MoMo transaction success rate**: >95%
- **Payment reconciliation**: Manual → Automated
- **Customer payment options**: Cash only → Multi-channel

### SaaS Growth
- **Onboarding time**: 2 days → 15 minutes
- **Time to first sale**: 1 week → 1 hour
- **Customer acquisition cost**: Reduce by 60%

---

**Status**: 📋 ROADMAP DEFINED
**Next**: Implementation Phase 1 - Invoice OCR
