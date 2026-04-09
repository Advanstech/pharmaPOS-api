# AI-Powered Product Image Sourcing

## Overview

PharmaPOS Pro automatically sources high-quality product images from multiple free and paid APIs, eliminating the need for manual image uploads for every product in your catalog.

## Image Sources (Priority Order)

### 1. RxImage API (National Library of Medicine)
- **Cost**: FREE, no authentication required
- **Quality**: ⭐⭐⭐⭐⭐ (Highest - official medical database)
- **Coverage**: US FDA-approved drugs
- **Rate Limit**: No limit
- **Best For**: Generic drug names (e.g., "Amoxicillin 500mg")

**Example**:
```
Product: Amoxicillin 500mg Capsule
Generic: Amoxicillin 500mg
→ RxImage API returns official product photo
```

### 2. OpenFDA API (US Food & Drug Administration)
- **Cost**: FREE, no authentication required
- **Quality**: ⭐⭐⭐⭐⭐ (Official FDA data)
- **Coverage**: FDA-approved drugs with RxCUI codes
- **Rate Limit**: 240 requests/minute, 120,000 requests/day
- **Best For**: Brand names and FDA-approved medications

**Example**:
```
Product: Coartem 20/120mg
→ OpenFDA API returns RxCUI → RxImage URL
```

### 3. Google Custom Search API
- **Cost**: 100 queries/day FREE, then $5 per 1,000 queries
- **Quality**: ⭐⭐⭐⭐ (Web search results)
- **Coverage**: Any product with web presence
- **Rate Limit**: 100/day free tier
- **Best For**: Products not in medical databases
- **Setup Required**: Google API Key + Custom Search Engine ID

**Environment Variables**:
```bash
GOOGLE_API_KEY=your_google_api_key
GOOGLE_CSE_ID=your_custom_search_engine_id
```

### 4. Unsplash API
- **Cost**: FREE (50 requests/hour)
- **Quality**: ⭐⭐⭐ (High-quality stock photos)
- **Coverage**: Generic pharmaceutical imagery
- **Rate Limit**: 50 requests/hour
- **Best For**: Fallback when specific product not found
- **Setup Required**: Unsplash Access Key

**Environment Variables**:
```bash
UNSPLASH_ACCESS_KEY=your_unsplash_access_key
```

### 5. OpenAI DALL-E 3 (AI Generation)
- **Cost**: $0.04 per image (1024x1024 standard quality)
- **Quality**: ⭐⭐ (AI-generated, not real product)
- **Coverage**: Any product description
- **Rate Limit**: Based on OpenAI account tier
- **Best For**: Last resort when no real images available
- **Setup Required**: OpenAI API Key (already configured)

**Note**: AI generation is disabled for CONTROLLED substances for compliance reasons.

## Setup Instructions

### Minimal Setup (Free APIs Only)
No configuration needed! RxImage and OpenFDA work out of the box.

### Enhanced Setup (Recommended)

1. **Google Custom Search** (100 free queries/day):
   ```bash
   # 1. Get Google API Key: https://console.cloud.google.com/apis/credentials
   # 2. Create Custom Search Engine: https://programmablesearchengine.google.com/
   # 3. Add to .env:
   GOOGLE_API_KEY=AIzaSy...
   GOOGLE_CSE_ID=017576662512468239146:omuauf_lfve
   ```

2. **Unsplash** (50 free requests/hour):
   ```bash
   # 1. Create account: https://unsplash.com/developers
   # 2. Create new application
   # 3. Add to .env:
   UNSPLASH_ACCESS_KEY=your_access_key
   ```

3. **OpenAI DALL-E** (optional, paid):
   ```bash
   # Already configured if you have OPENAI_API_KEY
   OPENAI_API_KEY=sk-...
   ```

## Usage

### Automatic Image Fetching

Images are automatically fetched when:
1. A new product is created
2. A product is updated without an image
3. Batch image refresh is triggered

### Manual Trigger via GraphQL

```graphql
mutation {
  refreshProductImage(productId: "uuid-here") {
    id
    imageUrl
    source
    confidence
  }
}
```

### Batch Processing

Process all products without images:

```bash
# Via npm script
npm run ai:fetch-images

# Or via GraphQL
mutation {
  batchFetchProductImages(limit: 100) {
    queued
    total
  }
}
```

### Admin Dashboard

Access the image management dashboard:
```
http://localhost:4000/admin/product-images
```

Features:
- View image sources and confidence scores
- Manually refresh low-confidence images
- Approve/reject AI-generated images
- Upload custom images

## Image Confidence Scores

Each image is assigned a confidence score (0-100):

| Score | Source | Meaning |
|-------|--------|---------|
| 95 | RxImage | Official medical database |
| 90 | OpenFDA | FDA-approved drug data |
| 70 | Google | Web search result |
| 60 | Unsplash | Generic stock photo |
| 50 | AI Generated | DALL-E generated image |

**Recommendation**: Manually review images with confidence < 70.

## Cost Estimation

### Free Tier (Recommended for Most Users)
- **RxImage**: Unlimited, FREE
- **OpenFDA**: 120,000 requests/day, FREE
- **Google**: 100 queries/day, FREE
- **Unsplash**: 50 requests/hour (1,200/day), FREE

**Total**: ~1,300 free image searches per day

### Paid Tier (For Large Catalogs)
- **Google**: $5 per 1,000 queries after free tier
- **OpenAI DALL-E**: $0.04 per generated image

**Example Cost** (1,000 product catalog):
- Free APIs cover ~95% of products: $0
- Google for remaining 50 products: $0.25
- DALL-E for 10 obscure products: $0.40
- **Total**: ~$0.65 for entire catalog

## Best Practices

### 1. Use Free APIs First
The free APIs (RxImage, OpenFDA) cover most pharmaceutical products. Only enable paid APIs if needed.

### 2. Batch Processing During Off-Hours
Run batch image fetching at night to avoid rate limits:

```typescript
// Cron job: Every day at 2 AM
@Cron('0 2 * * *')
async batchFetchImages() {
  await this.imagePipeline.add('batch-fetch-images', { limit: 500 });
}
```

### 3. Cache Images Locally
All images are downloaded and uploaded to your S3 bucket, so you only pay API costs once per product.

### 4. Review AI-Generated Images
AI-generated images should be reviewed before customer-facing use:

```sql
-- Find AI-generated images for review
SELECT p.name, pi.cdn_url, pi.metadata
FROM products p
JOIN product_images pi ON pi.product_id = p.id
WHERE pi.source = 'AI_GENERATED' AND pi.is_approved = false;
```

### 5. Refresh Low-Confidence Images Weekly
Set up a weekly job to retry low-confidence images:

```typescript
// Cron job: Every Sunday at 3 AM
@Cron('0 3 * * 0')
async refreshLowConfidenceImages() {
  await this.imagePipeline.add('refresh-low-confidence-images', {});
}
```

## Troubleshooting

### No Images Found
**Problem**: API returns no results for a product.

**Solutions**:
1. Check product name spelling
2. Try generic name instead of brand name
3. Simplify name (remove dosage, form)
4. Enable Google Custom Search
5. Manually upload image

### Rate Limit Exceeded
**Problem**: "429 Too Many Requests" error.

**Solutions**:
1. Reduce batch size
2. Increase delay between requests
3. Upgrade to paid tier (Google)
4. Spread requests across multiple days

### Low Quality Images
**Problem**: Images are blurry or incorrect.

**Solutions**:
1. Manually upload high-quality image
2. Enable Google Custom Search for better results
3. Review and reject low-confidence images
4. Use AI generation as last resort only

## API Documentation

### RxImage API
- **Docs**: https://rximage.nlm.nih.gov/docs/
- **Endpoint**: `https://rximage.nlm.nih.gov/api/rximage/1/rxnav`
- **Example**: `?name=amoxicillin`

### OpenFDA API
- **Docs**: https://open.fda.gov/apis/drug/label/
- **Endpoint**: `https://api.fda.gov/drug/label.json`
- **Example**: `?search=openfda.brand_name:"Coartem"`

### Google Custom Search
- **Docs**: https://developers.google.com/custom-search/v1/overview
- **Setup**: https://programmablesearchengine.google.com/

### Unsplash API
- **Docs**: https://unsplash.com/documentation
- **Setup**: https://unsplash.com/developers

### OpenAI DALL-E
- **Docs**: https://platform.openai.com/docs/guides/images
- **Pricing**: https://openai.com/pricing

## Performance Metrics

### Expected Coverage
- **Pharmaceutical Products**: 85-95% (RxImage + OpenFDA)
- **OTC Products**: 70-80% (Google + Unsplash)
- **Chemical Shop Products**: 60-70% (Google + Unsplash)
- **Overall**: 75-85% automatic coverage

### Processing Speed
- **Single Product**: 2-5 seconds
- **Batch (100 products)**: 5-10 minutes (with rate limiting)
- **Full Catalog (1,000 products)**: 1-2 hours

### Storage Requirements
- **Average Image Size**: 200-500 KB
- **1,000 Products**: ~300 MB
- **S3 Storage Cost**: ~$0.007/month (negligible)

## Future Enhancements

### Planned Features
- [ ] DailyMed API integration
- [ ] Manufacturer website scraping
- [ ] Image quality scoring (blur detection)
- [ ] Automatic image cropping/optimization
- [ ] Multi-language support (Ghana FDA database)
- [ ] Barcode-to-image lookup
- [ ] Community image contributions

### AI Improvements
- [ ] Fine-tuned DALL-E model for pharmaceutical products
- [ ] Image similarity matching
- [ ] Automatic product categorization from images
- [ ] OCR for product label extraction

## Support

For issues or questions:
- **Email**: support@advansis.com
- **Docs**: https://docs.pharmapos.pro/ai-images
- **GitHub**: https://github.com/advansis/pharmapos-api/issues
