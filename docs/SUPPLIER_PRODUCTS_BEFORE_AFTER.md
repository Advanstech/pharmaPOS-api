# Supplier-Product Sync: Before vs After

## Before the Fix ❌

### What You Saw
```
Jojo Pharmacy
9 SKUs · score 75

Products shown: 0-3 (only those with stock alerts)
```

**Problem**: Only products with stock issues appeared. New products with adequate stock were invisible.

### Query Used
```graphql
query {
  supplierRestockWatch {
    supplierId
    supplierName
    totalTrackedProducts  # Total count
    affectedProducts {    # Only products with issues!
      productName
      stockStatus
    }
  }
}
```

### Why It Failed
- `affectedProducts` only includes products with `stockStatus` = low, critical, or out
- New products with adequate stock don't appear
- Products with zero stock but above critical threshold don't appear

---

## After the Fix ✅

### What You See Now
```
Jojo Pharmacy
9 SKUs · score 75

Products shown: ALL 9 products
- BONJELA ADULT GEL (out)
- CALAMINE LOTION (out)
- CITY BLOOD TONIC (out)
- Homiamin Ginseng (out)
- METFORMIN DENK 500MG (out)
- NOOTROPIL PIRACETAM (out)
- SALBUTAMOL NEBULES 2.5MG (out)
- TAMSULOSIN 400MCG (out)
- TETANUS INJECTION (out)
```

**Solution**: New query shows ALL products, regardless of stock status.

### New Query Available
```graphql
query {
  supplierWithProducts(id: "supplier-id") {
    supplierId
    supplierName
    totalProducts        # Total count
    products {           # ALL products!
      productId
      productName
      quantityOnHand
      reorderLevel
      stockStatus
      sold7d
      sold30d
    }
  }
}
```

### Why It Works
- `products` includes ALL products with `supplier_id` set
- Shows products with any stock level (0, low, adequate, high)
- Includes rich data: stock, sales velocity, status

---

## Comparison Table

| Feature | Before (supplierRestockWatch) | After (supplierWithProducts) |
|---------|-------------------------------|------------------------------|
| **Purpose** | Restock alerts | Complete catalog |
| **Products Shown** | Only with stock issues | ALL products |
| **New Products** | ❌ Hidden if adequate stock | ✅ Always visible |
| **Stock Data** | ✅ Yes | ✅ Yes |
| **Sales Velocity** | ✅ 7-day only | ✅ 7-day + 30-day |
| **Use Case** | "What needs reordering?" | "What do we buy from this supplier?" |

---

## Real Example: Jojo Pharmacy

### Before Fix
```json
{
  "supplierRestockWatch": [
    {
      "supplierId": "jojo-id",
      "supplierName": "Jojo Pharmacy",
      "totalTrackedProducts": 9,
      "affectedProducts": [
        // Only 9 products with stock issues
        // If you add a new product with stock, it won't appear here!
      ]
    }
  ]
}
```

### After Fix
```json
{
  "supplierWithProducts": {
    "id": "jojo-id",
    "name": "Jojo Pharmacy",
    "totalProducts": 9,
    "products": [
      {
        "id": "prod-1",
        "name": "BONJELA ADULT GEL",
        "quantityOnHand": 0,
        "reorderLevel": 30,
        "stockStatus": "out",
        "sold7d": 0,
        "sold30d": 0
      },
      {
        "id": "prod-2",
        "name": "CALAMINE LOTION",
        "quantityOnHand": 0,
        "reorderLevel": 30,
        "stockStatus": "out",
        "sold7d": 0,
        "sold30d": 0
      },
      // ... ALL 9 products, including any new ones!
    ]
  }
}
```

---

## Use Cases

### Use Case 1: Restock Alerts (Use OLD query)
**Question**: "Which products need reordering?"

**Query**: `supplierRestockWatch`

**Result**: Only products with low/critical/out stock

---

### Use Case 2: Complete Catalog (Use NEW query)
**Question**: "What products do we buy from this supplier?"

**Query**: `supplierWithProducts`

**Result**: ALL products, regardless of stock

---

### Use Case 3: Verify New Product (Use NEW query)
**Question**: "Did my new product get linked to the supplier?"

**Query**: `supplierWithProducts`

**Result**: Yes! New product appears immediately

---

## Frontend Implementation

### Current (Alerts Only)
```typescript
const { data } = useQuery(SUPPLIER_RESTOCK_WATCH);

// Shows only products with stock issues
supplier.affectedProducts.map(product => (
  <ProductCard product={product} />
))
```

### Recommended (Complete Catalog)
```typescript
const [viewMode, setViewMode] = useState<'alerts' | 'all'>('alerts');

const { data: alerts } = useQuery(SUPPLIER_RESTOCK_WATCH);
const { data: catalog } = useQuery(SUPPLIER_WITH_PRODUCTS_QUERY, {
  variables: { id: supplier.id },
  skip: viewMode !== 'all',
});

// Toggle between views
<button onClick={() => setViewMode(viewMode === 'alerts' ? 'all' : 'alerts')}>
  {viewMode === 'alerts' ? 'View All Products' : 'View Alerts Only'}
</button>

// Show appropriate list
{viewMode === 'alerts' 
  ? alerts.affectedProducts.map(...)
  : catalog.products.map(...)
}
```

---

## Key Takeaway

**Two Queries, Two Purposes**:

1. **`supplierRestockWatch`** = "What needs attention?" (Alerts)
2. **`supplierWithProducts`** = "What do we sell?" (Catalog)

Both are useful! Use the right one for your use case.

---

**Last Updated**: April 10, 2026
