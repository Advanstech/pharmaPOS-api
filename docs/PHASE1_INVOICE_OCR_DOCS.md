# Phase 1: Invoice OCR & Intelligent Supplier Integration
## Frontend Integration Guide

## Overview

Revolutionary feature that transforms paper supplier invoices into structured data using AI, automatically matches products, fetches images, and creates GRNs - all in seconds instead of hours.

### What This Solves

**Before**: 
- Staff manually types invoice data (30-60 minutes per invoice)
- Prone to data entry errors
- No product images captured
- Tedious product matching

**After**:
- Upload invoice photo/PDF (5 seconds)
- AI extracts all data (30 seconds)
- Smart product matching (automatic)
- Product images fetched (automatic)
- Review and confirm (2 minutes)
- **Total time: ~3 minutes** (90% time savings!)

---

## GraphQL API Reference

### 1. Upload Supplier Invoice

Upload a supplier invoice (PDF or image) for OCR processing.

```graphql
mutation UploadSupplierInvoice {
  uploadSupplierInvoice(input: {
    supplierId: "550e8400-e29b-41d4-a716-446655440000"  # Optional
    invoiceFile: Upload!  # File upload
    deliveryDate: "2026-04-10"  # Optional
  }) {
    id
    status  # PENDING
    ocrJobId
    message
  }
}
```

**Request (multipart/form-data)**:
```javascript
const formData = new FormData();
formData.append('operations', JSON.stringify({
  query: `
    mutation UploadSupplierInvoice($file: Upload!) {
      uploadSupplierInvoice(input: {
        supplierId: "550e8400-e29b-41d4-a716-446655440000"
        invoiceFile: $file
      }) {
        id
        status
        ocrJobId
        message
      }
    }
  `,
  variables: { file: null }
}));

formData.append('map', JSON.stringify({ '0': ['variables.file'] }));
formData.append('0', invoiceFile); // File object from input

const response = await fetch('http://localhost:4000/graphql', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
  body: formData
});
```

**Response**:
```json
{
  "data": {
    "uploadSupplierInvoice": {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "status": "PENDING",
      "ocrJobId": "660e8400-e29b-41d4-a716-446655440000",
      "message": "Invoice uploaded successfully. OCR processing started."
    }
  }
}
```

---

### 2. Poll OCR Job Status

Check the processing status and get extracted data.

```graphql
query GetOcrJob {
  invoiceOcrJob(id: "660e8400-e29b-41d4-a716-446655440000") {
    id
    status  # PENDING | PROCESSING | COMPLETED | FAILED
    progress  # 0-100
    ocrProvider  # openai | google_vision | tesseract
    
    extractedData {
      invoiceNumber
      invoiceDate
      supplierName
      supplierAddress
      supplierPhone
      
      items {
        description
        quantity
        unitPrice  # In pesewas
        totalPrice  # In pesewas
        confidence  # 0-100
        
        # Smart product matches
        matches {
          productId
          productName
          matchScore  # 0-100
          matchReason  # exact_match | fuzzy_match | keyword_match
        }
        
        # Auto-fetched product image
        suggestedImageUrl
        imageSource  # RXIMAGE | OPENFDA | GOOGLE
        imageConfidence  # 0-100
      }
      
      subtotal  # In pesewas
      vat  # In pesewas
      totalAmount  # In pesewas
      confidence  # Overall OCR confidence 0-100
    }
    
    confidenceScore  # 0-100
    requiresReview  # true if confidence < 90
    errorMessage
    
    fileS3Key
    fileType
    fileSizeBytes
    supplierName
    createdByName
    createdAt
    processingCompletedAt
  }
}
```

**Response Example**:
```json
{
  "data": {
    "invoiceOcrJob": {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "status": "COMPLETED",
      "progress": 100,
      "ocrProvider": "openai",
      "extractedData": {
        "invoiceNumber": "INV-2026-001234",
        "invoiceDate": "2026-04-10",
        "supplierName": "ADD Pharma Limited",
        "supplierPhone": "0501309353",
        "items": [
          {
            "description": "Paracetamol 500mg Tablet x100",
            "quantity": 100,
            "unitPrice": 1200,
            "totalPrice": 120000,
            "confidence": 95,
            "matches": [
              {
                "productId": "770e8400-e29b-41d4-a716-446655440000",
                "productName": "Paracetamol 500mg Tablet",
                "matchScore": 100,
                "matchReason": "exact_match"
              }
            ],
            "suggestedImageUrl": "https://rximage.nlm.nih.gov/image/...",
            "imageSource": "RXIMAGE",
            "imageConfidence": 95
          },
          {
            "description": "Amoxicillin 500mg Cap x50",
            "quantity": 50,
            "unitPrice": 1500,
            "totalPrice": 75000,
            "confidence": 92,
            "matches": [
              {
                "productId": "880e8400-e29b-41d4-a716-446655440000",
                "productName": "Amoxicillin 500mg Capsule",
                "matchScore": 95,
                "matchReason": "fuzzy_match"
              }
            ],
            "suggestedImageUrl": "https://rximage.nlm.nih.gov/image/...",
            "imageSource": "RXIMAGE",
            "imageConfidence": 95
          }
        ],
        "subtotal": 195000,
        "vat": 29250,
        "totalAmount": 224250,
        "confidence": 94
      },
      "confidenceScore": 94,
      "requiresReview": false,
      "createdByName": "Ama Technician",
      "createdAt": "2026-04-10T10:30:00Z",
      "processingCompletedAt": "2026-04-10T10:30:35Z"
    }
  }
}
```

---

### 3. Confirm OCR Data & Create GRN

After reviewing the extracted data, confirm and create GRN + update inventory.

```graphql
mutation ConfirmOcrInvoice {
  confirmOcrInvoice(input: {
    ocrJobId: "660e8400-e29b-41d4-a716-446655440000"
    invoiceNumber: "INV-2026-001234"
    invoiceDate: "2026-04-10"
    dueDate: "2026-05-10"  # Optional - calculated from payment terms if not provided
    
    items: [
      {
        ocrDescription: "Paracetamol 500mg Tablet x100"
        productId: "770e8400-e29b-41d4-a716-446655440000"  # From matches or manual selection
        quantity: 100
        unitPricePesewas: 1200
        batchNumber: "BATCH-2026-001"
        expiryDate: "2028-06-30"
        productImageUrl: "https://rximage.nlm.nih.gov/image/..."  # Optional
      },
      {
        ocrDescription: "Amoxicillin 500mg Cap x50"
        productId: "880e8400-e29b-41d4-a716-446655440000"
        quantity: 50
        unitPricePesewas: 1500
        batchNumber: "BATCH-2026-002"
        expiryDate: "2027-12-31"
        productImageUrl: "https://rximage.nlm.nih.gov/image/..."
      }
    ]
    
    totalAmountPesewas: 224250
    notes: "All items received in good condition"
  }) {
    grnId
    supplierInvoiceId
    stockUpdated
    imagesProcessed
    message
  }
}
```

**Response**:
```json
{
  "data": {
    "confirmOcrInvoice": {
      "grnId": "990e8400-e29b-41d4-a716-446655440000",
      "supplierInvoiceId": "aa0e8400-e29b-41d4-a716-446655440000",
      "stockUpdated": true,
      "imagesProcessed": 2,
      "message": "GRN created successfully. 2 products stocked. 2 images processed."
    }
  }
}
```

---

### 4. Record Supplier Payment

Record full or partial payment against an invoice.

```graphql
mutation RecordSupplierPayment {
  recordSupplierPayment(input: {
    invoiceId: "aa0e8400-e29b-41d4-a716-446655440000"
    amountPesewas: 100000  # Partial payment
    paymentMethod: "MTN_MOMO"
    reference: "MOMO-TXN-123456"
    notes: "Part payment - balance to be paid next week"
  }) {
    id
    invoiceNumber
    totalAmountPesewas
    totalAmountFormatted
    paidAmountPesewas
    paidAmountFormatted
    balancePesewas
    balanceFormatted
    paymentStatus  # PARTIAL
    
    payments {
      id
      amountPesewas
      amountFormatted
      paymentMethod
      reference
      notes
      paidByName
      paidAt
    }
    
    daysOutstanding
    isOverdue
    overdueByDays
  }
}
```

**Response**:
```json
{
  "data": {
    "recordSupplierPayment": {
      "id": "aa0e8400-e29b-41d4-a716-446655440000",
      "invoiceNumber": "INV-2026-001234",
      "totalAmountPesewas": 224250,
      "totalAmountFormatted": "GH₵2,242.50",
      "paidAmountPesewas": 100000,
      "paidAmountFormatted": "GH₵1,000.00",
      "balancePesewas": 124250,
      "balanceFormatted": "GH₵1,242.50",
      "paymentStatus": "PARTIAL",
      "payments": [
        {
          "id": "bb0e8400-e29b-41d4-a716-446655440000",
          "amountPesewas": 100000,
          "amountFormatted": "GH₵1,000.00",
          "paymentMethod": "MTN_MOMO",
          "reference": "MOMO-TXN-123456",
          "notes": "Part payment - balance to be paid next week",
          "paidByName": "Azzay Owner",
          "paidAt": "2026-04-10T14:30:00Z"
        }
      ],
      "daysOutstanding": 0,
      "isOverdue": false
    }
  }
}
```

---

### 5. Get Supplier Invoice Details

Query invoice with payment history.

```graphql
query GetSupplierInvoice {
  supplierInvoice(id: "aa0e8400-e29b-41d4-a716-446655440000") {
    id
    invoiceNumber
    invoiceDate
    dueDate
    totalAmountPesewas
    totalAmountFormatted
    paidAmountPesewas
    paidAmountFormatted
    balancePesewas
    balanceFormatted
    
    paymentTerms  # IMMEDIATE | ON_DELIVERY | NET_7 | NET_30 | NET_60 | CUSTOM
    paymentStatus  # UNPAID | PARTIAL | PAID | OVERDUE
    
    daysOutstanding
    isOverdue
    overdueByDays
    
    payments {
      id
      amountPesewas
      amountFormatted
      paymentMethod
      reference
      paidByName
      paidAt
    }
    
    supplierName
    grnId
  }
}
```

---

## Frontend Implementation Guide

### Step 1: Invoice Upload UI

```typescript
// InvoiceUpload.tsx
import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { UPLOAD_SUPPLIER_INVOICE } from './graphql/mutations';

export function InvoiceUploadForm({ supplierId }: { supplierId?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadInvoice, { loading, error }] = useMutation(UPLOAD_SUPPLIER_INVOICE);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    try {
      const { data } = await uploadInvoice({
        variables: {
          input: {
            supplierId,
            invoiceFile: file,
          }
        }
      });

      // Navigate to OCR review page
      router.push(`/invoices/ocr/${data.uploadSupplierInvoice.ocrJobId}`);
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Upload Invoice (PDF or Image)</label>
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </div>
      
      <button type="submit" disabled={!file || loading}>
        {loading ? 'Uploading...' : 'Upload Invoice'}
      </button>
      
      {error && <div className="error">{error.message}</div>}
    </form>
  );
}
```

### Step 2: OCR Processing & Review UI

```typescript
// OcrReview.tsx
import { useQuery } from '@apollo/client';
import { GET_OCR_JOB } from './graphql/queries';

export function OcrReviewPage({ ocrJobId }: { ocrJobId: string }) {
  const { data, loading, error } = useQuery(GET_OCR_JOB, {
    variables: { id: ocrJobId },
    pollInterval: 2000, // Poll every 2 seconds while processing
    skip: !ocrJobId,
  });

  const job = data?.invoiceOcrJob;

  if (loading && !job) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  // Show progress while processing
  if (job.status === 'PENDING' || job.status === 'PROCESSING') {
    return (
      <div>
        <h2>Processing Invoice...</h2>
        <ProgressBar value={job.progress} max={100} />
        <p>{job.progress}% complete</p>
      </div>
    );
  }

  // Show error if failed
  if (job.status === 'FAILED') {
    return (
      <div>
        <h2>OCR Processing Failed</h2>
        <p>{job.errorMessage}</p>
        <button onClick={() => router.push('/invoices/upload')}>
          Try Again
        </button>
      </div>
    );
  }

  // Show extracted data for review
  const { extractedData } = job;

  return (
    <div>
      <h2>Review Invoice Data</h2>
      
      {job.requiresReview && (
        <div className="warning">
          ⚠️ Low confidence ({job.confidenceScore}%). Please review carefully.
        </div>
      )}

      <div className="invoice-header">
        <div>
          <label>Invoice Number</label>
          <input defaultValue={extractedData.invoiceNumber} />
        </div>
        <div>
          <label>Invoice Date</label>
          <input type="date" defaultValue={extractedData.invoiceDate} />
        </div>
        <div>
          <label>Supplier</label>
          <input defaultValue={extractedData.supplierName} />
        </div>
      </div>

      <h3>Items</h3>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Matched Product</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Total</th>
            <th>Image</th>
          </tr>
        </thead>
        <tbody>
          {extractedData.items.map((item, index) => (
            <tr key={index}>
              <td>{item.description}</td>
              <td>
                {item.matches.length > 0 ? (
                  <select defaultValue={item.matches[0].productId}>
                    {item.matches.map(match => (
                      <option key={match.productId} value={match.productId}>
                        {match.productName} ({match.matchScore}% match)
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="warning">No match - select manually</span>
                )}
              </td>
              <td>{item.quantity}</td>
              <td>GH₵{(item.unitPrice / 100).toFixed(2)}</td>
              <td>GH₵{(item.totalPrice / 100).toFixed(2)}</td>
              <td>
                {item.suggestedImageUrl && (
                  <img 
                    src={item.suggestedImageUrl} 
                    alt={item.description}
                    width="50"
                    title={`${item.imageSource} (${item.imageConfidence}% confidence)`}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="invoice-total">
        <div>Subtotal: GH₵{(extractedData.subtotal / 100).toFixed(2)}</div>
        <div>VAT: GH₵{(extractedData.vat / 100).toFixed(2)}</div>
        <div><strong>Total: GH₵{(extractedData.totalAmount / 100).toFixed(2)}</strong></div>
      </div>

      <button onClick={handleConfirm}>
        Confirm & Create GRN
      </button>
    </div>
  );
}
```

### Step 3: Confirm & Create GRN

```typescript
const handleConfirm = async () => {
  const { data } = await confirmOcrInvoice({
    variables: {
      input: {
        ocrJobId,
        invoiceNumber: extractedData.invoiceNumber,
        invoiceDate: extractedData.invoiceDate,
        items: extractedData.items.map(item => ({
          ocrDescription: item.description,
          productId: selectedProductIds[item.description], // From user selection
          quantity: item.quantity,
          unitPricePesewas: item.unitPrice,
          batchNumber: batchNumbers[item.description], // From user input
          expiryDate: expiryDates[item.description], // From user input
          productImageUrl: item.suggestedImageUrl,
        })),
        totalAmountPesewas: extractedData.totalAmount,
      }
    }
  });

  // Show success message
  toast.success(data.confirmOcrInvoice.message);
  
  // Navigate to GRN details
  router.push(`/grn/${data.confirmOcrInvoice.grnId}`);
};
```

---

## UI/UX Recommendations

### Invoice Upload Page
- **Drag & drop** file upload
- **Camera capture** for mobile (take photo of invoice)
- **Recent suppliers** quick select
- **File preview** before upload
- **Progress indicator** during upload

### OCR Review Page
- **Real-time progress** with animated spinner
- **Confidence indicators** (color-coded: green >90%, yellow 70-90%, red <70%)
- **Product match suggestions** with scores
- **Inline editing** for corrections
- **Image preview** for matched products
- **Batch/expiry date** input fields
- **Total validation** (ensure items sum to total)

### Payment Tracking
- **Payment history timeline**
- **Part payment support** with balance display
- **Overdue alerts** (red badge)
- **Payment method icons** (MoMo, Cash, Bank)
- **Quick payment** button for common amounts

---

## Error Handling

### Common Errors

1. **Invalid file type**
```json
{
  "errors": [{
    "message": "Invalid file type: application/msword. Allowed: PDF, PNG, JPG",
    "extensions": { "code": "BAD_REQUEST" }
  }]
}
```

2. **OCR processing failed**
```json
{
  "errors": [{
    "message": "Failed to extract invoice data from OCR response",
    "extensions": { "code": "OCR_FAILED" }
  }]
}
```

3. **No product matches**
- Show manual product selection dropdown
- Allow creating new product on-the-fly

4. **Payment exceeds balance**
```json
{
  "errors": [{
    "message": "Payment amount (150000) exceeds remaining balance (124250)",
    "extensions": { "code": "BAD_REQUEST" }
  }]
}
```

---

## Testing

### Test Data

**Test Invoice Image**: Use any supplier invoice photo/PDF

**Expected OCR Results**:
- Invoice number extracted
- Date extracted
- Items with quantities and prices
- Product matches found (if products exist in DB)
- Images fetched for matched products

### Test Flow

1. Upload invoice → Get OCR job ID
2. Poll job status → Wait for COMPLETED
3. Review extracted data → Verify accuracy
4. Confirm → Create GRN
5. Record payment → Update invoice status

---

## Performance

- **Upload**: < 2 seconds
- **OCR Processing**: 20-40 seconds (GPT-4 Vision)
- **Product Matching**: < 5 seconds
- **Image Fetching**: 2-5 seconds per product
- **Total**: ~30-60 seconds for complete processing

---

## Next Steps

After implementing Phase 1, we'll add:
- **Phase 2**: Enhanced accounting & financial intelligence
- **Phase 3**: Mobile Money integration
- **Phase 4**: SaaS onboarding & API keys

---

**Status**: ✅ READY FOR FRONTEND INTEGRATION
**API**: LIVE on http://localhost:4000/graphql
**Documentation**: Complete with examples
