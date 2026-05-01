# Railway Deployment Guide — apps/api

**Production API (current):** `https://happy-happiness-production-fd76.up.railway.app` — GraphQL at `/graphql`, health at `/health`.

## 1. Railway Project Setup

1. Create a new Railway project
2. Add a service → **Deploy from GitHub repo**
3. In service settings → **Root Directory** → set to `apps/api`
4. Railway will auto-detect `nixpacks.toml` and use it

## 2. Environment Variables (set in Railway dashboard)

Copy these into Railway → Service → Variables:

```
NODE_ENV=production
PORT=4000

# Your deployed frontend URL (comma-separated if multiple)
WEB_URL=https://your-web-app.vercel.app

# Supabase
SUPABASE_URL=https://xjzrtgneqxeayvhghzap.supabase.co
SUPABASE_ANON_KEY=<from Supabase dashboard>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard>

# Database — use Transaction Pooler (port 6543) for runtime
DATABASE_URL=postgresql://postgres.xjzrtgneqxeayvhghzap:<password>@aws-1-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true

# JWT — generate fresh secrets for production
# openssl rand -hex 64
JWT_SECRET=<generate>
JWT_REFRESH_SECRET=<generate>

# PII Encryption — AES-256-GCM, 64 hex chars
# python3 -c "import secrets; print(secrets.token_hex(32))"
PII_ENCRYPTION_KEY=<generate>

# Storage
USE_SUPABASE_STORAGE=true

# OpenAI
OPENAI_API_KEY=<your key>

# Email
EMAIL_PROVIDER=resend
EMAIL_API_KEY=<your resend key>
EMAIL_FROM=Azzay Pharmacy <noreply@yourdomain.com>

# Optional — leave blank to disable
HUBTEL_CLIENT_ID=
HUBTEL_CLIENT_SECRET=
MOMO_API_KEY=
MOMO_SUBSCRIPTION_KEY=
MOMO_ENVIRONMENT=production
GMDC_API_URL=https://api.gmdc.gov.gh
GMDC_API_KEY=
DRUG_INTERACTION_PROVIDER=off
WHATSAPP_WEBHOOK_URL=
WHATSAPP_FALLBACK_TO_SMS=true
```

## 3. Run Migrations (one-time, after first deploy)

Railway doesn't auto-run migrations. After the service is live:

```bash
# Option A: Railway CLI
railway run --service api pnpm migration:run

# Option B: Add a one-off job in Railway
# Command: pnpm migration:run
# Run once, then delete
```

> Use `DATABASE_DIRECT_URL` (port 5432) for migrations, not the pooler.
> Add it temporarily as an env var if needed.

## 4. Health Check

Railway will ping `GET /health` — it must return 200 before traffic is routed.

## 5. Custom Domain (optional)

Railway → Service → Settings → Networking → Add custom domain
Point your DNS CNAME to the Railway-provided domain.

## 6. Verify Deploy

```bash
curl https://happy-happiness-production-fd76.up.railway.app/health
# → { "status": "ok", ... }

curl -X POST https://happy-happiness-production-fd76.up.railway.app/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'
# → { "data": { "__typename": "Query" } }
```
