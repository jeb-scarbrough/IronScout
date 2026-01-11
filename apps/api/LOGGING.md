# API Logging Guide

Production-grade structured logging for the IronScout API.

## Quick Reference

### Log Format (JSON, production)

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "service": "api",
  "component": "server",
  "message": "Request completed",
  "requestId": "req-abc123",
  "env": "production",
  "version": "1.0.0",
  "event_name": "http.request.end",
  "http": {
    "method": "GET",
    "route": "/api/products/:id",
    "path": "/api/products/123",
    "status_code": 200,
    "latency_ms": 42
  }
}
```

### Log Levels

| Level | When to use |
|-------|-------------|
| `debug` | Detailed debugging information (disabled in production) |
| `info` | Normal operations, request completion, startup |
| `warn` | Client errors (4xx), degraded state, approaching limits |
| `error` | Server errors (5xx), failures, exceptions |
| `fatal` | Unrecoverable errors, shutdown |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Minimum log level (debug, info, warn, error, fatal) |
| `LOG_FORMAT` | `json` (prod) / `pretty` (dev) | Output format |
| `LOG_ASYNC` | `false` | Enable buffered async logging |
| `NODE_ENV` | `development` | Affects format defaults |

---

## Event Names

Use consistent event names for queryable logs:

### HTTP Events
- `http.request.end` - Request completed (one per request)
- `http.request.error` - Request failed with error

### Auth Events
- `auth.login.success` - User logged in
- `auth.login.failure` - Login failed
- `auth.logout` - User logged out
- `auth.signup` - New user registered
- `auth.token.refresh` - Token refreshed

### Business Events
- `search.query` - Search performed
- `search.semantic` - AI semantic search
- `payment.succeeded` - Payment completed
- `alert.triggered` - Alert condition met
- `subscription.created` - Subscription started

### System Events
- `server.start` - Server started
- `server.shutdown` - Server shutting down
- `rate_limit.blocked` - Request rate limited

---

## Querying Logs

### Find Slow Requests

```bash
# Requests over 1 second
cat api.log | jq 'select(.http.latency_ms > 1000)'

# Average latency by route
cat api.log | jq -s 'group_by(.http.route) | map({route: .[0].http.route, avg: (map(.http.latency_ms) | add / length)})'
```

### Find Errors

```bash
# All errors
cat api.log | jq 'select(.level == "error")'

# Errors by category
cat api.log | jq 'select(.error_category == "db")'

# 5xx errors
cat api.log | jq 'select(.http.status_code >= 500)'

# Count errors by code
cat api.log | jq -s 'map(select(.error_code)) | group_by(.error_code) | map({code: .[0].error_code, count: length})'
```

### Trace a Request

```bash
# All logs for a specific request
cat api.log | jq 'select(.requestId == "req-abc123")'
```

### Rate Limiting Analysis

```bash
# Blocked requests
cat api.log | jq 'select(.event_name == "rate_limit.blocked")'

# Top blocked IPs
cat api.log | jq -s 'map(select(.event_name == "rate_limit.blocked")) | group_by(.ip) | map({ip: .[0].ip, count: length}) | sort_by(-.count)'
```

### Auth Failures

```bash
# Login failures
cat api.log | jq 'select(.event_name == "auth.login.failure")'

# Count failures by IP
cat api.log | jq -s 'map(select(.event_name == "auth.login.failure")) | group_by(.ip) | map({ip: .[0].ip, count: length}) | sort_by(-.count)'
```

---

## Error Categories

| Category | Description | Status Code | Retryable |
|----------|-------------|-------------|-----------|
| `validation` | Invalid client input | 400 | No |
| `auth` | Authentication/authorization failure | 401, 403 | No |
| `not_found` | Resource not found | 404 | No |
| `rate_limit` | Rate limit exceeded | 429 | Yes |
| `conflict` | Resource conflict | 409 | No |
| `db` | Database errors | 500, 503 | Yes |
| `external` | External service failure | 503 | Yes |
| `timeout` | Operation timeout | 504 | Yes |
| `internal` | Unexpected internal error | 500 | No |

---

## Redaction

### Fields Always Redacted

- `authorization`, `cookie`, `set-cookie`
- `password`, `secret`, `token`
- `apiKey`, `api_key`, `access_token`, `refresh_token`
- `creditCard`, `cardNumber`, `cvv`, `accountNumber`
- `ssn`, `socialSecurity`, `dob`

### Safe Fields (Allowlist)

- Request metadata: `method`, `path`, `statusCode`, `latencyMs`
- Identifiers: `requestId`, `userId`, `productId`
- Logging metadata: `timestamp`, `level`, `service`, `event_name`
- Error fields: `error`, `errorCode`, `stack`
- Business fields: `caliber`, `brand`, `category`, `tier`

### Testing Redaction

```bash
pnpm test apps/api/src/lib/__tests__/redact.test.ts
```

---

## Troubleshooting

### No Logs Appearing

1. Check `LOG_LEVEL` - might be set too high
   ```bash
   # Show debug logs
   LOG_LEVEL=debug pnpm dev
   ```

2. Check `LOG_FORMAT` - pretty format in dev, json in prod
   ```bash
   # Force JSON output
   LOG_FORMAT=json pnpm dev
   ```

### Missing Request ID

- Ensure `requestContextMiddleware` is early in the middleware chain
- Check `X-Request-ID` header is being propagated

### High Log Volume

1. Increase `LOG_LEVEL` to `warn` or `error`
2. Health checks and static assets are already excluded
3. Consider sampling for high-frequency events

### Log Fields Missing

Standard fields (`env`, `version`) come from child loggers:
```typescript
import { loggers } from '../config/logger'
const log = loggers.server  // Has standard fields
```

---

## Usage Examples

### Basic Logging

```typescript
import { loggers } from '../config/logger'

const log = loggers.search

// Info level
log.info('Search completed', { query: 'ammo', resultCount: 42 })

// With error
log.error('Search failed', { query: 'ammo' }, error)
```

### With Event Names

```typescript
import { loggers, LOG_EVENTS } from '../config/logger'

const log = loggers.auth

log.info('User logged in', {
  event_name: LOG_EVENTS.AUTH_LOGIN_SUCCESS,
  userId: user.id,
})
```

### Creating Custom Child Logger

```typescript
import { createChildLogger } from '../config/logger'

const log = createChildLogger('myFeature', { customContext: 'value' })
```

---

## Architecture

```
Request Flow:
┌─────────────────────┐
│ requestContextMiddleware │  ← Sets requestId
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ requestLoggerMiddleware │  ← Starts timer, logs on finish
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   Route Handlers    │  ← Use loggers.* for domain logs
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ errorLoggerMiddleware │  ← Classifies and logs errors
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ Final Error Handler │  ← Sends response to client
└─────────────────────┘
```

---

## Files

| File | Purpose |
|------|---------|
| `src/config/logger.ts` | Logger instances and event names |
| `src/middleware/request-context.ts` | Request ID correlation |
| `src/middleware/request-logger.ts` | HTTP request logging |
| `src/lib/redact.ts` | Sensitive field redaction |
| `src/lib/errors.ts` | Error classification |
| `packages/logger/` | Core logger implementation |
