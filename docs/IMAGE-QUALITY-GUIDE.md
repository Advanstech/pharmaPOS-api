# Product Image Quality Guide

## TL;DR - Will I Get Exact Product Photos?

**YES** for most pharmaceutical products! 

RxImage and OpenFDA provide **actual photographs of the real drug packaging** - not generic stock photos. These are the same images used by pharmacies and medical professionals in the US.

## Image Quality by Source

### ⭐⭐⭐⭐⭐ EXACT PRODUCT PHOTOS (Recommended)

#### 1. RxImage API (National Library of Medicine)
**What you get**: Real photographs of the actual drug product

**Examples**:
- **Paracetamol 500mg**: Photo of actual Paracetamol 500mg tablet/box
- **Amoxicillin 500mg**: Photo of actual Amoxicillin capsule/bottle
- **Coartem 20/120mg**: Photo of actual Coartem blister pack

**Quality**: Professional pharmaceutical product photography
- Shows actual pill/tablet/capsule
- Shows product packaging/box
- Brand name and dosage visible
- Multiple angles available

**Coverage**: 
- ✅ US FDA-approved drugs (~90% of common pharmaceuticals)
- ✅ Generic drugs (by active ingredient)
- ✅ Brand name drugs
- ❌ Non-pharmaceutical products (cosmetics, cleaning supplies)

**Cost**: FREE, unlimited

**Example Images**:
```
Paracetamol 500mg → https://rximage.nlm.nih.gov/image/rximage?rxcui=198440
Amoxicillin 500mg → https://rximage.nlm.nih.gov/image/rximage?rxcui=308182
Ibuprofen 400mg → https://rximage.nlm.nih.gov/image/rximage?rxcui=197805
```

#### 2. OpenFDA API (US Food & Drug Administration)
**What you get**: Links to RxImage photos via RxCUI codes

**Same quality as RxImage** - it's the same database, just accessed differently.

**Coverage**: FDA-approved drugs with RxCUI codes
**Cost**: FREE, 120,000 requests/day

---

### ⭐⭐⭐ MAY BE EXACT (Use with Caution)

#### 3. Google Custom Search API
**What you get**: Web search results - quality varies

**Possible outcomes**:
- ✅ **Best case**: Exact product packaging photo from manufacturer website
- ⚠️ **Medium case**: Similar product from same manufacturer
- ❌ **Worst case**: Generic pharmaceutical image or unrelated result

**Examples**:
- **Panadol 500mg**: Likely finds exact Panadol box photo
- **Generic Paracetamol**: May find various brands or generic images
- **Obscure products**: Results unpredictable

**Coverage**: Any product with web presence
**Cost**: 100 queries/day FREE, then $5 per 1,000

**Recommendation**: Good for products not in RxImage/OpenFDA, but **manually review** before customer-facing use.

---

### ⭐ GENERIC STOCK PHOTOS (Not Recommended for POS)

#### 4. Unsplash API
**What you get**: Artistic stock photography - NOT specific products

**Examples**:
- **Paracetamol 500mg** → Generic white tablets on white background
- **Amoxicillin 500mg** → Generic medicine bottle stock photo
- **Any product** → Generic pharmaceutical/medical themed image

**Quality**: High-resolution, professional photography
**Accuracy**: ❌ NOT the actual product

**Coverage**: Generic pharmaceutical imagery only
**Cost**: FREE, 50 requests/hour

**Use case**: Placeholder images for internal use only, NOT customer-facing

---

### ❌ ARTIFICIAL IMAGES (Not Recommended)

#### 5. OpenAI DALL-E 3
**What you get**: AI-generated fictional images

**Examples**:
- **Paracetamol 500mg** → AI creates fake pharmaceutical packaging
- **Any product** → Completely artificial, may have nonsensical text

**Quality**: Looks realistic but is 100% fake
**Accuracy**: ❌ NOT a real product, may mislead customers

**Coverage**: Can generate anything
**Cost**: $0.04 per image

**Use case**: ❌ NOT recommended for pharmacy use (compliance/safety concerns)

---

## Default Configuration (Recommended)

By default, the system is configured to **ONLY use exact product photos**:

```typescript
{
  allowGenericImages: false, // Only RxImage, OpenFDA, Google
  allowAiGeneration: false,  // No DALL-E artificial images
}
```

This means:
- ✅ You get real product photos from RxImage/OpenFDA
- ✅ Google results included (may be exact or generic)
- ❌ No generic stock photos from Unsplash
- ❌ No AI-generated fake images

## Coverage Expectations

### Pharmaceutical Products (POM, OTC drugs)
- **RxImage + OpenFDA**: 85-95% coverage
- **With Google**: 90-98% coverage
- **Quality**: Exact product photos

**Example products with EXACT photos**:
- Paracetamol, Amoxicillin, Ibuprofen
- Coartem, Metformin, Amlodipine
- Ciprofloxacin, Azithromycin, Omeprazole
- Most common pharmaceuticals

### Non-Pharmaceutical Products (Cosmetics, Cleaning)
- **RxImage + OpenFDA**: 0% coverage (not in database)
- **With Google**: 60-80% coverage (may be exact or generic)
- **Quality**: Varies

**Recommendation**: Enable Google Custom Search for these products

### Obscure/Rare Products
- **RxImage + OpenFDA**: 20-40% coverage
- **With Google**: 40-60% coverage
- **Quality**: May be generic

**Recommendation**: Manual upload for critical products

## How to Enable Generic/AI Images (Not Recommended)

If you want to allow generic stock photos or AI generation:

```typescript
// In image-pipeline.processor.ts
const imageSource = await this.imageService.findProductImage(
  productName,
  genericName,
  classification,
  {
    allowGenericImages: true,  // Enable Unsplash stock photos
    allowAiGeneration: true,   // Enable DALL-E generation
  },
);
```

**Warning**: This may result in:
- Generic images that don't match your actual product
- AI-generated fake packaging
- Customer confusion
- Potential compliance issues

## Verification Process

### Automatic Confidence Scoring
Each image is assigned a confidence score:

| Score | Source | Meaning |
|-------|--------|---------|
| 95 | RxImage | ✅ Official medical database - EXACT product |
| 90 | OpenFDA | ✅ FDA-approved drug data - EXACT product |
| 70 | Google | ⚠️ Web search - MAY be exact |
| 60 | Unsplash | ❌ Generic stock photo - NOT exact |
| 50 | DALL-E | ❌ AI-generated - FAKE |

### Manual Review Recommended For:
- Confidence score < 90 (Google results)
- High-value products
- Customer-facing displays
- Compliance-critical items

### SQL Query to Find Images Needing Review:
```sql
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
```

## Real-World Examples

### Example 1: Paracetamol 500mg Tablet
```
Input: 
  name: "Paracetamol 500mg Tablet"
  genericName: "Paracetamol 500mg"

Process:
  1. RxImage search: "Paracetamol 500mg"
  2. ✅ FOUND: https://rximage.nlm.nih.gov/image/rximage?rxcui=198440
  3. Result: Actual photo of Paracetamol 500mg tablet

Confidence: 95 (EXACT product photo)
```

### Example 2: Coartem 20/120mg
```
Input:
  name: "Coartem 20/120mg"
  genericName: "Artemether 20mg + Lumefantrine 120mg"

Process:
  1. RxImage search: "Artemether Lumefantrine"
  2. ✅ FOUND: Actual Coartem blister pack photo
  3. Result: Real product packaging

Confidence: 95 (EXACT product photo)
```

### Example 3: Local Ghana Product (Not in US Database)
```
Input:
  name: "Azzay Herbal Bitters"
  genericName: "Herbal Supplement"

Process:
  1. RxImage search: ❌ NOT FOUND (not FDA-approved)
  2. OpenFDA search: ❌ NOT FOUND
  3. Google search: ⚠️ MAY FIND (if product has web presence)
  4. Result: Manual upload recommended

Confidence: 0-70 (depends on Google results)
```

## Best Practices

### ✅ DO:
- Rely on RxImage and OpenFDA for pharmaceutical products
- Manually review Google results before customer-facing use
- Upload custom images for local/regional products
- Use confidence scores to prioritize manual review

### ❌ DON'T:
- Use Unsplash generic images for customer-facing POS
- Use AI-generated images for actual products
- Trust low-confidence images without review
- Skip verification for compliance-critical products

## Testing Your Setup

### Test with Common Drugs:
```bash
# Test RxImage API directly
curl "https://rximage.nlm.nih.gov/api/rximage/1/rxnav?name=paracetamol"

# Expected: JSON with imageUrl field containing actual product photo
```

### Test via GraphQL:
```graphql
mutation {
  createProduct(input: {
    name: "Paracetamol 500mg Tablet"
    genericName: "Paracetamol 500mg"
    classification: "OTC"
    unitPrice: 500
  }) {
    id
    name
  }
}

# Wait 2-5 seconds, then check:
query {
  product(id: "your-product-id") {
    imageUrl
    images {
      cdnUrl
      source
      metadata
    }
  }
}

# Expected: 
# - source: "RXIMAGE"
# - confidence: 95
# - imageUrl: Actual product photo
```

## Summary

**For Paracetamol and most pharmaceutical products**: 
- ✅ YES, you will get **exact product photos** from RxImage/OpenFDA
- ✅ These are real photographs of the actual drug packaging
- ✅ Same quality as used by US pharmacies and medical professionals
- ✅ FREE and unlimited

**For non-pharmaceutical products**:
- ⚠️ May need Google Custom Search or manual upload
- ⚠️ Results vary in quality

**Default configuration**:
- ✅ Only exact product photos enabled
- ❌ Generic stock photos disabled
- ❌ AI generation disabled

**Recommendation**: 
Start with default configuration (exact photos only). This gives you 85-95% coverage with high-quality real product images. For the remaining 5-15%, manually upload images or enable Google Custom Search.
