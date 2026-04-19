# Railway Deployment Checklist

## ✅ Code Pushed

**Commit**: `feat: Phase 1 & 2 - Invoice OCR + Staff Expense Management`
**Status**: Pushed to GitHub `main` branch
**Railway**: Auto-deploying now

---

## 🔧 Railway Configuration Required

### 1. Add Redis Database

**Steps**:
1. Go to Railway Dashboard: https://railway.app/project/[your-project]
2. Click **"+ New"** → **"Database"** → **"Add Redis"**
3. Railway will automatically:
   - Create Redis instance
   - Inject `REDIS_URL` environment variable
   - Connect to your API service

**Cost**: Free tier (500MB RAM) - Perfect for your use case

---

### 2. Verify Environment Variables

**Required Variables** (check in Railway dashboard):

```env
# Database (should already be set)
DATABASE_URL=postgresql://...
DATABASE_DIRECT_URL=postgresql://...

# Redis (auto-injected when you add Redis)
REDIS_URL=redis://...

# OpenAI (REQUIRED - add manually)
OPENAI_API_KEY=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

# Supabase (should already be set)
SUPABASE_URL=https://xjzrtgneqxeayvhghzap.supabase.co
SUPABASE_ANON_KEY=sb_publishable_r_rpdXwMYTlzhO_ALJYvYw_qleGgAJD
SUPABASE_SERVICE_ROLE_KEY=sb_secret_gBdKodtCsF9KpzPPJyw2Tw_zQiJKBFM

# JWT Secrets (should already be set)
JWT_SECRET=Wv1LzHiafXEBYVkSuXG/ai8jDvliC8Vp2SDUyQIKdWc=
JWT_REFRESH_SECRET=fmA1kaVieGZlaAP3FvZlzE34Er0sbQDTXSaklzVo8KM=

# PII Encryption (should already be set)
PII_ENCRYPTION_KEY=5f81357aa53916d0a16844e3fd77064b5f397d99f919278475b02f7de574ec2b

# Storage (choose one)
USE_SUPABASE_STORAGE=true
# OR
AWS_S3_BUCKET=pharmapos-images
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1

# Email (should already be set)
EMAIL_PROVIDER=resend
EMAIL_API_KEY=re_j9Kfgx5b_aXgvkuRYvDUvmEdinucKfmLx
EMAIL_FROM=PharmaPOS <onboarding@resend.dev>

# App Config
NODE_ENV=production
PORT=4000
WEB_URL=https://your-frontend-url.com
```

---

### 3. Run Database Migration

**After deployment completes**:

Railway should auto-run migrations, but if not:

```bash
# In Railway dashboard, go to your service
# Click "Deploy" → "Run Command"
npm run migration:run
```

Or connect via Railway CLI:
```bash
railway run npm run migration:run
```

---

## 🚀 Deployment Status

### Check Deployment

1. **Railway Dashboard**: https://railway.app/project/[your-project]
2. **Deployment Logs**: Click on your service → "Deployments" tab
3. **Build Status**: Should show "Building..." then "Deployed"

### Expected Build Time

- **Build**: ~3-5 minutes
- **Migration**: ~10 seconds
- **Total**: ~5 minutes

---

## ✅ Post-Deployment Verification

### 1. Health Check

```bash
curl https://your-app.railway.app/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

### 2. GraphQL Playground

Visit: `https://your-app.railway.app/graphql`

**Test Query**:
```graphql
query {
  __schema {
    types {
      name
    }
  }
}
```

Should see types including:
- `InvoiceOcrJob`
- `StaffExpenseOutput`
- `EnhancedSupplierInvoice`

### 3. Test Invoice OCR

```graphql
mutation {
  uploadSupplierInvoice(input: {
    invoiceFile: $file
  }) {
    ocrJobId
    status
    message
  }
}
```

### 4. Test Staff Expenses

```graphql
mutation {
  createStaffExpense(input: {
    category: FUEL
    amountPesewas: 15000
    description: "Test expense"
    expenseDate: "2026-04-10"
    paymentMethod: CASH
  }) {
    id
    status
  }
}
```

---

## 🐛 Troubleshooting

### Issue: Build Failed

**Check**:
1. Railway logs for error messages
2. Ensure all dependencies in `package.json`
3. Check TypeScript compilation errors

**Solution**:
```bash
# Locally test build
npm run build
```

### Issue: Migration Failed

**Check**:
1. `DATABASE_DIRECT_URL` is set (not pooler URL)
2. Database is accessible from Railway

**Solution**:
```bash
# Manually run migration
railway run npm run migration:run
```

### Issue: Redis Connection Failed

**Check**:
1. Redis service is running in Railway
2. `REDIS_URL` environment variable is set

**Solution**:
1. Add Redis database in Railway dashboard
2. Restart deployment

### Issue: OpenAI API Errors

**Check**:
1. `OPENAI_API_KEY` is set in Railway
2. API key is valid and has credits

**Solution**:
1. Add/update `OPENAI_API_KEY` in Railway environment variables
2. Redeploy

---

## 📊 What's Deployed

### Phase 1: Invoice OCR
✅ GPT-4 Vision OCR extraction
✅ Smart product matching
✅ Auto product image fetching
✅ Supplier payment tracking
✅ Part payment support
✅ Invoice aging

### Phase 2: Staff Expenses
✅ Expense claim submission
✅ Approval workflow
✅ Reimbursement tracking
✅ Receipt upload
✅ Expense analytics

### Database
✅ 4 new tables created
✅ 2 tables enhanced
✅ Automatic triggers
✅ Payment status automation

---

## 🎯 Success Metrics

After deployment, you should have:

- ✅ Server running on Railway
- ✅ Redis connected
- ✅ Database migrated
- ✅ GraphQL API accessible
- ✅ Invoice OCR functional
- ✅ Staff expenses functional
- ✅ All documentation available

---

## 📱 Share with Frontend Team

Once deployment is verified, share:

1. **API URL**: `https://your-app.railway.app/graphql`
2. **Documentation**:
   - `PHASE1_INVOICE_OCR_DOCS.md`
   - `PHASE2_EXPENSES_DOCS.md`
   - `QUICK_START.md`
3. **GraphQL Playground**: For testing queries

---

## 🔜 Next Steps

After Phase 1 & 2 are tested:

**Phase 3**: Mobile Money Integration (MTN, Vodafone, AirtelTigo)
**Phase 4**: SaaS Onboarding & API Keys

---

**Deployment Time**: ~5 minutes
**Status**: 🚀 DEPLOYING NOW
**Monitor**: Railway Dashboard
