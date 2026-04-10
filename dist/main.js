"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const nest_winston_1 = require("nest-winston");
const swagger_1 = require("@nestjs/swagger");
const winston = require("winston");
const helmet_1 = require("helmet");
const cors_origins_1 = require("./config/cors-origins");
const GQL_REFERENCE = `
---

## Primary API: GraphQL

> All business operations use GraphQL at \`/graphql\`.
> Use the [GraphQL Playground](/graphql) to explore and test interactively.
> Every operation requires \`Authorization: Bearer <access_token>\` in the HTTP header
> (except \`login\`, \`register\`, \`refreshToken\`).

---

## Authentication Flow

\`\`\`graphql
# 1. Login — returns access_token (15 min) + refresh_token (30 days)
mutation Login {
  login(input: {
    email: "cashier@azzaypharmacy.com"
    password: "••••••••"
  }) {
    access_token   # Store in memory — NEVER localStorage
    refresh_token  # Store in httpOnly cookie
    expires_in     # Always 900 (seconds)
    user {
      id name role
    }
  }
}

# Example Response:
# {
#   "data": {
#     "login": {
#       "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#       "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#       "expires_in": 900,
#       "user": {
#         "id": "550e8400-e29b-41d4-a716-446655440000",
#         "name": "Kwame Cashier",
#         "role": "cashier"
#       }
#     }
#   }
# }

# 2. Refresh — call before access_token expires
mutation Refresh {
  refreshToken(token: "<refresh_token>") {
    access_token
    refresh_token
    expires_in
  }
}

# 3. Logout — invalidates the session server-side
mutation Logout {
  logout
}

# Example Response:
# {
#   "data": {
#     "logout": true
#   }
# }

# 4. Current user
query Me {
  me {
    id name email role branch_id is_active
  }
}

# Example Response:
# {
#   "data": {
#     "me": {
#       "id": "550e8400-e29b-41d4-a716-446655440000",
#       "name": "Kwame Cashier",
#       "email": "cashier@azzaypharmacy.com",
#       "role": "cashier",
#       "branch_id": "660e8400-e29b-41d4-a716-446655440000",
#       "is_active": true
#     }
#   }
# }
\`\`\`

**Error codes from auth:**
| Code | Meaning |
|------|---------|
| \`UNAUTHENTICATED\` | Missing or expired JWT |
| \`FORBIDDEN\` | Role not permitted for this operation |
| \`CONFLICT\` | Email already registered |

**Example Error Response**:
\`\`\`json
{
  "errors": [{
    "message": "Invalid credentials",
    "extensions": {
      "code": "UNAUTHENTICATED",
      "statusCode": 401
    }
  }]
}
\`\`\`

---

## Products & Search

\`\`\`graphql
# Search products — used by POS search bar (min 2 chars)
query SearchProducts {
  searchProducts(
    query: "amoxicillin"
    branchId: "<branch-uuid>"
    limit: 20
  ) {
    id
    name
    genericName
    barcode
    unitPrice          # GHS pesewas — e.g. 1250 = GH₵12.50
    classification     # OTC | POM | CONTROLLED
    branchType         # pharmaceutical | chemical | both
    requiresRx         # true = POM — must have approved Rx before sale
    vatExempt          # true = VAT exempt (Rx medicines)
    image {
      cdnUrl urlThumb source isApproved
    }
    inventory {
      quantityOnHand reorderLevel
      batches { batchNumber quantity expiryDate }
    }
    supplier {
      id name aiScore
    }
  }
}
\`\`\`

> **POM products:** \`requiresRx: true\` — the UI must show the amber POM badge
> and block "Add to Sale" until a verified prescription is linked.
> The API enforces this at the guard level regardless of UI state.

---

## Sales (POS Checkout)

\`\`\`graphql
# Create a sale — the core POS checkout mutation
# Ghana FDA: PomEnforcementGuard runs before this — cannot be bypassed
# Ghana GRA: VAT calculated automatically (15% on non-exempt items)
mutation CreateSale {
  createSale(input: {
    idempotencyKey: "<client-generated-uuid-v4>"  # Reuse on retry — prevents duplicates
    items: [
      {
        productId: "<product-uuid>"
        quantity: 2
        # prescriptionId required when requiresRx = true
        prescriptionId: "<rx-uuid>"
      }
    ]
    tenders: [
      { method: CASH, amountPesewas: 5000 }
      # Split payment example:
      # { method: MTN_MOMO, amountPesewas: 3000, momoReference: "GH-MOMO-REF" }
    ]
    customerId: "<customer-uuid>"  # Optional for walk-in
  }) {
    id
    totalPesewas      # Total in GHS pesewas
    vatPesewas        # VAT portion (Ghana GRA)
    totalFormatted    # "GH₵50.00" — always GH₵, never USD
    status            # COMPLETED
    idempotencyKey
    createdAt
    items {
      productId productName quantity
      unitPricePesewas vatExempt supplierId
    }
  }
}

# Get a single sale by ID
query GetSale {
  sale(id: "<sale-uuid>") {
    id totalPesewas vatPesewas totalFormatted status createdAt
    items { productName quantity unitPricePesewas }
  }
}

# Recent sales for the current branch (last 20 by default)
query RecentSales {
  recentSales(limit: 20) {
    id totalFormatted status createdAt
  }
}

# Daily summary — manager/owner only
query DailySummary {
  dailySummary(date: "2026-03-22") {
    salesCount
    totalRevenuePesewas
    totalRevenueFormatted   # "GH₵4,250.00"
    vatCollectedPesewas
    averageSaleGhs
  }
}
\`\`\`

**Payment methods:** \`CASH\` | \`MTN_MOMO\` | \`VODAFONE_CASH\` | \`AIRTELTIGO_MONEY\` | \`CARD\` | \`SPLIT\`

**Sale error codes:**
| Code | Meaning |
|------|---------|
| \`FDA_POM_VIOLATION\` | POM product in cart without approved Rx |
| \`BAD_REQUEST\` | Insufficient stock or tender < total |
| \`NOT_FOUND\` | Product not found or inactive |

---

## Pharmacy & Prescriptions

> **Pharmaceutical branch only.** Chemical shop branches are hard-blocked by \`BranchTypeGuard\`.

\`\`\`graphql
# Validate a prescriber's GMDC licence before creating Rx
# Cached 24h in Redis — never blocks due to GMDC API outage
query ValidateGmdcLicence {
  validateGmdcLicence(licenceNo: "GMDC-2024-001234") {
    licenceNo
    valid    # false → hard block with GMDC_INVALID_LICENCE
    cached   # true = served from Redis cache
  }
}

# Create a prescription
# Ghana FDA: GMDC licence validated live on creation
# Rx expiry = prescribedDate + 30 days (never extendable)
mutation CreatePrescription {
  createPrescription(input: {
    customerId: "<customer-uuid>"
    prescriberLicenceNo: "GMDC-2024-001234"
    prescriberName: "Dr. Kwame Asante"
    prescribedDate: "2026-03-22"
    items: [
      {
        productId: "<pom-product-uuid>"
        quantity: 14
        dosageInstructions: "Take 1 tablet twice daily after meals for 7 days"
      }
    ]
  }) {
    id status expiryDate approvalCount
    prescriberName prescriberLicenceNo
    items { productName quantity dosageInstructions }
  }
}

# Verify (approve) a prescription — pharmacist/head_pharmacist only
# Controlled drugs: must be called twice (approvalCount must reach 2)
mutation VerifyPrescription {
  verifyPrescription(input: {
    prescriptionId: "<rx-uuid>"
    notes: "Verified — patient ID checked"
  }) {
    id status approvalCount
  }
}

# Get a single prescription
query GetPrescription {
  prescription(id: "<rx-uuid>") {
    id status expiryDate approvalCount
    prescriberName prescriberLicenceNo prescribedDate
    items { productName quantity dosageInstructions }
  }
}

# Pending prescriptions awaiting verification
query PendingPrescriptions {
  pendingPrescriptions {
    id prescriberName prescribedDate expiryDate
    items { productName quantity }
  }
}
\`\`\`

**Prescription status lifecycle:** \`PENDING\` → \`VERIFIED\` → \`DISPENSED\` | \`EXPIRED\` | \`CANCELLED\`

**Pharmacy error codes:**
| Code | Meaning |
|------|---------|
| \`GMDC_INVALID_LICENCE\` | Prescriber licence expired or not found |
| \`FDA_RX_EXPIRED\` | Rx is older than 30 days |
| \`FDA_CONTROLLED_DRUG_INSUFFICIENT_SIGNOFFS\` | Controlled drug needs 2 pharmacist approvals |
| \`FORBIDDEN\` | Chemical branch attempted Rx operation |

---

## Inventory & GRN (Goods Received Note)

\`\`\`graphql
# Full inventory list for current branch
query Inventory {
  inventory {
    productId productName classification
    quantityOnHand reorderLevel
    stockStatus    # ok | low | critical | out
    nearestExpiry
    supplierId supplierName
  }
}

# Low stock alerts — products at or below reorder level
query LowStockAlerts {
  lowStockAlerts {
    productId productName
    quantityOnHand reorderLevel status
  }
}

# Stock movement history for a product
query StockMovements {
  stockMovements(productId: "<product-uuid>", limit: 50) {
    id movementType quantity batchNumber expiryDate createdAt
  }
}

# Receive stock from a supplier (positive delta)
# Roles: owner, se_admin, manager, head_pharmacist, technician
mutation ReceiveStock {
  receiveStock(input: {
    productId: "<product-uuid>"
    quantity: 100
    batchNumber: "BATCH-2026-001"
    expiryDate: "2028-06-30"
    purchaseOrderId: "PO-2026-042"
  }) {
    productId productName quantityOnHand stockStatus
  }
}

# Manual stock adjustment (write-off, correction)
# Roles: owner, se_admin, manager, head_pharmacist
mutation AdjustStock {
  adjustStock(input: {
    productId: "<product-uuid>"
    quantityDelta: -5    # Negative = write-off, Positive = correction
    reason: "Damaged stock — broken vials"
    batchNumber: "BATCH-2026-001"
  }) {
    productId productName quantityOnHand stockStatus
  }
}

# ── GRN Workflow (Ghana supplier credit workflow) ────────────────────────

# Create a Goods Received Note — records stock arrival from supplier with invoice
# Ghana workflow: Supplier delivers goods with invoice → Staff receives and stocks →
# Manager matches invoice to GRN → Owner pays supplier on credit terms (NET_30/NET_60)
# Roles: owner, se_admin, manager, head_pharmacist, technician
mutation CreateGRN {
  createGRN(input: {
    supplierId: "<supplier-uuid>"
    purchaseOrderId: "PO-2026-042"  # Optional
    supplierInvoiceNumber: "INV-2026-001234"
    invoiceDate: "2026-03-22"
    dueDate: "2026-04-21"  # Optional — calculated from payment_terms if not provided
    totalAmountPesewas: 125000  # GH₵1,250.00 from supplier invoice
    invoicePdfS3Key: "s3://bucket/invoices/INV-2026-001234.pdf"  # Optional
    items: [
      {
        productId: "<product-uuid>"
        quantity: 100
        batchNumber: "BATCH-2026-001"
        expiryDate: "2028-06-30"
        imageS3Key: "s3://bucket/products/photo-001.jpg"  # Optional — product photo taken during receiving
      }
    ]
    notes: "All items received in good condition"
  }) {
    id branchId supplierId supplierName
    supplierInvoiceNumber invoiceDate dueDate
    totalAmountPesewas totalAmountFormatted
    invoicePdfS3Key
    items {
      id productId productName quantity batchNumber expiryDate imageS3Key
    }
    notes receivedBy receivedByName receivedAt
    isMatched  # true if matched to supplier_invoice record
  }
}

# Get a single GRN by ID
# Roles: owner, se_admin, manager, head_pharmacist
query GetGRN {
  grn(id: "<grn-uuid>") {
    id branchId supplierId supplierName
    supplierInvoiceNumber invoiceDate dueDate
    totalAmountPesewas totalAmountFormatted
    items { productId productName quantity batchNumber expiryDate imageS3Key }
    receivedBy receivedByName receivedAt isMatched
  }
}

# List GRNs for current branch (most recent first)
# Roles: owner, se_admin, manager, head_pharmacist
query ListGRNs {
  listGRNs(limit: 50) {
    id supplierName supplierInvoiceNumber
    totalAmountFormatted receivedAt isMatched
  }
}
\`\`\`

**Stock status values:** \`ok\` (above reorder) | \`low\` (at reorder) | \`critical\` (≤20% of reorder) | \`out\` (zero)

**GRN workflow notes:**
- Product images can be uploaded during stock receiving (stored in S3, linked to product_images table)
- Every product is traced to its supplier (supplier_id on products table + sale_items table)
- GRN creates supplier_invoice record for payment tracking (matched by manager, paid by owner)
- Due date calculated from supplier payment_terms (NET_30 = 30 days, NET_60 = 60 days)

---

## Accounting & Financial Intelligence

> **Roles:** owner, se_admin, manager only (except expense creation — all staff).

\`\`\`graphql
# ── Expenses ──────────────────────────────────────────────────────────────

# Create a staff expense — requires manager/owner approval before payment
# Roles: all authenticated users
mutation CreateExpense {
  createExpense(input: {
    category: UTILITIES  # UTILITIES | RENT | SALARIES | FUEL | MAINTENANCE | MARKETING | LICENSES | BANK_CHARGES | MISCELLANEOUS
    amountPesewas: 15000  # GH₵150.00
    description: "Electricity bill — March 2026"
    receiptS3Key: "s3://bucket/receipts/receipt-001.pdf"  # Optional
    expenseDate: "2026-03-22"  # Optional — defaults to today
  }) {
    id branchId category
    amountPesewas amountFormatted
    description receiptS3Key expenseDate
    status  # PENDING | APPROVED | PAID | REJECTED
    createdBy createdByName createdAt
  }
}

# Approve or reject a pending expense
# Roles: owner, se_admin, manager
mutation ApproveExpense {
  approveExpense(input: {
    expenseId: "<expense-uuid>"
    status: APPROVED  # APPROVED | REJECTED
    notes: "Approved — valid receipt provided"
  }) {
    id status approvedBy approvedByName approvalNotes
  }
}

# List expenses — manager sees own branch; owner/se_admin see all
# Staff see only their own expenses
# Roles: all authenticated users
query ListExpenses {
  listExpenses(status: PENDING) {
    id category amountFormatted description
    status createdByName approvedByName createdAt
  }
}

# ── Supplier Credit & Invoices ────────────────────────────────────────────

# Get supplier credit summary — outstanding balance, overdue, aging
# Used by owner/manager to decide when to pay suppliers
# Roles: owner, se_admin, manager
query SupplierCreditSummary {
  supplierCreditSummary(supplierId: "<supplier-uuid>") {
    supplierId supplierName
    outstandingBalancePesewas outstandingBalanceFormatted
    overduePesewas overdueFormatted
    unpaidInvoiceCount overdueInvoiceCount
    nextPaymentDue
    creditLimitPesewas creditUtilizationPct
  }
}

# List supplier invoices for a branch
# Roles: owner, se_admin, manager
query ListSupplierInvoices {
  listSupplierInvoices(supplierId: "<supplier-uuid>") {
    id supplierId supplierName
    invoiceNumber invoiceDate dueDate
    totalAmountPesewas totalAmountFormatted
    paidAmountPesewas paidAmountFormatted
    balancePesewas balanceFormatted
    status  # PENDING | MATCHED | PARTIAL | PAID | OVERDUE
    grnId s3PdfKey createdAt
  }
}

# Record a payment to a supplier against an invoice
# Updates invoice paid_amount and status. Posts to general ledger.
# Roles: owner, se_admin, manager
mutation RecordSupplierPayment {
  recordSupplierPayment(input: {
    invoiceId: "<invoice-uuid>"
    amountPesewas: 125000  # GH₵1,250.00
    paymentMethod: "MTN_MOMO"  # CASH | MTN_MOMO | BANK_TRANSFER | CHEQUE
    reference: "MOMO-TXN-123456"  # Optional — MoMo ref, bank ref, cheque no
  }) {
    id invoiceNumber
    totalAmountPesewas paidAmountPesewas balancePesewas
    status  # PARTIAL or PAID
  }
}

# Match a supplier invoice to a GRN (3-way match: PO → GRN → Invoice)
# Roles: owner, se_admin, manager
mutation MatchSupplierInvoice {
  matchSupplierInvoice(input: {
    invoiceId: "<invoice-uuid>"
    grnId: "<grn-uuid>"
    notes: "Invoice matches GRN — all items received"
  }) {
    id invoiceNumber grnId status  # status = MATCHED
  }
}

# ── Cash Flow Intelligence ────────────────────────────────────────────────

# Predict when to pay suppliers based on sales velocity and cash runway
# Algorithm:
# 1. Calculate current cash on hand (from GL account 1000)
# 2. Calculate avg daily sales revenue (last 30 days)
# 3. Calculate avg daily expenses (last 30 days)
# 4. Project revenue for next 7/30 days
# 5. Calculate cash runway = current cash / avg daily expenses
# 6. Recommend: PAY_NOW if runway > 60 days, WAIT if runway < 30 days, etc.
# Roles: owner, se_admin, manager
query CashFlowForecast {
  cashFlowForecast {
    currentCashPesewas currentCashFormatted
    payablesDue7DaysPesewas payablesDue7DaysFormatted
    payablesDue30DaysPesewas payablesDue30DaysFormatted
    projectedRevenue7DaysPesewas projectedRevenue7DaysFormatted
    projectedRevenue30DaysPesewas projectedRevenue30DaysFormatted
    cashRunwayDays
    recommendation  # PAY_NOW | WAIT_7_DAYS | WAIT_30_DAYS | NEGOTIATE_EXTENSION | CRITICAL_LOW_CASH
    recommendationReason  # Human-readable explanation
  }
}

# ── Profit & Loss ─────────────────────────────────────────────────────────

# Generate P&L statement for a period
# Revenue = sales, COGS = supplier invoices matched to sales, Operating expenses = approved expenses
# Roles: owner, se_admin, manager
query ProfitLoss {
  profitLoss(
    periodStart: "2026-03-01"
    periodEnd: "2026-03-31"
  ) {
    periodStart periodEnd
    revenuePesewas revenueFormatted
    cogsPesewas cogsFormatted
    grossProfitPesewas grossProfitFormatted grossProfitMarginPct
    operatingExpensesPesewas operatingExpensesFormatted
    netProfitPesewas netProfitFormatted netProfitMarginPct
  }
}
\`\`\`

**Expense categories:**
| Category | GL Account | Description |
|----------|------------|-------------|
| \`UTILITIES\` | 5100 | Electricity, water, internet |
| \`RENT\` | 5200 | Shop rent |
| \`SALARIES\` | 5300 | Staff salaries |
| \`FUEL\` | 5400 | Delivery vehicle fuel |
| \`MAINTENANCE\` | 5500 | Equipment repairs |
| \`MARKETING\` | 5600 | Advertising, promotions |
| \`LICENSES\` | 5700 | FDA, GRA, GMDC renewals |
| \`BANK_CHARGES\` | 5800 | MoMo fees, bank charges |
| \`MISCELLANEOUS\` | 5900 | Other |

**Cash flow recommendations:**
| Recommendation | Meaning |
|----------------|---------|
| \`PAY_NOW\` | Cash runway > 60 days — pay suppliers now to maintain relationships |
| \`WAIT_7_DAYS\` | Wait 7 days to collect more revenue before paying |
| \`WAIT_30_DAYS\` | Wait until closer to due dates to preserve working capital |
| \`NEGOTIATE_EXTENSION\` | Cash runway < 30 days — negotiate payment extensions |
| \`CRITICAL_LOW_CASH\` | Current cash < payables due in 7 days — urgent action required |

---

## Reports & Dashboard KPIs

> **Roles:** owner, se_admin, manager only.

\`\`\`graphql
# Dashboard KPIs — today + this month vs last month
query DashboardKpis {
  dashboardKpis {
    todayRevenuePesewas
    todayRevenueFormatted    # "GH₵1,250.00"
    todaySalesCount
    monthRevenuePesewas
    monthRevenueFormatted
    monthSalesCount
    revenueDeltaPct          # % change vs previous month (negative = decline)
    lowStockCount
    activeStaffCount
  }
}

# Revenue report for a date range
query RevenueReport {
  revenueReport(
    periodStart: "2026-03-01"
    periodEnd: "2026-03-31"
  ) {
    periodStart periodEnd
    totalRevenuePesewas
    totalRevenueFormatted    # "GH₵42,500.00"
    vatCollectedPesewas
    vatFormatted             # Ghana GRA monthly return figure
    salesCount
    averageSaleGhs
    refundsPesewas
  }
}

# Top selling products by revenue
query TopProducts {
  topProducts(
    periodStart: "2026-03-01"
    periodEnd: "2026-03-31"
    limit: 10
  ) {
    productId productName
    unitsSold
    revenuePesewas
    revenueFormatted
  }
}
\`\`\`

---

## Staff Management

> **Roles:** owner, se_admin, manager (invite/deactivate/reset).
> Staff can update their own non-sensitive profile fields.

\`\`\`graphql
# List staff — manager sees own branch; owner/se_admin see all
query ListStaff {
  listStaff(branchId: "<branch-uuid>") {
    id name email role is_active
    position department employment_type
    professional_licence_no licence_expiry_date
    start_date certificate_s3_keys
  }
}

# Invite a new staff member — returns a one-time temporary password
mutation InviteStaff {
  inviteStaff(input: {
    name: "Ama Asante"
    email: "ama@azzaypharmacy.com"
    phone: "+233244000001"
    role: "cashier"           # owner | head_pharmacist | pharmacist | cashier | manager | technician
    position: "Senior Cashier"
    department: "Front Desk"
    employment_type: "full_time"
  }) {
    userId
    name
    temporaryPassword   # Share securely — must be changed on first login
    message
  }
}

# Update staff profile (HR data + PII — encrypted at rest per Ghana DPA 2012)
mutation UpdateStaffProfile {
  updateStaffProfile(input: {
    userId: "<user-uuid>"
    position: "Head Pharmacist"
    department: "Dispensary"
    professional_licence_no: "PCGH-2024-00123"
    licence_expiry_date: "2027-12-31"
    # PII fields — AES-256-GCM encrypted before storage
    phone: "+233244000001"
    address: "123 Ring Road, Accra"
    ghana_card_number: "GHA-000000000-0"
  }) {
    id name role position department professional_licence_no
  }
}

# Deactivate a staff member (soft delete — sessions invalidated immediately)
mutation DeactivateStaff {
  deactivateStaff(userId: "<user-uuid>")
}

# Reset a staff member's password
mutation ResetStaffPassword {
  resetStaffPassword(input: {
    userId: "<user-uuid>"
    newPassword: "TempPass2026!"
  })
}
\`\`\`

**Staff roles:**
| Role | Description |
|------|-------------|
| \`owner\` | Full access — all branches |
| \`se_admin\` | Advansis Technologies super-admin — cross-org |
| \`manager\` | Branch manager — own branch only |
| \`head_pharmacist\` | Senior pharmacist — Rx verification + controlled drugs |
| \`pharmacist\` | Pharmacist — Rx creation and verification |
| \`technician\` | Pharmacy technician — stock receiving |
| \`cashier\` | POS cashier — pharmaceutical branch |
| \`chemical_cashier\` | POS cashier — chemical branch (no POM) |

---

---

## AI-Powered Product Image Sourcing

> **NEW FEATURE:** Automatic product image fetching from multiple sources.
> Images are fetched automatically when products are created or can be triggered manually.

### Image Sources (Priority Order)

1. **RxImage API** (95% confidence) - **EXACT product photos**
   - National Library of Medicine official database
   - Real photographs of actual drug products
   - FREE, unlimited
   - Coverage: 85-95% of pharmaceutical products

2. **OpenFDA API** (90% confidence) - **EXACT product photos**
   - US FDA official database
   - Links to RxImage photos via RxCUI codes
   - FREE, 120,000 requests/day

3. **Google Custom Search** (70% confidence) - **May be exact**
   - Web search results (quality varies)
   - 100 queries/day FREE
   - Requires GOOGLE_API_KEY and GOOGLE_CSE_ID

4. **Unsplash** (60% confidence) - **Generic stock photos** ❌ DISABLED by default
5. **DALL-E** (50% confidence) - **AI-generated** ❌ DISABLED by default

### Configuration

**Minimal Setup (FREE - Already Working)**:
No configuration needed! RxImage and OpenFDA work out of the box.

**Enhanced Setup (Optional)**:
\`\`\`bash
# Add to .env for better coverage
GOOGLE_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_CSE_ID=017576662512468239146:omuauf_lfve
UNSPLASH_ACCESS_KEY=your_unsplash_access_key
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
\`\`\`

### GraphQL Operations

\`\`\`graphql
# Images are fetched automatically on product creation
mutation CreateProduct {
  createProduct(input: {
    name: "Paracetamol 500mg Tablet"
    genericName: "Paracetamol 500mg"
    classification: "OTC"
    unitPrice: 500
  }) {
    id
    name
    imageUrl        # CDN URL (available after 2-5 seconds)
    images {
      id
      cdnUrl
      urlThumb
      source        # RXIMAGE | OPENFDA | GOOGLE | UNSPLASH | AI_GENERATED
      isApproved
      metadata      # { confidence: 95, original_url: "..." }
      createdAt
    }
  }
}

# Manually refresh a product image
mutation RefreshProductImage {
  refreshProductImage(productId: "<product-uuid>") {
    id
    imageUrl
    images {
      source
      metadata
    }
  }
}

# Batch fetch images for products without images
mutation BatchFetchProductImages {
  batchFetchProductImages(limit: 100) {
    queued        # Number of jobs queued
    total         # Total products without images
    message
  }
}

# Query product with image details
query GetProduct {
  product(id: "<product-uuid>") {
    id
    name
    genericName
    imageUrl
    images {
      id
      cdnUrl
      source
      isApproved
      metadata
      createdAt
    }
  }
}

# Search products (includes images)
query SearchProducts {
  searchProducts(query: "paracetamol", limit: 10) {
    id
    name
    genericName
    imageUrl      # Primary image CDN URL
    unitPrice
    classification
  }
}
\`\`\`

### Image Confidence Scores

Each image is assigned a confidence score (0-100):

| Score | Source | Meaning |
|-------|--------|---------|
| 95 | RxImage | ✅ Official medical database - EXACT product |
| 90 | OpenFDA | ✅ FDA-approved drug data - EXACT product |
| 70 | Google | ⚠️ Web search - MAY be exact |
| 60 | Unsplash | ❌ Generic stock photo - NOT exact |
| 50 | DALL-E | ❌ AI-generated - FAKE |

**Recommendation**: Manually review images with confidence < 90.

### Expected Coverage

- **Pharmaceutical products** (Paracetamol, Amoxicillin, etc.): 85-95% exact photos
- **All pharmaceuticals**: 90-98% with Google included
- **Non-pharmaceuticals** (cosmetics, cleaning): 60-80% (varies)

### Cost Estimation

**Free Tier** (recommended):
- RxImage: Unlimited, FREE
- OpenFDA: 120,000/day, FREE
- Google: 100/day, FREE
- Unsplash: 1,200/day, FREE
- **Total**: ~1,300 free searches/day

**Paid Tier** (optional):
- Google: $5 per 1,000 queries after free tier
- DALL-E: $0.04 per generated image

**Example**: 1,000 product catalog ≈ $0.65 total (mostly free APIs)

### Real-World Examples

**Example 1: Paracetamol 500mg**
\`\`\`
Input: "Paracetamol 500mg Tablet"
Process:
  1. RxImage search: "Paracetamol 500mg"
  2. ✅ FOUND: Actual product photo
  3. Upload to S3
  4. Result: EXACT product photo

Confidence: 95 (EXACT)
Source: RXIMAGE
\`\`\`

**Example 2: Amoxicillin 500mg**
\`\`\`
Input: "Amoxicillin 500mg Capsule"
Process:
  1. RxImage search: "Amoxicillin 500mg"
  2. ✅ FOUND: Actual capsule/bottle photo
  3. Upload to S3
  4. Result: EXACT product photo

Confidence: 95 (EXACT)
Source: RXIMAGE
\`\`\`

### Processing Time

- **Single product**: 2-5 seconds
- **Batch (100 products)**: 5-10 minutes (with rate limiting)
- **Full catalog (1,000 products)**: 1-2 hours

### Quality Assurance

**SQL Query to Review Low-Confidence Images**:
\`\`\`sql
SELECT 
  p.name,
  p.generic_name,
  pi.cdn_url,
  pi.source,
  pi.metadata->>'confidence' as confidence
FROM products p
JOIN product_images pi ON pi.product_id = p.id
WHERE pi.is_approved = true 
  AND (pi.metadata->>'confidence')::int < 90
ORDER BY (pi.metadata->>'confidence')::int ASC;
\`\`\`

### Documentation

For detailed setup and usage:
- **Quick Start**: \`IMAGE_QUALITY_SUMMARY.md\`
- **Detailed Guide**: \`docs/IMAGE-QUALITY-GUIDE.md\`
- **API Setup**: \`docs/IMAGE-API-SETUP.md\`
- **Technical Docs**: \`docs/AI-PRODUCT-IMAGES.md\`

---

## Price Management

\`\`\`graphql
# Update a single product price
# Roles: owner, se_admin, manager
mutation UpdateProductPrice {
  updateProductPrice(input: {
    productId: "<product-uuid>"
    unitPriceGhsPesewas: 2500    # GH₵25.00
    reason: "Supplier price increase — March 2026"
  }) {
    productId productName
    price {
      ghsPesewas ghsFormatted
      usdEquivalent usdFormatted  # Display only — never used in transactions
      exchangeRate
    }
    updatedAt
  }
}

# Bulk price update (up to 100 products, atomic)
mutation BulkUpdatePrices {
  bulkUpdateProductPrices(input: {
    updates: [
      { productId: "<uuid-1>", unitPriceGhsPesewas: 1500, reason: "Annual review" }
      { productId: "<uuid-2>", unitPriceGhsPesewas: 3200, reason: "Annual review" }
    ]
  }) {
    productId productName
    price { ghsPesewas ghsFormatted }
  }
}

# Set USD/GHS exchange rate (display-only reference)
# Roles: owner, se_admin
mutation SetExchangeRate {
  setUsdExchangeRate(input: { usdToGhsRate: 15.50 }) {
    usdToGhsRate updatedAt updatedByName
  }
}

# Current exchange rate
query CurrentExchangeRate {
  currentExchangeRate {
    usdToGhsRate updatedAt updatedByName
  }
}

# Price change audit trail for a product
query PriceHistory {
  productPriceHistory(productId: "<product-uuid>", limit: 20) {
    oldPriceFormatted newPriceFormatted
    reason changedByName changedAt
  }
}
\`\`\`

---

## Error Codes Reference

All GraphQL errors follow this shape:
\`\`\`json
{
  "errors": [{
    "message": "Human-readable message",
    "extensions": {
      "code": "ERROR_CODE",
      "statusCode": 400
    }
  }]
}
\`\`\`

| Code | HTTP | Description |
|------|------|-------------|
| \`FDA_POM_VIOLATION\` | 400 | POM product sold without approved Rx — Ghana FDA |
| \`GMDC_INVALID_LICENCE\` | 400 | Prescriber licence expired or not found — GMDC |
| \`FDA_RX_EXPIRED\` | 400 | Prescription older than 30 days |
| \`FDA_CONTROLLED_DRUG_INSUFFICIENT_SIGNOFFS\` | 400 | Controlled drug needs 2 pharmacist approvals |
| \`UNAUTHENTICATED\` | 401 | Missing, expired, or invalid JWT |
| \`FORBIDDEN\` | 403 | Role not permitted / chemical branch POM attempt |
| \`NOT_FOUND\` | 404 | Resource not found |
| \`CONFLICT\` | 409 | Duplicate resource (email, idempotency key) |
| \`SUBSCRIPTION_LIMIT\` | 402 | Tier limit reached (users, products, sales/month) |

---

---

## Multi-Branch Inventory Management

> **ROADMAP:** Enhanced multi-branch features for pharmaceutical and chemical shop operations.

### Current Features ✅

- ✅ Branch-scoped inventory tracking
- ✅ Branch type enforcement (pharmaceutical vs chemical)
- ✅ GRN (Goods Received Note) workflow
- ✅ Stock movements audit trail
- ✅ Real-time stock subscriptions
- ✅ FEFO (First Expiry First Out) tracking
- ✅ Low stock alerts per branch

### Branch Types

| Type | POM Products | Prescriptions | Controlled Drugs |
|------|--------------|---------------|------------------|
| **pharmaceutical** | ✅ Allowed | ✅ Full Rx workflow | ✅ With 2 sign-offs |
| **chemical** | ❌ Blocked | ❌ No Rx module | ❌ Blocked |
| **both** | ✅ Allowed | ✅ Full Rx workflow | ✅ With 2 sign-offs |

### Upcoming Features 🚀

**Phase 1: Inter-Branch Transfers** (Week 1-2)
\`\`\`graphql
# Request stock transfer between branches
mutation CreateInterBranchTransfer {
  createInterBranchTransfer(input: {
    toBranchId: "<branch-uuid>"
    items: [
      {
        productId: "<product-uuid>"
        quantity: 50
        batchNumber: "BATCH-2026-001"
        expiryDate: "2028-06-30"
      }
    ]
    notes: "Transfer for new chemical shop opening"
  }) {
    id
    fromBranch { id name type }
    toBranch { id name type }
    status        # pending | approved | in_transit | received | cancelled
    items {
      productId productName quantity batchNumber expiryDate
    }
    requestedBy requestedByName requestedAt
  }
}

# Approve transfer (owner/manager only)
mutation ApproveTransfer {
  approveTransfer(transferId: "<transfer-uuid>") {
    id status approvedBy approvedByName approvedAt
  }
}

# Receive transfer at destination branch
mutation ReceiveTransfer {
  receiveTransfer(
    transferId: "<transfer-uuid>"
    items: [
      {
        productId: "<product-uuid>"
        receivedQuantity: 50  # May differ from requested
        notes: "All items received in good condition"
      }
    ]
  }) {
    id status receivedBy receivedByName receivedAt
  }
}

# Cancel transfer
mutation CancelTransfer {
  cancelTransfer(
    transferId: "<transfer-uuid>"
    reason: "Stock no longer needed at destination"
  ) {
    id status cancelledBy cancelledByName cancelledAt
  }
}

# List transfers for current branch
query ListTransfers {
  listTransfers(status: "pending") {
    id
    fromBranch { name }
    toBranch { name }
    status
    items { productName quantity }
    requestedAt
  }
}
\`\`\`

**Phase 2: AI Demand Forecasting** (Week 3-4)
\`\`\`graphql
# Get demand forecast for a product
query DemandForecast {
  demandForecast(
    productId: "<product-uuid>"
    branchId: "<branch-uuid>"
    forecastDays: 30
  ) {
    productId productName
    currentStock
    averageDailySales
    forecastedDemand30Days
    recommendedReorderQuantity
    suggestedReorderDate
    confidence      # 0-100 based on historical data quality
    seasonalityFactor
    trendDirection  # increasing | stable | decreasing
  }
}

# Batch forecast for all low-stock products
query BatchDemandForecast {
  batchDemandForecast(branchId: "<branch-uuid>") {
    productId productName
    currentStock
    forecastedDemand30Days
    recommendedReorderQuantity
    urgency  # critical | high | medium | low
  }
}
\`\`\`

**Phase 3: Performance Optimization** (Week 5-6)
- Redis caching for product searches (< 200ms target)
- Database indexes for inventory queries
- Query optimization for large catalogs
- Load testing and benchmarking

### Branch Management Best Practices

**For Pharmaceutical Branch**:
- Full POM dispensing with prescription workflow
- Controlled drugs require 2 pharmacist sign-offs
- GMDC licence validation on every Rx
- Stock all pharmaceutical products

**For Chemical Shop Branch**:
- OTC products only (POM hard-blocked at API level)
- No prescription module access
- Focus on cosmetics, cleaning supplies, general health
- Separate inventory from pharmaceutical branch

### Documentation

- **Implementation Roadmap**: \`MULTI_BRANCH_ROADMAP.md\`
- **Deployment Guide**: \`DEPLOYMENT_READY.md\`
- **Executive Summary**: \`IMPLEMENTATION_SUMMARY.md\`

---

## WebSocket Subscriptions (Real-Time)

Connect via \`graphql-ws\` protocol. JWT authenticated in \`connection_init\`.

\`\`\`javascript
// Apollo Client split link setup
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';

const wsLink = new GraphQLWsLink(createClient({
  url: 'wss://api.pharmapos.com/graphql',
  connectionParams: { Authorization: \`Bearer \${accessToken}\` },
  keepAlive: 30_000,  // 30s heartbeat
}));
\`\`\`

> Subscriptions are defined in the schema — use GraphQL Playground to explore.
> Real-time events: low stock alerts, new prescriptions, sale completed.

---

## Offline / PWA

The web POS is an offline-first PWA. When offline:
- Sales are queued in **Dexie.js** (IndexedDB)
- MoMo payments are disabled — cash only
- On reconnect, queued sales sync with idempotency keys (no duplicates)
- The \`idempotencyKey\` field on \`createSale\` is the mechanism — always generate a UUID v4 client-side

---
`;
async function bootstrap() {
    var _a;
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: nest_winston_1.WinstonModule.createLogger({
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(winston.format.timestamp(), winston.format.colorize(), winston.format.printf(({ timestamp, level, message, context }) => `${timestamp} [${context !== null && context !== void 0 ? context : 'App'}] ${level}: ${message}`)),
                }),
            ],
        }),
    });
    if (process.env.NODE_ENV === 'production') {
        app.use((0, helmet_1.default)({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", 'data:', 'https:'],
                },
            },
        }));
    }
    else {
        app.use((0, helmet_1.default)({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
    }
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.enableCors({
        origin: (origin, callback) => {
            if ((0, cors_origins_1.isOriginAllowed)(origin)) {
                callback(null, true);
            }
            else {
                callback(new Error(`CORS: origin ${origin} not allowed`));
            }
        },
        methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'Apollo-Require-Preflight',
            'X-Apollo-Operation-Name',
            'X-Apollo-Query-Name',
            'apollo-require-preflight',
        ],
        credentials: true,
    });
    const port = (_a = process.env.PORT) !== null && _a !== void 0 ? _a : 4000;
    const swaggerDescription = `
## Overview

PharmaPOS Pro is a **Ghana FDA-compliant SaaS pharmacy POS** built for West Africa.
Delivered by **Advansis Technologies** for Azzay Pharmacy, Accra.

> **Primary API surface:** GraphQL at \`/graphql\`
> This page documents the REST health probes **and** the full GraphQL operations reference.
> Use the [GraphQL Playground](/graphql) to run queries interactively.

## Quick Start

\`\`\`bash
# 1. Get an access token
curl -X POST http://localhost:${port}/graphql \\
  -H "Content-Type: application/json" \\
  -d '{"query":"mutation { login(input:{email:\\"owner@azzaypharmacy.com\\",password:\\"PharmaPOS@2025!\\"}) { access_token refresh_token expires_in user { id name role } } }"}'

# Password matches seeded users after \`pnpm db:seed\` (see README).

# 2. Use the token on subsequent requests
curl -X POST http://localhost:${port}/graphql \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <access_token>" \\
  -d '{"query":"query { me { id name role } }"}'
\`\`\`

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| API protocol | GraphQL | ADR-01 — flexible queries, subscriptions, self-documenting |
| Currency | GHS pesewas (integer) | Avoids floating-point rounding on monetary values |
| Auth | JWT (15 min) + refresh (30 days) | Stateless scaling + session revocation |
| Real-time | graphql-ws subscriptions | ADR — never polling |
| Offline | Dexie.js + idempotency keys | PWA requirement — POS works without internet |
| Multi-tenancy | organization_id on every table | ADR-06 — single DB, RLS isolation |

## Ghana Regulatory Compliance

| Rule | Enforcement |
|------|-------------|
| POM requires Rx | \`PomEnforcementGuard\` — API-level, cannot be bypassed |
| GMDC licence validation | Live call on every Rx creation + verification |
| Rx validity 30 days | Hard-coded — never extendable |
| Chemical shop no POM | \`BranchTypeGuard\` on all Rx endpoints |
| Controlled drugs 2 sign-offs | \`approvalCount >= 2\` check before dispensing |
| VAT 15% (non-exempt) | Calculated in \`SalesService.createSale\` |
| Rx PDFs 5-year retention | BullMQ async upload to S3 after approval |
| Audit log immutable | PostgreSQL RULE blocks UPDATE/DELETE |

## Currency Rules

- All monetary values stored as **GHS pesewas** (integer × 100)
- Example: GH₵12.50 = \`1250\`
- Formatted strings always prefixed \`GH₵\` — never USD in any response
- USD is display-only reference via exchange rate — never used in transactions

## Rate Limits

| Tier | Requests/min | Sales/month | Products | Users |
|------|-------------|-------------|----------|-------|
| Free | 60 | 1,000 | 500 | 3 |
| Starter | 300 | 10,000 | 5,000 | 10 |
| Professional | 1,000 | 100,000 | 50,000 | 50 |
| Enterprise | Custom | Unlimited | Unlimited | Unlimited |

Limits enforced at API level — no client-side bypass possible.

${GQL_REFERENCE}`;
    const config = new swagger_1.DocumentBuilder()
        .setTitle('PharmaPOS Pro — API Reference')
        .setDescription(swaggerDescription)
        .setVersion('1.0.0')
        .setContact('Advansis Technologies', 'https://advansis.tech', 'api-support@advansis.tech')
        .setLicense('Proprietary — All rights reserved', 'https://pharmapos.com/terms')
        .setExternalDoc('GraphQL Playground (run queries live)', `http://localhost:${port}/graphql`)
        .addTag('health', 'Liveness, readiness, and dependency health probes — used by AWS ELB')
        .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
        description: 'JWT access token from the `login` GraphQL mutation.\n' +
            'Format: `Bearer <access_token>`\n' +
            'Expires in **15 minutes** — use `refreshToken` mutation to rotate.\n' +
            'Store in memory only — never localStorage.',
    }, 'JWT')
        .addServer(`http://localhost:${port}`, 'Local Development')
        .addServer('https://api.pharmapos.com', 'Production (West Africa — AWS EB)')
        .addServer('https://staging-api.pharmapos.com', 'Staging')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api-docs', app, document, {
        customSiteTitle: 'PharmaPOS Pro — API Reference',
        customfavIcon: '/favicon.ico',
        customCss: `
      /* Brand: Teal primary, Gold CTA */
      .swagger-ui .topbar { background-color: #006D77; padding: 12px 0; }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
      .swagger-ui .topbar-wrapper .link { display: flex; align-items: center; gap: 10px; }
      .swagger-ui .topbar-wrapper .link::before {
        content: 'PharmaPOS Pro';
        color: #fff;
        font-size: 18px;
        font-weight: 700;
        font-family: Inter, sans-serif;
        letter-spacing: -0.3px;
      }
      .swagger-ui .info .title { color: #006D77; font-family: Inter, sans-serif; }
      .swagger-ui .info .title small { background: #006D77; }
      .swagger-ui .info a { color: #006D77; }
      /* Gold authorize button */
      .swagger-ui .btn.authorize {
        background-color: #E8A838;
        border-color: #E8A838;
        color: #fff;
        font-weight: 600;
      }
      .swagger-ui .btn.authorize:hover { background-color: #d4952a; border-color: #d4952a; }
      .swagger-ui .btn.authorize svg { fill: #fff; }
      /* Teal operation badges */
      .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #006D77; }
      .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #004E57; }
      /* Code blocks */
      .swagger-ui .highlight-code { background: #f8fafb; border-radius: 6px; }
      /* Table styling */
      .swagger-ui table thead tr th { background: #C8E6EA; color: #004E57; }
      /* Markdown in description */
      .swagger-ui .markdown p { line-height: 1.7; }
      .swagger-ui .markdown code { background: #FDF3DC; color: #004E57; padding: 2px 6px; border-radius: 3px; }
      .swagger-ui .markdown pre { background: #1e1e2e; color: #cdd6f4; border-radius: 8px; padding: 16px; }
      .swagger-ui .markdown pre code { background: transparent; color: inherit; padding: 0; }
    `,
        swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            docExpansion: 'list',
            filter: true,
            showExtensions: true,
            tryItOutEnabled: true,
            defaultModelsExpandDepth: 2,
            defaultModelExpandDepth: 2,
            syntaxHighlight: { activate: true, theme: 'monokai' },
        },
    });
    console.log(`📖 API Reference (REST + GraphQL): http://localhost:${port}/api-docs`);
    console.log(`🚀 GraphQL Playground:             http://localhost:${port}/graphql`);
    console.log(`❤️  Health check:                   http://localhost:${port}/health`);
    await app.listen(port, '0.0.0.0');
    console.log(`PharmaPOS API running on port ${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map