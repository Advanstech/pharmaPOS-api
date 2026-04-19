# Testing Supplier-Product Synchronization

## Quick Test Guide

### Test 1: Verify Existing Products Appear

**GraphQL Query**:
```graphql
query TestSupplierProducts {
  supplierRestockWatch {
    supplierId
    supplierName
    totalTrackedProducts
    affectedProducts {
      productId
      productName
      stockStatus
    }
  }
}
```

**Expected**: Shows suppliers with their products (only those with stock issues)

---

### Test 2: View Complete Product Catalog

**GraphQL Query**:
```graphql
query TestCompleteC atalog($supplierId: String!) {
  supplierWithProducts(id: $supplierId) {
    name
    totalProducts
    products {
      id
      name
      quantityOnHand
      stockStatus
      sold7d
      sold30d
    }
  }
}
```

**Variables**:
```json
{
  "supplierId": "your-supplier-id-here"
}
```

**Expected**: Shows ALL products for the supplier, including those with adequate stock

---

### Test 3: Create New Product and Verify

**Step 1: Create Product**
```graphql
mutation CreateTestProduct($input: CreateProductInput!) {
  createProduct(input: $input) {
    id
    name
    supplierId
  }
}
```

**Variables**:
```json
{
  "input": {
    "name": "Test Product - Vitamin C 1000mg",
    "genericName": "Ascorbic Acid",
    "unitPrice": 2500,
    "classification": "OTC",
    "branchType": "both",
    "supplierId": "your-supplier-id-here",
    "reorderLevel": 20
  }
}
```

**Step 2: Verify Product Appears**
```graphql
query VerifyNewProduct($supplierId: String!) {
  supplierWithProducts(id: $supplierId) {
    name
    totalProducts
    products {
      name
      quantityOnHand
      stockStatus
    }
  }
}
```

**Expected**: The new product appears in the list with `quantityOnHand: 0` and `stockStatus: "out"`

---

### Test 4: Add Stock and Verify Status

**Step 1: Receive Stock (Create GRN)**
```graphql
mutation ReceiveStock($input: CreateGRNInput!) {
  createGRN(input: $input) {
    id
    totalAmountFormatted
  }
}
```

**Variables**:
```json
{
  "input": {
    "supplierId": "your-supplier-id-here",
    "supplierInvoiceNumber": "INV-TEST-001",
    "invoiceDate": "2026-04-10",
    "items": [
      {
        "productId": "your-new-product-id",
        "quantity": 100,
        "unitCostPesewas": 2000,
        "batchNumber": "BATCH-001",
        "expiryDate": "2027-04-10"
      }
    ],
    "totalAmountPesewas": 200000
  }
}
```

**Step 2: Verify Stock Status Updated**
```graphql
query VerifyStockUpdate($supplierId: String!) {
  supplierWithProducts(id: $supplierId) {
    products {
      name
      quantityOnHand
      stockStatus
    }
  }
}
```

**Expected**: Product now shows `quantityOnHand: 100` and `stockStatus: "ok"`

---

## GraphQL Playground Testing

### 1. Open GraphQL Playground
```
http://127.0.0.1:4000/graphql
```

or

```
https://happy-happiness-production-fd76.up.railway.app/graphql
```

### 2. Set Authorization Header
```json
{
  "Authorization": "Bearer your-jwt-token-here"
}
```

### 3. Run Queries
Copy and paste the queries above into the playground and execute them.

---

## Expected Results Summary

| Test | Query | Expected Result |
|------|-------|-----------------|
| 1 | `supplierRestockWatch` | Shows suppliers with stock alerts only |
| 2 | `supplierWithProducts` | Shows ALL products for supplier |
| 3 | Create + Query | New product appears immediately |
| 4 | Add Stock + Query | Stock status updates correctly |

---

## Troubleshooting

### Issue: "No products found"
**Check**:
1. Does the supplier have any products with `supplier_id` set?
2. Are the products `is_active = true`?
3. Is the user's branch correct?

**SQL Query to Verify**:
```sql
SELECT p.id, p.name, p.supplier_id, p.is_active
FROM products p
WHERE p.supplier_id = 'your-supplier-id'
  AND p.is_active = true;
```

### Issue: "Supplier not found"
**Check**:
1. Is the supplier ID correct?
2. Is the supplier `is_active = true`?

**SQL Query to Verify**:
```sql
SELECT id, name, is_active
FROM suppliers
WHERE id = 'your-supplier-id';
```

### Issue: "Stock status not updating"
**Check**:
1. Does the product have an inventory record for the branch?
2. Was the GRN created successfully?

**SQL Query to Verify**:
```sql
SELECT inv.product_id, inv.quantity_on_hand, inv.reorder_level
FROM inventory inv
WHERE inv.product_id = 'your-product-id'
  AND inv.branch_id = 'your-branch-id';
```

---

## Success Criteria

✅ **Test Passes If**:
1. `supplierWithProducts` returns all products for a supplier
2. New products appear immediately after creation
3. Products with adequate stock are visible (not just alerts)
4. Stock status is calculated correctly
5. Sales velocity (7d, 30d) is accurate

---

**Last Updated**: April 10, 2026
