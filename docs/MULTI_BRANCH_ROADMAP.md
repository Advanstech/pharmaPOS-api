# Azzay Pharmacy Pro - Multi-Branch Inventory Roadmap

## Executive Summary
This document outlines the implementation plan for enhanced multi-branch inventory management with AI capabilities for Azzay Pharmacy Pro, supporting both pharmaceutical and chemical shop branches.

## Current Architecture

### Branch Types
- **Pharmaceutical Branch**: Full POM dispensing, prescription management, controlled drugs
- **Chemical Shop Branch**: OTC only, hard-blocked from POM via `BranchTypeGuard`

### Existing Features
- ✅ Branch-scoped inventory tracking
- ✅ GRN (Goods Received Note) workflow
- ✅ Stock movements audit trail
- ✅ Real-time stock subscriptions (Redis)
- ✅ Stock count/cycle counting
- ✅ FEFO (First Expiry First Out) tracking
- ✅ Low stock alerts

## Phase 1: Branch Management & Git Strategy

### Git Branch Structure
```
main (production)
├── develop (integration)
├── feature/chemical-branch-enhancements
├── feature/inter-branch-transfers
└── feature/ai-capabilities
```

### Branch Deployment Strategy
- **Main Branch**: Production-ready code for pharmaceutical branches
- **Chemical Branch**: Specialized features for chemical shop operations
- Both branches share core inventory logic but have branch-type-specific features

### Implementation Tasks
1. Create `develop` branch from `main`
2. Create feature branches for each enhancement
3. Set up branch protection rules
4. Configure CI/CD for both branch types

## Phase 2: Inter-Branch Stock Transfers

### Database Schema
```sql
CREATE TABLE inter_branch_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_branch_id UUID NOT NULL REFERENCES branches(id),
  to_branch_id UUID NOT NULL REFERENCES branches(id),
  status VARCHAR(20) NOT NULL, -- pending | in_transit | received | cancelled
  requested_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  received_by UUID REFERENCES users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  notes TEXT,
  CONSTRAINT different_branches CHECK (from_branch_id != to_branch_id)
);

CREATE TABLE inter_branch_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES inter_branch_transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  batch_number VARCHAR(100),
  expiry_date DATE,
  unit_cost_pesewas INT
);
```

### GraphQL API
```graphql
type InterBranchTransfer {
  id: ID!
  fromBranch: Branch!
  toBranch: Branch!
  status: TransferStatus!
  items: [TransferItem!]!
  requestedBy: User!
  approvedBy: User
  receivedBy: User
  requestedAt: DateTime!
  approvedAt: DateTime
  receivedAt: DateTime
  notes: String
}

input CreateTransferInput {
  toBranchId: ID!
  items: [TransferItemInput!]!
  notes: String
}

type Mutation {
  createInterBranchTransfer(input: CreateTransferInput!): InterBranchTransfer!
  approveTransfer(transferId: ID!): InterBranchTransfer!
  receiveTransfer(transferId: ID!, items: [ReceivedItemInput!]!): InterBranchTransfer!
  cancelTransfer(transferId: ID!, reason: String!): InterBranchTransfer!
}
```

### RBAC
- **Request Transfer**: manager, head_pharmacist
- **Approve Transfer**: owner, se_admin, manager
- **Receive Transfer**: manager, head_pharmacist, technician
- **Cancel Transfer**: owner, se_admin, manager

## Phase 3: AI-Powered Product Image Sourcing

### Image Sources (Priority Order)
1. **Manufacturer Databases** (Highest Quality)
   - FDA Drug Database API (drugs@fda)
   - OpenFDA API: `https://api.fda.gov/drug/label.json`
   - Ghana FDA API (if available)

2. **Medical Image Databases**
   - RxImage API: `https://rximage.nlm.nih.gov/api/rximage/1/rxnav`
   - DailyMed: `https://dailymed.nlm.nih.gov/dailymed/`

3. **Commercial APIs**
   - Google Custom Search API (filtered for pharmaceutical products)
   - Bing Image Search API
   - Unsplash API (current fallback - enhance with better search)

4. **AI Image Generation** (Last Resort)
   - OpenAI DALL-E 3 for generic product visualization
   - Stable Diffusion for pharmaceutical packaging

### Implementation Strategy

#### Service: `ProductImageService`
```typescript
class ProductImageService {
  async findProductImage(product: Product): Promise<string | null> {
    // 1. Check RxImage API (free, high quality)
    const rxImageUrl = await this.searchRxImage(product.genericName);
    if (rxImageUrl) return rxImageUrl;

    // 2. Check OpenFDA
    const fdaImageUrl = await this.searchOpenFDA(product.name);
    if (fdaImageUrl) return fdaImageUrl;

    // 3. Google Custom Search (requires API key)
    const googleImageUrl = await this.searchGoogleImages(product.name);
    if (googleImageUrl) return googleImageUrl;

    // 4. Generate with AI (OpenAI)
    return await this.generateProductImage(product);
  }

  private async searchRxImage(genericName: string): Promise<string | null> {
    // RxImage API - free, no auth required
    const response = await axios.get(
      `https://rximage.nlm.nih.gov/api/rximage/1/rxnav?name=${encodeURIComponent(genericName)}`
    );
    return response.data?.nlmRxImages?.[0]?.imageUrl || null;
  }

  private async searchOpenFDA(productName: string): Promise<string | null> {
    // OpenFDA API - free, no auth required
    const response = await axios.get(
      `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${productName}"&limit=1`
    );
    return response.data?.results?.[0]?.openfda?.image_url || null;
  }

  private async generateProductImage(product: Product): Promise<string> {
    // OpenAI DALL-E 3 - requires API key (already in package.json)
    const prompt = `Professional pharmaceutical product photo of ${product.name} (${product.genericName}), 
                    white background, high resolution, product packaging visible, medical grade quality`;
    
    const response = await this.openai.images.generate({
      model: "dall-e-3",
      prompt,
      size: "1024x1024",
      quality: "hd",
    });

    const imageUrl = response.data[0].url;
    // Upload to S3 and return CDN URL
    return await this.s3Upload.uploadFromUrl(imageUrl, `products/${product.id}/ai-generated.jpg`);
  }
}
```

### BullMQ Queue: `image-pipeline`
```typescript
// Triggered on product creation or manual refresh
@Processor('image-pipeline')
export class ImagePipelineProcessor {
  @Process('fetch-product-image')
  async fetchProductImage(job: Job<{ productId: string }>) {
    const product = await this.productsService.findOne(job.data.productId);
    const imageUrl = await this.imageService.findProductImage(product);
    
    if (imageUrl) {
      await this.productsService.updateProductImage(product.id, imageUrl);
    }
  }
}
```

### Free API Resources (No Cost)
- ✅ RxImage API (NLM) - Free, no auth
- ✅ OpenFDA API - Free, no auth
- ✅ DailyMed - Free, no auth
- ⚠️ Google Custom Search - 100 queries/day free
- ⚠️ OpenAI DALL-E - Paid ($0.04/image)

## Phase 4: AI Demand Forecasting

### Implementation
```typescript
@Injectable()
export class DemandForecastService {
  async forecastDemand(productId: string, branchId: string): Promise<ForecastOutput> {
    // 1. Gather historical sales data (last 90 days)
    const salesHistory = await this.getSalesHistory(productId, branchId, 90);
    
    // 2. Analyze seasonality, trends
    const analysis = this.analyzePattern(salesHistory);
    
    // 3. Use OpenAI for intelligent forecasting
    const forecast = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [{
        role: "system",
        content: "You are a pharmaceutical inventory analyst. Analyze sales patterns and forecast demand."
      }, {
        role: "user",
        content: `Product: ${productId}\nSales History: ${JSON.stringify(salesHistory)}\nProvide 30-day demand forecast.`
      }]
    });

    return this.parseForecast(forecast);
  }
}
```

## Phase 5: Performance Optimization

### Caching Strategy
```typescript
// Product search caching (Redis)
@Injectable()
export class ProductsService {
  async search(query: string, branchId: string, branchType: string, limit: number) {
    const cacheKey = `products:search:${branchId}:${branchType}:${query}:${limit}`;
    
    // Check cache first
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;
    
    // Query database
    const results = await this.executeSearch(query, branchId, branchType, limit);
    
    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, results, 300);
    
    return results;
  }
}
```

### Database Indexes
```sql
-- Product search optimization
CREATE INDEX idx_products_name_trgm ON products USING gin(name gin_trgm_ops);
CREATE INDEX idx_products_generic_name_trgm ON products USING gin(generic_name gin_trgm_ops);
CREATE INDEX idx_products_branch_type ON products(branch_type) WHERE is_active = true;

-- Inventory queries
CREATE INDEX idx_inventory_branch_product ON inventory(branch_id, product_id);
CREATE INDEX idx_inventory_low_stock ON inventory(branch_id) WHERE quantity_on_hand <= reorder_level;

-- Stock movements
CREATE INDEX idx_stock_movements_product_branch ON stock_movements(product_id, branch_id, created_at DESC);
```

## Phase 6: Chemical Branch Specific Features

### Product Filtering
- Automatic filtering of POM products in chemical branch POS
- Enhanced OTC product catalog
- Chemical-specific categories (cleaning supplies, cosmetics, etc.)

### Compliance
- Chemical shop cannot see prescription module
- Automatic rejection of POM products at checkout
- Audit trail for attempted POM access

## Implementation Timeline

### Week 1-2: Branch Management
- [ ] Create git branch structure
- [ ] Set up CI/CD for multi-branch deployment
- [ ] Database migration for inter-branch transfers
- [ ] Implement transfer GraphQL API

### Week 3-4: AI Image Sourcing
- [ ] Integrate RxImage API
- [ ] Integrate OpenFDA API
- [ ] Implement Google Custom Search fallback
- [ ] Set up BullMQ image pipeline
- [ ] Create admin UI for image refresh

### Week 5-6: Performance & Optimization
- [ ] Implement Redis caching for product searches
- [ ] Add database indexes
- [ ] Optimize inventory queries
- [ ] Load testing and benchmarking

### Week 7-8: AI Demand Forecasting
- [ ] Implement sales history analysis
- [ ] Integrate OpenAI for forecasting
- [ ] Create forecast dashboard
- [ ] Set up weekly forecast job

## Success Metrics

### Performance
- Product search response time: < 200ms (p95)
- Inventory list load time: < 500ms (p95)
- Real-time stock updates: < 100ms latency

### Business
- Stock-out reduction: 30%
- Inventory turnover improvement: 20%
- Inter-branch transfer efficiency: 50% faster
- Product image coverage: 80%+ of catalog

## Risk Mitigation

### Data Integrity
- Transaction-based transfers (atomic operations)
- Audit trail for all stock movements
- Reconciliation reports

### API Rate Limits
- Implement exponential backoff
- Queue-based image fetching
- Fallback to cached/placeholder images

### Branch Isolation
- Strict RBAC enforcement
- Branch-type guards on all mutations
- Audit logging for cross-branch operations

## Next Steps

1. **Immediate**: Create `develop` and `chemical` git branches
2. **This Week**: Implement inter-branch transfer schema and API
3. **Next Week**: Integrate free image APIs (RxImage, OpenFDA)
4. **Ongoing**: Performance monitoring and optimization
