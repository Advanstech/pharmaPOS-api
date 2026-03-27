# PharmaPOS Pro — API

NestJS GraphQL API. Runs on port 4000.

## Quick Start

```bash
cp .env.example .env   # fill in your Supabase + Redis credentials
pnpm install
pnpm migration:run
pnpm db:seed
pnpm dev               # http://localhost:4000
```

## Endpoints

| URL | Description |
|-----|-------------|
| http://localhost:4000/graphql | GraphQL Playground |
| http://localhost:4000/api-docs | Swagger UI (REST health + embedded GraphQL reference) |
| http://localhost:4000/health | Full health check |
| http://localhost:4000/health/ready | Readiness (DB `SELECT 1`) |
| http://localhost:4000/health/live | Liveness (process only) |

**Structured reference:** [docs/REST-AND-GRAPHQL-REFERENCE.md](./docs/REST-AND-GRAPHQL-REFERENCE.md) — every REST route with request/response shapes; GraphQL transport, `login` example, and links to `schema.gql`.

## Test Credentials (after `pnpm db:seed`)

| Role | Email | Password |
|------|-------|----------|
| se_admin (ROOT) | root@advansis.io | AdvansisMaster#1 |
| owner | owner@azzaypharmacy.com | PharmaPOS@2025! |
| manager | manager@azzaypharmacy.com | PharmaPOS@2025! |
| head_pharmacist | head.pharmacist@azzaypharmacy.com | PharmaPOS@2025! |
| pharmacist | pharmacist@azzaypharmacy.com | PharmaPOS@2025! |
| technician | technician@azzaypharmacy.com | PharmaPOS@2025! |
| cashier | cashier@azzaypharmacy.com | PharmaPOS@2025! |
| chemical_cashier | chemical.cashier@azzaypharmacy.com | PharmaPOS@2025! |

> `se_admin` has cross-org root access. All other accounts are scoped to **Azzay Pharmacy — Main Branch**.

## Scripts

```bash
pnpm dev                  # watch mode
pnpm build                # compile to dist/
pnpm start                # run dist/main.js (production)
pnpm migration:run        # run pending TypeORM migrations
pnpm migration:revert     # revert last migration
pnpm migration:generate   # generate new migration from entity changes
pnpm db:seed              # seed org, branches, users, products, suppliers, GL
pnpm test                 # unit tests
pnpm test:cov             # unit tests + coverage report
pnpm test:compliance      # Ghana FDA compliance test suite
pnpm lint                 # ESLint
```

## Environment Variables

See `.env.example` for the full list. Critical ones:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase transaction pooler (port 6543) |
| `DATABASE_DIRECT_URL` | Supabase direct connection (port 5432) — migrations only |
| `JWT_SECRET` | Generate: `openssl rand -hex 64` |
| `REDIS_URL` | Upstash Redis URL |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS — never expose to client |

## Module Map

```
src/
├── accounting/     GL double-entry, VAT engine, P&L, expense tracking
├── ai/             Invoice OCR, demand forecasting (BullMQ workers)
├── audit/          Immutable append-only audit log
├── auth/           JWT, RBAC (8 roles), TOTP MFA, PIN login
├── config/         App constants
├── database/       TypeORM config, migrations, seed
├── health/         /health liveness + readiness
├── inventory/      Stock, FEFO, expiry alerts, inter-branch transfers
├── notifications/  Email (Resend/SES) + SMS (Hubtel Ghana)
├── pharmacy/       GMDC validation, Rx lifecycle, drug interactions
├── products/       Product search, CRUD, pricing
├── reports/        12 report types, BullMQ PDF/CSV generation
├── sales/          POS checkout, multi-tender, offline idempotency
├── staff/          User management, role assignment
└── suppliers/      Supplier CRUD, AI scoring, AP management
```

## Ghana FDA Compliance

All POM enforcement is at the API level — no client-side bypass is possible:
- POM products require an approved Rx before sale (`PomEnforcementGuard`)
- Chemical shop branch cannot process any POM (`BranchTypeGuard`)
- GMDC prescriber licence validated on every Rx (cached 24h in Redis)
- Controlled drugs require two pharmacist sign-offs
- Rx validity: 30 days, never extendable
- Drug interactions: contraindicated = hard block, no override for any role

## Notes

- Never run `synchronize: true` in production — use migrations only
- Audit log is PostgreSQL append-only (RULE blocks UPDATE/DELETE)
- All monetary values in GHS — never USD
- Timestamps use `Africa/Accra` timezone (TIMESTAMPTZ)
