# Invoice OCR Workflow - Visual Guide

## 📋 Complete Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PHASE 1: INVOICE OCR WORKFLOW                    │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│   SUPPLIER   │
│   DELIVERS   │
│   INVOICE    │
└──────┬───────┘
       │
       │ Paper invoice with:
       │ • Invoice number
       │ • Company details
       │ • Item list + prices
       │ • Total amount
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 1: UPLOAD INVOICE                                          │
│  ────────────────────────                                        │
│  Manager/Head Pharmacist uploads invoice:                        │
│  • Take photo with phone camera                                  │
│  • Upload PDF from email                                         │
│  • Drag & drop to web interface                                  │
│                                                                   │
│  GraphQL: uploadSupplierInvoice(file: Upload!)                   │
│  ✓ Accepts: PDF, PNG, JPG                                        │
│  ✓ Max size: 10MB                                                │
│  ✓ Uploads to S3/Supabase                                        │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       │ Returns: ocrJobId
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 2: OCR PROCESSING (Async - BullMQ)                        │
│  ────────────────────────────────────                            │
│  Background job processes invoice:                               │
│                                                                   │
│  1. GPT-4 Vision extracts data:                                  │
│     • Invoice number: "INV-2026-001234"                          │
│     • Date: "2026-04-10"                                         │
│     • Supplier: "ADD Pharma Limited"                             │
│     • Items: [                                                   │
│         {                                                        │
│           description: "Paracetamol 500mg x100",                 │
│           quantity: 100,                                         │
│           unitPrice: 1200 (pesewas),                             │
│           totalPrice: 120000                                     │
│         }                                                        │
│       ]                                                          │
│     • Total: 224250 pesewas (GH₵2,242.50)                       │
│                                                                   │
│  2. Smart Product Matching:                                      │
│     • Exact match: "Paracetamol 500mg" → 100% match             │
│     • Fuzzy match: "Amoxicilin" → "Amoxicillin" 95% match       │
│     • Keyword match: "Para 500" → "Paracetamol 500mg" 85%       │
│                                                                   │
│  3. Auto-fetch Product Images:                                   │
│     • RxImage API (pharmaceutical images)                        │
│     • OpenFDA API (FDA-approved drugs)                           │
│     • Google Custom Search (fallback)                            │
│                                                                   │
│  4. Calculate Confidence Score:                                  │
│     • 90-100%: Green (auto-approve)                              │
│     • 70-89%: Yellow (review recommended)                        │
│     • <70%: Red (manual review required)                         │
│                                                                   │
│  Progress: 0% → 25% → 50% → 75% → 100%                          │
│  Duration: ~30-40 seconds                                        │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       │ Status: COMPLETED
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 3: REVIEW EXTRACTED DATA                                   │
│  ──────────────────────────────                                  │
│  Frontend polls: invoiceOcrJob(id)                               │
│                                                                   │
│  Display extracted data:                                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Invoice: INV-2026-001234        Date: 2026-04-10          │ │
│  │ Supplier: ADD Pharma Limited    Confidence: 94% ✓         │ │
│  │                                                            │ │
│  │ Items:                                                     │ │
│  │ ┌──────────────────────────────────────────────────────┐ │ │
│  │ │ Description          | Matched Product    | Qty | $  │ │ │
│  │ │ ─────────────────────┼───────────────────┼─────┼────│ │ │
│  │ │ Paracetamol 500mg   │ Paracetamol 500mg │ 100 │1200│ │ │
│  │ │                      │ ✓ 100% match      │     │    │ │ │
│  │ │                      │ [Product Image]   │     │    │ │ │
│  │ │ ─────────────────────┼───────────────────┼─────┼────│ │ │
│  │ │ Amoxicillin 500mg   │ Amoxicillin 500mg │  50 │1500│ │ │
│  │ │                      │ ✓ 95% match       │     │    │ │ │
│  │ │                      │ [Product Image]   │     │    │ │ │
│  │ └──────────────────────────────────────────────────────┘ │ │
│  │                                                            │ │
│  │ Total: GH₵2,242.50                                         │ │
│  │                                                            │ │
│  │ [Edit] [Confirm & Create GRN]                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  User can:                                                        │
│  • Edit any field                                                │
│  • Change product matches                                        │
│  • Add batch numbers                                             │
│  • Add expiry dates                                              │
│  • Confirm or reject                                             │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       │ User clicks "Confirm"
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 4: CREATE GRN & UPDATE INVENTORY                           │
│  ──────────────────────────────────────                          │
│  GraphQL: confirmOcrInvoice(input)                               │
│                                                                   │
│  System automatically:                                           │
│  1. Creates GRN (Goods Received Note)                            │
│  2. Updates inventory quantities                                 │
│  3. Records stock movements                                      │
│  4. Saves product cost history                                   │
│  5. Attaches product images                                      │
│  6. Creates supplier invoice                                     │
│  7. Sets payment terms (NET_30, etc.)                            │
│  8. Creates audit log                                            │
│                                                                   │
│  Result:                                                         │
│  ✓ GRN ID: 990e8400-...                                          │
│  ✓ Invoice ID: aa0e8400-...                                      │
│  ✓ Stock updated: 2 products                                     │
│  ✓ Images processed: 2                                           │
│                                                                   │
│  Duration: ~2-3 seconds                                          │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       │ GRN Created
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 5: PAYMENT TRACKING                                        │
│  ────────────────────────                                        │
│  Supplier Invoice Status:                                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Invoice: INV-2026-001234                                   │ │
│  │ Supplier: ADD Pharma Limited                               │ │
│  │ Total: GH₵2,242.50                                         │ │
│  │ Paid: GH₵1,000.00                                          │ │
│  │ Balance: GH₵1,242.50                                       │ │
│  │ Status: PARTIAL 🟡                                         │ │
│  │ Payment Terms: NET_30                                      │ │
│  │ Due Date: 2026-05-10                                       │ │
│  │ Days Outstanding: 0                                        │ │
│  │                                                            │ │
│  │ Payment History:                                           │ │
│  │ • 2026-04-10: GH₵1,000.00 (MTN MoMo) - Azzay Owner       │ │
│  │                                                            │ │
│  │ [Record Payment]                                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Manager can:                                                     │
│  • Record full payment                                           │
│  • Record partial payment                                        │
│  • Track payment history                                         │
│  • See overdue invoices                                          │
│  • View aging reports                                            │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       │ Payment recorded
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 6: AUTOMATIC UPDATES                                       │
│  ─────────────────────────                                       │
│  Database triggers automatically:                                │
│  • Update payment_status (UNPAID → PARTIAL → PAID)              │
│  • Calculate balance (total - paid)                              │
│  • Update paid_amount                                            │
│  • Calculate days_outstanding                                    │
│  • Flag overdue invoices                                         │
│  • Update supplier credit summary                                │
│                                                                   │
│  No manual calculation needed!                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Time Comparison

### Before (Manual Entry):
```
┌─────────────────────────────────────────────────────────────┐
│ 1. Read invoice                           → 2 minutes       │
│ 2. Type invoice number, date, supplier   → 3 minutes       │
│ 3. Type each item manually                → 30 minutes      │
│ 4. Calculate totals                       → 5 minutes       │
│ 5. Search for product images              → 15 minutes      │
│ 6. Create GRN manually                    → 5 minutes       │
│                                                              │
│ TOTAL: 60 MINUTES                                           │
│ ERROR RATE: 15%                                             │
└─────────────────────────────────────────────────────────────┘
```

### After (AI-Powered OCR):
```
┌─────────────────────────────────────────────────────────────┐
│ 1. Upload invoice photo                   → 5 seconds       │
│ 2. Wait for OCR processing                → 30 seconds      │
│ 3. Review extracted data                  → 1 minute        │
│ 4. Confirm (auto-creates GRN)             → 2 seconds       │
│ 5. Images auto-fetched                    → (automatic)     │
│                                                              │
│ TOTAL: 3 MINUTES                                            │
│ ERROR RATE: <1%                                             │
│                                                              │
│ TIME SAVED: 57 MINUTES (95% REDUCTION)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 💡 Smart Features

### 1. Product Matching Intelligence
```
Input: "Para 500mg Tab"
  ↓
Exact Match: ❌ No exact match
  ↓
Fuzzy Match: ✓ "Paracetamol 500mg Tablet" (95% similarity)
  ↓
Keyword Match: ✓ "Paracetamol" + "500mg" found
  ↓
Result: Suggests "Paracetamol 500mg Tablet" with 95% confidence
```

### 2. Confidence Scoring
```
Invoice Number:     ✓ Found    → +20 points
Invoice Date:       ✓ Found    → +15 points
Supplier Name:      ✓ Found    → +15 points
Items List:         ✓ Found    → +30 points
Total Amount:       ✓ Found    → +20 points
                              ─────────────
                              = 100 points

Confidence: 100% → Auto-approve ✓
```

### 3. Payment Status Automation
```
Invoice Total: GH₵2,242.50

Payment 1: GH₵1,000.00 → Status: PARTIAL 🟡
Payment 2: GH₵1,242.50 → Status: PAID ✓

Automatic calculation:
• Balance = Total - Sum(Payments)
• Status = UNPAID | PARTIAL | PAID
• Overdue = (DueDate < Today) AND (Status != PAID)
```

---

## 🔄 Error Handling

### Scenario 1: Low OCR Confidence
```
Confidence: 65% (< 70%)
  ↓
System flags: requiresReview = true
  ↓
UI shows: ⚠️ "Low confidence - please review carefully"
  ↓
User reviews and corrects data
  ↓
Proceeds with confirmation
```

### Scenario 2: No Product Match
```
OCR: "Aspirin 100mg"
  ↓
Product Matching: ❌ No matches found
  ↓
UI shows: "No match - please select manually"
  ↓
User selects from dropdown or creates new product
  ↓
Proceeds with confirmation
```

### Scenario 3: OCR Processing Failed
```
GPT-4 Vision: ❌ Error
  ↓
System logs error
  ↓
UI shows: "OCR failed - please try again"
  ↓
User can:
• Retry with same file
• Upload different file
• Enter manually
```

---

## 📊 Database Flow

```
┌─────────────────┐
│ invoice_ocr_jobs│
│ ─────────────── │
│ • id            │
│ • status        │◄─── Updated by processor
│ • progress      │
│ • extracted_data│
│ • confidence    │
└────────┬────────┘
         │
         │ Links to
         │
         ▼
┌─────────────────────┐
│ supplier_invoices   │
│ ─────────────────── │
│ • id                │
│ • invoice_number    │
│ • total_amount      │
│ • paid_amount       │◄─── Auto-updated by trigger
│ • payment_status    │◄─── Auto-updated by trigger
│ • payment_terms     │
│ • ocr_job_id        │
└────────┬────────────┘
         │
         │ Has many
         │
         ▼
┌─────────────────────┐
│ supplier_payments   │
│ ─────────────────── │
│ • id                │
│ • invoice_id        │
│ • amount_pesewas    │
│ • payment_method    │
│ • reference         │
│ • paid_at           │
└─────────────────────┘
         │
         │ Triggers update on insert
         │
         └──► Update supplier_invoices.paid_amount
              Update supplier_invoices.payment_status
```

---

## 🎨 UI/UX Flow

### Upload Screen
```
┌────────────────────────────────────────────────┐
│  Upload Supplier Invoice                       │
│  ───────────────────────                       │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │                                           │ │
│  │         📷 Take Photo                     │ │
│  │         or                                │ │
│  │         📁 Upload File                    │ │
│  │                                           │ │
│  │    Drag & drop invoice here               │ │
│  │    or click to browse                     │ │
│  │                                           │ │
│  │    Accepts: PDF, PNG, JPG (max 10MB)     │ │
│  │                                           │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  Supplier (optional):                           │
│  [Select Supplier ▼]                            │
│                                                 │
│  [Upload Invoice]                               │
└────────────────────────────────────────────────┘
```

### Processing Screen
```
┌────────────────────────────────────────────────┐
│  Processing Invoice...                         │
│  ─────────────────────                         │
│                                                 │
│  ⏳ Extracting data with AI                    │
│                                                 │
│  ████████████████░░░░░░░░░░ 65%               │
│                                                 │
│  • Uploaded invoice ✓                          │
│  • Extracting text ✓                           │
│  • Matching products... ⏳                     │
│  • Fetching images...                          │
│                                                 │
│  This usually takes 30-40 seconds              │
└────────────────────────────────────────────────┘
```

### Review Screen
```
┌────────────────────────────────────────────────┐
│  Review Invoice Data                           │
│  ───────────────────                           │
│                                                 │
│  Confidence: 94% ✓ High                        │
│                                                 │
│  Invoice Number: [INV-2026-001234]             │
│  Date: [2026-04-10]                            │
│  Supplier: [ADD Pharma Limited]                │
│                                                 │
│  Items:                                         │
│  ┌──────────────────────────────────────────┐  │
│  │ Paracetamol 500mg x100                   │  │
│  │ Matched: Paracetamol 500mg Tablet        │  │
│  │ ✓ 100% match [📷 Image]                  │  │
│  │ Qty: [100] Price: [GH₵12.00]            │  │
│  │ Batch: [____] Expiry: [____]             │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  Total: GH₵2,242.50                            │
│                                                 │
│  [← Back] [Confirm & Create GRN →]             │
└────────────────────────────────────────────────┘
```

---

**Status**: ✅ WORKFLOW DOCUMENTED
**Ready for**: Frontend implementation
**Last Updated**: April 10, 2026
