# API Security & Documentation

## Security Headers (Helmet)

Helmet middleware is configured in `src/main.ts` to set secure HTTP headers:

- **Content Security Policy**: Restricts resource loading to prevent XSS attacks
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **Strict-Transport-Security**: Enforces HTTPS connections
- **X-DNS-Prefetch-Control**: Controls DNS prefetching

### CSP Configuration

```typescript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"], // GraphQL Playground needs inline styles
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // GraphQL Playground needs eval
    imgSrc: ["'self'", 'data:', 'https:'],
  },
}
```

**Note**: CSP is relaxed for GraphQL Playground in development. Tighten in production.

## API Documentation (Swagger)

Swagger/OpenAPI documentation is available in development mode only.

### Access

```bash
# Start API
pnpm --filter api dev

# Visit Swagger UI
http://localhost:4000/api-docs
```

### Features

- **Interactive API Explorer**: Test endpoints directly from the browser
- **JWT Authentication**: Bearer token support for protected endpoints
- **Request/Response Schemas**: Full TypeScript type definitions
- **Role-Based Access Control**: Documented role requirements per endpoint

### Tags

- `auth` - Authentication & Authorization
- `suppliers` - Supplier Management
- `products` - Product Catalog & Search
- `sales` - POS Sales & Checkout
- `inventory` - Stock Management
- `pharmacy` - Prescription & GMDC Validation
- `accounting` - General Ledger & Reports
- `notifications` - Email & SMS Notifications
- `health` - Health Check Endpoints

### Adding Swagger to New Endpoints

```typescript
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

@ApiTags('module-name')
@ApiBearerAuth('JWT')
@Controller('endpoint')
export class MyController {
  @Get()
  @ApiOperation({ summary: 'Description of what this endpoint does' })
  @ApiResponse({ status: 200, description: 'Success response' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async myEndpoint() {
    // ...
  }
}
```

## GraphQL Playground

GraphQL Playground is available at:

```
http://localhost:4000/graphql
```

### Authentication

Add JWT token to HTTP headers:

```json
{
  "Authorization": "Bearer <your_jwt_token>"
}
```

### Example Queries

```graphql
# List suppliers
query {
  suppliers {
    id
    name
    company_name
    phone
    email
    ai_reliability_score
  }
}

# Search products
query {
  searchProducts(query: "paracetamol", limit: 10) {
    id
    name
    classification
    unit_price
    stock_quantity
  }
}
```

## Health Check Endpoints

### `/health`
Comprehensive health check with database and memory checks.

**Response:**
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "memory_heap": { "status": "up" },
    "memory_rss": { "status": "up" }
  }
}
```

### `/health/ready`
Readiness probe for Kubernetes/ELB load balancers.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-22T12:00:00.000Z",
  "database": "connected"
}
```

### `/health/live`
Liveness probe with uptime and memory stats.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-22T12:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "heapUsed": 150,
    "heapTotal": 200,
    "rss": 250
  }
}
```

## CORS Configuration

CORS is enabled for the web app:

```typescript
app.enableCors({
  origin: process.env.WEB_URL ?? 'http://localhost:3000',
  credentials: true,
});
```

**Production**: Set `WEB_URL` environment variable to your Vercel domain.

## Rate Limiting

Rate limiting is implemented at the service level:

- **SMS**: Max 5 per customer per day (Redis-backed)
- **API**: Configure rate limiting middleware for production

## Security Best Practices

### Environment Variables

- ✅ Never commit `.env` files
- ✅ Use strong JWT secrets (64+ characters)
- ✅ Rotate API keys regularly
- ✅ Use different secrets for dev/staging/prod

### Database

- ✅ Connection pooling enabled (Supabase)
- ✅ RLS policies on all tables
- ✅ Prepared statements (TypeORM)
- ✅ No raw SQL with user input

### Authentication

- ✅ JWT with refresh tokens
- ✅ Password hashing (bcrypt)
- ✅ Role-based access control
- ✅ Session management (Redis)

### Ghana FDA Compliance

- ✅ POM enforcement at API level
- ✅ Audit log immutability
- ✅ No PHI in logs
- ✅ Encrypted customer data

## Production Checklist

Before deploying to production:

- [ ] Disable Swagger (`NODE_ENV=production`)
- [ ] Tighten CSP directives
- [ ] Enable rate limiting middleware
- [ ] Configure CloudWatch logging
- [ ] Set up error tracking (Sentry)
- [ ] Enable HTTPS only
- [ ] Configure firewall rules
- [ ] Review all environment variables
- [ ] Test health check endpoints
- [ ] Verify CORS configuration

## Monitoring

### CloudWatch Metrics

- API response times
- Error rates
- Database connection pool
- Memory usage
- CPU usage

### Alerts

- High error rate (> 1%)
- Slow response time (> 500ms p95)
- Database connection failures
- Memory threshold exceeded

## Support

For security issues:
- Email: security@pharmapos.com
- Report vulnerabilities responsibly
- Do not disclose publicly until patched

---

**Last Updated**: March 22, 2026  
**Version**: 1.0.0
