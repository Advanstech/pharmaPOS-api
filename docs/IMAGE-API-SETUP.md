# Product Image API Setup Guide

## Quick Start (Free APIs Only)

**Good news**: RxImage and OpenFDA work immediately with no setup! These cover 85-95% of pharmaceutical products.

Just run:
```bash
npm run dev
```

The system will automatically fetch images from RxImage and OpenFDA when you create products.

## Enhanced Setup (Optional)

For better coverage of OTC and chemical shop products, add these optional APIs:

### 1. Google Custom Search API (100 free queries/day)

**Why**: Better coverage for non-pharmaceutical products (cosmetics, cleaning supplies, etc.)

**Setup Steps**:

1. **Get Google API Key**:
   - Go to: https://console.cloud.google.com/apis/credentials
   - Click "Create Credentials" → "API Key"
   - Copy the API key

2. **Enable Custom Search API**:
   - Go to: https://console.cloud.google.com/apis/library
   - Search for "Custom Search API"
   - Click "Enable"

3. **Create Custom Search Engine**:
   - Go to: https://programmablesearchengine.google.com/
   - Click "Add" to create new search engine
   - Set "Sites to search": `www.google.com` (search entire web)
   - Enable "Image search"
   - Copy the "Search engine ID" (cx parameter)

4. **Add to .env**:
   ```bash
   GOOGLE_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   GOOGLE_CSE_ID=017576662512468239146:omuauf_lfve
   ```

**Cost**: 100 queries/day FREE, then $5 per 1,000 queries

### 2. Unsplash API (50 free requests/hour)

**Why**: High-quality stock photos for generic pharmaceutical imagery

**Setup Steps**:

1. **Create Unsplash Account**:
   - Go to: https://unsplash.com/join
   - Sign up (free)

2. **Create Application**:
   - Go to: https://unsplash.com/oauth/applications
   - Click "New Application"
   - Accept terms
   - Fill in application details:
     - Name: "PharmaPOS Pro"
     - Description: "Product image sourcing for pharmacy POS"

3. **Get Access Key**:
   - Copy the "Access Key" from your application page

4. **Add to .env**:
   ```bash
   UNSPLASH_ACCESS_KEY=your_access_key_here
   ```

**Cost**: 50 requests/hour FREE (1,200/day)

### 3. OpenAI DALL-E 3 (Optional, Paid)

**Why**: Generate images for products not found in any database (last resort)

**Setup Steps**:

1. **Get OpenAI API Key**:
   - Go to: https://platform.openai.com/api-keys
   - Click "Create new secret key"
   - Copy the key (starts with `sk-`)

2. **Add to .env**:
   ```bash
   OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

**Cost**: $0.04 per image (1024x1024 standard quality)

**Note**: Already configured if you're using OpenAI for other features.

## Complete .env Example

```bash
# Database (Required)
DATABASE_URL=postgresql://user:pass@host:6543/db?pgbouncer=true
DATABASE_DIRECT_URL=postgresql://user:pass@host:5432/db

# JWT (Required)
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# Redis (Required)
REDIS_URL=redis://default:pass@host:6379

# S3 Storage (Required)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=pharmapos-images

# AI Image APIs (Optional - Free)
GOOGLE_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_CSE_ID=017576662512468239146:omuauf_lfve
UNSPLASH_ACCESS_KEY=your_unsplash_access_key

# AI Image APIs (Optional - Paid)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Testing Your Setup

### 1. Test RxImage (Free, No Setup)
```bash
curl "https://rximage.nlm.nih.gov/api/rximage/1/rxnav?name=amoxicillin"
```

Expected response:
```json
{
  "nlmRxImages": [
    {
      "imageUrl": "https://rximage.nlm.nih.gov/image/...",
      "name": "Amoxicillin 500 MG Oral Capsule"
    }
  ]
}
```

### 2. Test OpenFDA (Free, No Setup)
```bash
curl "https://api.fda.gov/drug/label.json?search=openfda.brand_name:\"Coartem\"&limit=1"
```

### 3. Test Google Custom Search (Requires Setup)
```bash
curl "https://www.googleapis.com/customsearch/v1?key=YOUR_API_KEY&cx=YOUR_CSE_ID&q=paracetamol+pharmaceutical&searchType=image&num=1"
```

### 4. Test Unsplash (Requires Setup)
```bash
curl -H "Authorization: Client-ID YOUR_ACCESS_KEY" \
  "https://api.unsplash.com/search/photos?query=medicine+pharmaceutical&per_page=1"
```

### 5. Test via GraphQL
```graphql
mutation {
  createProduct(input: {
    name: "Amoxicillin 500mg Capsule"
    genericName: "Amoxicillin 500mg"
    classification: "POM"
    unitPrice: 1200
    requiresRx: true
  }) {
    id
    name
    imageUrl
  }
}
```

Wait 2-5 seconds, then query:
```graphql
query {
  product(id: "your-product-id") {
    id
    name
    imageUrl
    images {
      cdnUrl
      source
      metadata
    }
  }
}
```

## Troubleshooting

### "No images found for product"

**Possible causes**:
1. Product name is too generic or misspelled
2. API rate limits exceeded
3. Network connectivity issues

**Solutions**:
1. Check product name spelling
2. Try generic name instead of brand name
3. Enable Google Custom Search for better coverage
4. Wait a few minutes and retry (rate limits)

### "Google API error: 403 Forbidden"

**Cause**: API key not enabled for Custom Search API

**Solution**:
1. Go to: https://console.cloud.google.com/apis/library
2. Search "Custom Search API"
3. Click "Enable"

### "Unsplash API error: 401 Unauthorized"

**Cause**: Invalid access key

**Solution**:
1. Check access key in .env matches Unsplash dashboard
2. Ensure no extra spaces or quotes
3. Regenerate access key if needed

### "OpenAI API error: Insufficient quota"

**Cause**: No credits in OpenAI account

**Solution**:
1. Add payment method: https://platform.openai.com/account/billing
2. Add credits ($5 minimum)
3. Or disable DALL-E by removing OPENAI_API_KEY

## Rate Limits Summary

| API | Free Tier | Paid Tier | Reset Period |
|-----|-----------|-----------|--------------|
| RxImage | Unlimited | N/A | N/A |
| OpenFDA | 240/min, 120k/day | N/A | Per minute/day |
| Google | 100/day | $5/1000 | Per day |
| Unsplash | 50/hour | N/A | Per hour |
| OpenAI | N/A | $0.04/image | N/A |

## Best Practices

### 1. Start with Free APIs
RxImage + OpenFDA cover 85-95% of pharmaceutical products. Only add paid APIs if needed.

### 2. Batch Process During Off-Hours
```bash
# Run at 2 AM to avoid rate limits
npm run ai:fetch-images -- --limit 500
```

### 3. Monitor API Usage
```sql
-- Check image sources
SELECT source, COUNT(*) as count, AVG((metadata->>'confidence')::int) as avg_confidence
FROM product_images
WHERE is_approved = true
GROUP BY source
ORDER BY count DESC;
```

### 4. Review Low-Confidence Images
```sql
-- Find images that need manual review
SELECT p.name, pi.cdn_url, pi.source, pi.metadata->>'confidence' as confidence
FROM products p
JOIN product_images pi ON pi.product_id = p.id
WHERE pi.is_approved = true 
  AND (pi.metadata->>'confidence')::int < 70
ORDER BY (pi.metadata->>'confidence')::int ASC
LIMIT 20;
```

### 5. Set Up Weekly Refresh
Add to your cron jobs:
```typescript
// Refresh low-confidence images every Sunday at 3 AM
@Cron('0 3 * * 0')
async refreshLowConfidenceImages() {
  await this.imagePipeline.add('refresh-low-confidence-images', {});
}
```

## Cost Optimization

### Scenario 1: Small Pharmacy (500 products)
- **Free APIs**: Cover ~425 products (85%)
- **Google**: 75 products × $0.005 = $0.38
- **Total**: ~$0.38 one-time cost

### Scenario 2: Medium Pharmacy (1,500 products)
- **Free APIs**: Cover ~1,275 products (85%)
- **Google**: 225 products × $0.005 = $1.13
- **Total**: ~$1.13 one-time cost

### Scenario 3: Large Chain (5,000 products)
- **Free APIs**: Cover ~4,250 products (85%)
- **Google**: 750 products × $0.005 = $3.75
- **Total**: ~$3.75 one-time cost

**Note**: These are one-time costs. Images are cached in S3, so you never pay twice for the same product.

## Support

### Documentation
- Main docs: `docs/AI-PRODUCT-IMAGES.md`
- API reference: `docs/REST-AND-GRAPHQL-REFERENCE.md`

### API Documentation
- RxImage: https://rximage.nlm.nih.gov/docs/
- OpenFDA: https://open.fda.gov/apis/
- Google: https://developers.google.com/custom-search/v1/overview
- Unsplash: https://unsplash.com/documentation
- OpenAI: https://platform.openai.com/docs/guides/images

### Contact
- Email: support@advansis.com
- GitHub: https://github.com/advansis/pharmapos-api/issues
