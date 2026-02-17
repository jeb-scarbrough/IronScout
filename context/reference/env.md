# Environment Variables

Complete reference for every environment variable used across the IronScout monorepo. Generated from a full codebase scan.

Rules:
- Do not commit secrets.
- Do not reuse credentials across environments.
- If a value is missing or ambiguous, default to restricted behavior (fail closed).

---

## Global / Shared Variables

These variables are consumed by multiple apps or by shared packages (`@ironscout/db`, `@ironscout/redis`, `@ironscout/notifications`, `@ironscout/crypto`, `@ironscout/logger`).

### Infrastructure

| Variable | Default | Apps | Description |
|----------|---------|------|-------------|
| `NODE_ENV` | `'development'` | all | Environment indicator (`development` or `production`). Controls cookie security flags, log format, E2E safety gates, error verbosity, and feature behavior. Set automatically by deployment platform. Change when deploying to a new environment tier. |
| `DATABASE_URL` | none (required) | api, web, admin, merchant, harvester | PostgreSQL connection string used by Prisma. Format: `postgresql://user:pass@host:port/db`. Each environment must use its own database. Never point local dev at staging or production. |
| `DIRECT_URL` | none (optional) | all Prisma apps | Non-pooled Postgres connection for migrations. Only needed when `DATABASE_URL` uses a connection pooler (e.g. PgBouncer). |
| `DB_POOL_MAX` | `20` | all (via `@ironscout/db`) | Maximum PostgreSQL connection pool size. Increase for high-concurrency services (API, harvester). Keep low for admin/merchant. |
| `DB_POOL_MIN` | `2` | all (via `@ironscout/db`) | Minimum idle connections in pool. Reduces cold-start latency. Lower in dev, raise in production. |
| `DB_SERVICE_NAME` | `'ironscout'` | all (via `@ironscout/db`) | Application name reported to PostgreSQL `pg_stat_activity`. Change per-service in production for query attribution (e.g. `ironscout-api`, `ironscout-harvester`). |
| `REDIS_URL` | none (optional) | harvester, admin, merchant | Full Redis connection URL (e.g. `redis://:password@host:port`). When set, takes precedence over `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`. Use in hosted environments (Render, Railway). |
| `REDIS_HOST` | `'localhost'` | harvester, admin, merchant | Redis hostname. Fallback when `REDIS_URL` is not set. Change for remote Redis instances. |
| `REDIS_PORT` | `6379` | harvester, admin, merchant | Redis port. Fallback when `REDIS_URL` is not set. Change only for non-standard Redis configurations. |
| `REDIS_PASSWORD` | none (optional) | harvester, admin, merchant | Redis auth password. Fallback when `REDIS_URL` is not set. Required for password-protected Redis instances. |

### Authentication (Cross-App)

These must be consistent across all apps sharing auth.

| Variable | Default | Apps | Description |
|----------|---------|------|-------------|
| `NEXTAUTH_SECRET` | none (required) | api, web, admin, merchant | JWT signing and verification secret. **Must be identical across all apps.** Used to sign session tokens (web/admin/merchant) and verify them (api). Rotate by deploying the new value to all apps simultaneously. |
| `NEXTAUTH_URL` | none (required) | web, admin, merchant | Canonical URL for NextAuth callbacks. Must match each app's public URL (e.g. `https://app.ironscout.ai` for web, `https://admin.ironscout.ai` for admin). |
| `GOOGLE_CLIENT_ID` | none (required) | api, web, admin | Google OAuth client ID. Primary authentication provider. Create in Google Cloud Console. |
| `GOOGLE_CLIENT_SECRET` | none (required) | web, admin | Google OAuth client secret. Server-side only. Never expose via `NEXT_PUBLIC_*`. |
| `ADMIN_EMAILS` | `''` (empty) | api, web, admin, merchant | Comma-separated admin email addresses. Parsed, trimmed, and lowercased. Controls admin access and impersonation rights. Update when team membership changes. |
| `INTERNAL_API_KEY` | `''` (empty) | api, web | Shared secret for SSR-to-API requests. Web sends via `X-Api-Key` header; API validates and bypasses per-IP rate limits. Must match between web and api. |
| `ADMIN_API_KEY` | none (required for admin) | api, admin | Shared secret for admin proxy routes. Admin sends via `X-Admin-Key` header; API validates with constant-time comparison. Without this, admin proxy routes (embedding stats, backfill) return 503. |

### OAuth Providers (Optional)

Conditionally enabled: if both `*_CLIENT_ID` and `*_CLIENT_SECRET` are set, the provider appears on the sign-in page. If either is missing, the provider is silently excluded.

| Variable | Default | Apps | Description |
|----------|---------|------|-------------|
| `FACEBOOK_CLIENT_ID` | none | web, admin | Facebook OAuth client ID. |
| `FACEBOOK_CLIENT_SECRET` | none | web, admin | Facebook OAuth client secret. |
| `TWITTER_CLIENT_ID` | none | web | Twitter/X OAuth client ID. |
| `TWITTER_CLIENT_SECRET` | none | web | Twitter/X OAuth client secret. |
| `GITHUB_CLIENT_ID` | none | web, admin | GitHub OAuth client ID. |
| `GITHUB_CLIENT_SECRET` | none | web, admin | GitHub OAuth client secret. |

### Email & Notifications

| Variable | Default | Apps | Description |
|----------|---------|------|-------------|
| `RESEND_API_KEY` | none (required for email) | api, admin, merchant, harvester | Resend email service API key. Required for any transactional email (alerts, invitations, approvals). Lazily initialized on first send. If missing, email operations throw. |
| `ALERTS_EMAIL_FROM` | none | api, harvester | "From" address for consumer price/availability alert emails (e.g. `alerts@ironscout.ai`). |
| `NOREPLY_EMAIL_FROM` | none | api | "From" address for account-level transactional emails (e.g. `noreply@ironscout.ai`). |
| `EMAIL_FROM` | `'IronScout <noreply@ironscout.ai>'` | notifications pkg | Default "From" address used by the shared notifications package when no caller-specific address is provided. |
| `MERCHANT_EMAIL_FROM` | none (required for admin/merchant) | admin, merchant | "From" address for merchant-facing transactional emails (approvals, suspensions, invitations). Throws on startup if missing. |
| `OPERATIONS_EMAIL_TO` | none (required for merchant) | merchant | Email address for internal operations notifications (e.g. new merchant registrations). Typically `operations@ironscout.ai`. |
| `ADMIN_NOTIFICATION_EMAIL` | `'operations@ironscout.ai'` | notifications pkg | Email address for admin-facing notifications routed through the shared notifications package. |
| `SLACK_MERCHANT_OPS_WEBHOOK_URL` | none (optional) | all (via notifications pkg) | Slack Incoming Webhook URL for the merchant ops channel. If unset, Slack notifications are silently skipped. |
| `SLACK_DATAFEED_ALERTS_WEBHOOK_URL` | none (optional) | all (via notifications pkg) | Slack Incoming Webhook URL for datafeed alerts. Falls back to `SLACK_MERCHANT_OPS_WEBHOOK_URL` if unset. |

### URL Configuration

| Variable | Default | Apps | Description |
|----------|---------|------|-------------|
| `NEXT_PUBLIC_API_URL` | none (required for web) | web, admin, www, merchant | Public API base URL. Client-accessible (`NEXT_PUBLIC_*`). Points to the API server. Must be reachable from the browser. |
| `API_URL` | `'http://localhost:8000'` | admin | Server-side internal API URL for admin proxy routes. Takes precedence over `NEXT_PUBLIC_API_URL` on the server. Change for staging/production API endpoints. |
| `INTERNAL_API_URL` | falls back to `NEXT_PUBLIC_API_URL` then `'http://localhost:8000'` | merchant | Server-side internal API URL for merchant SSR. Preferred over public URL on the server for network locality. |
| `FRONTEND_URL` | `'http://localhost:3000'` | api, harvester | Consumer web app URL used in email templates ("Manage alerts" links) and CORS configuration. |
| `NEXT_PUBLIC_APP_URL` | `'https://app.ironscout.ai'` | api, web, www, harvester | Consumer web app canonical URL. Used in outbound URL signing, brand constants, and startup logging. |
| `NEXT_PUBLIC_WWW_URL` | `'https://www.ironscout.ai'` | web, www, harvester | Marketing website URL. Used for footer links, brand references, and startup logging. |
| `NEXT_PUBLIC_ADMIN_URL` | `'https://admin.ironscout.ai'` | admin | Admin portal canonical URL. Used in logout redirects. |
| `NEXT_PUBLIC_MERCHANT_URL` | `'https://merchant.ironscout.ai'` | admin, merchant, notifications pkg | Merchant portal URL. Used in cross-app links and email templates. |
| `MERCHANT_PORTAL_URL` | `'https://merchant.ironscout.ai'` | admin, merchant | Merchant portal base URL. Used in admin approval emails and merchant auth fallback. Trailing slashes are stripped. |
| `ADMIN_PORTAL_URL` | `'https://admin.ironscout.ai'` | merchant, notifications pkg | Admin portal URL used in merchant registration notification emails. |
| `ADMIN_URL` | none (optional) | api | Admin portal URL added to CORS allowlist. Only needed for staging/preview where the URL differs from production. |
| `MERCHANT_URL` | none (optional) | api | Merchant portal URL added to CORS allowlist. Only needed for staging/preview. |
| `CORS_ORIGINS` | `[]` (empty) | api | Comma-separated additional CORS origins. Production `*.ironscout.ai` domains are hardcoded. Use for staging/preview origins. |
| `COOKIE_DOMAIN` | `'.ironscout.ai'` in prod, `undefined` in dev | web, admin | Cookie domain for cross-subdomain session sharing. Enables SSO between app/admin/merchant subdomains. Set to `.local.ironscout.ai` for local dev with Caddy. |

### Security & Cryptography

| Variable | Default | Apps | Description |
|----------|---------|------|-------------|
| `CREDENTIAL_ENCRYPTION_KEY_B64` | none (required) | admin, harvester (via `@ironscout/crypto`) | Base64-encoded 32-byte AES-256-GCM key for encrypting affiliate feed credentials at rest. **Must be identical between admin and harvester.** Must decode to exactly 32 bytes. Rotate with care: re-encrypt all stored credentials first. |
| `OUTBOUND_LINK_SECRET` | none (required for web/api) | api, web | HMAC secret for signing `/out` redirect URLs for affiliate click tracking. Must match between api (generates) and web (verifies). If missing, outbound URLs are unsigned (warns once per runtime). |
| `OUTBOUND_LINK_SECRET_PREVIOUS` | none (optional) | web | Previous HMAC secret for zero-downtime key rotation. Web verifies against both current and previous secrets. Remove after all signed URLs with the old secret have expired. |

---

## App-Specific Variables

### apps/api

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8000` | HTTP server listen port. Change for local multi-service setups or container deployments. |
| `npm_package_version` | `'1.0.0'` | Auto-populated from package.json. Included in all log entries. Do not set manually. |
| `OPENAI_API_KEY` | none (optional) | OpenAI API key for embeddings and intent parsing. If missing, AI search features degrade safely (return empty results). |
| `INTENT_EXTRACTOR_MODEL` | `'gpt-4o-mini'` | OpenAI model for search intent extraction. Change to test newer models. Pinned for determinism. |
| `ENABLE_LENS_V1` | `true` | Master switch for Lens V1 semantic search. Set `false` to disable lens filtering. Features degrade safely. |
| `CURRENT_PRICE_LOOKBACK_DAYS` | `7` | Days to look back for "current" price data in market context and telemetry. Increase for sparse data; decrease for freshness. |
| `STRIPE_SECRET_KEY` | none (optional) | Stripe secret API key. Required for billing operations. Payment routes handle missing key gracefully. |
| `STRIPE_WEBHOOK_SECRET` | none (optional) | Stripe webhook signing secret. Required to verify webhook authenticity. Skips validation if missing. |
| `STRIPE_PRICE_ID_PREMIUM_MONTHLY` | `'price_premium_monthly'` | Stripe price ID for monthly premium subscription. Update when Stripe products change. |
| `STRIPE_PRICE_ID_PREMIUM_ANNUALLY` | `'price_premium_annual'` | Stripe price ID for annual premium subscription. |
| `STRIPE_PRICE_ID_MERCHANT_STANDARD_MONTHLY` | `'price_merchant_standard'` | Stripe price ID for merchant standard plan. |
| `STRIPE_PRICE_ID_MERCHANT_PRO_MONTHLY` | `'price_merchant_pro'` | Stripe price ID for merchant pro plan. |
| `DEBUG_API_KEY` | none (optional) | API key for debug endpoints (e.g. `/debug/webhook-stats`). Only works in development or when header matches. |
| `TURNSTILE_SECRET_KEY` | none (required for contact form) | Cloudflare Turnstile secret key used to verify `www` contact form submissions server-side. If missing, contact form submissions fail closed. |

### apps/web

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_E2E_TEST_MODE` | `'false'` | Enable E2E testing mode. Bypasses certain frontend validations. Never enable in production. |

### apps/admin

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_DEBUG` | `'false'` | Gate for the admin debug endpoint. Set `'true'` to enable. |
| `AFFILIATE_FEED_ALLOW_PLAIN_FTP` | `'false'` | Local dev override to allow plain FTP (non-SFTP) transport for affiliate feeds. Never enable in production. |
| `MISSING_BRAND_THRESHOLD_PERCENT` | `10` | Percentage threshold for missing-brand alerts in affiliate feed detail view. Alerts highlight when rate exceeds this. |
| `STRIPE_SECRET_KEY` | none (optional) | Stripe secret key for merchant payment lookups in admin. Null if not configured. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | none (optional) | Stripe publishable key (if checkout is embedded). |

### apps/merchant

| Variable | Default | Description |
|----------|---------|-------------|
| `STRIPE_PRICE_ID_MERCHANT_PRO_MONTHLY` | none | Stripe price ID for Pro plan checkout. |
| `STRIPE_PRICE_ID_MERCHANT_STANDARD_MONTHLY` | none | Stripe price ID for Standard plan checkout. |

### apps/harvester

| Variable | Default | Description |
|----------|---------|-------------|
| `AFFILIATE_BATCH_SIZE` | `1000` | Database batch size for affiliate price inserts (500-5000 per spec). Increase for throughput; decrease for memory. |
| `PRICE_HEARTBEAT_HOURS` | `24` | Hours between price heartbeat writes. Confirms "still at this price" without actual change. Lower values create more proof entries but increase DB writes. |
| `AFFILIATE_RUN_RETENTION_DAYS` | `30` | Days to retain completed affiliate feed runs before cleanup deletes them. Increase for longer audit trails; decrease to save storage. |
| `MISSING_BRAND_THRESHOLD_PERCENT` | `10` | Percentage threshold for missing-brand data quality alerts. Alerts fire when rate crosses this threshold on runs with >= 50 products. |
| `CURRENT_PRICE_RECOMPUTE_CRON` | `'*/5 * * * *'` | Cron pattern for current price recomputation scheduling. Default: every 5 minutes. Change for faster/slower refresh. |
| `CURRENT_PRICE_LOOKBACK_DAYS` | `7` | Days to look back when recomputing current prices. Must match API's value for consistency. |
| `CALIBER_SNAPSHOT_CRON` | `'0 */6 * * *'` | Cron pattern for caliber snapshot scheduling. Default: every 6 hours. |
| `BRAND_ALIAS_CACHE_REFRESH_MS` | `60000` | Brand alias cache refresh interval in milliseconds. Lower for faster alias propagation; higher to reduce DB load. |
| `BRAND_ALIAS_HIGH_IMPACT_THRESHOLD` | `1000` | Alert threshold for high-impact brand alias updates (daily application count within 24h of activation). |
| `RESOLVER_BRAND_ALIASES_ENABLED` | `'false'` | Feature flag for applying brand aliases during resolution. Must be exact string `'true'` to enable. Default off per spec. |
| `MAX_SCRAPE_QUEUE_SIZE` | `10000` | Maximum scrape queue size before pausing the scheduler. Prevents queue runaway. |
| `MAX_PENDING_PER_ADAPTER` | `1000` | Maximum pending jobs per scraper adapter before pausing. Prevents adapter monopolization. |
| `OPENAI_API_KEY` | none (optional) | OpenAI API key for embedding worker. If missing, embedding worker is disabled. |
| `BULLBOARD_PORT` | `3939` | Bull Board queue monitor HTTP port. |
| `BULLBOARD_USERNAME` | none (required) | Bull Board basic auth username. **Bull Board must never be exposed to public internet.** |
| `BULLBOARD_PASSWORD` | none (required) | Bull Board basic auth password. |
| `BULLBOARD_BASE_PATH` | `'/admin/queues'` | Bull Board URL base path. |
| `AFFILIATE_FEED_ALLOW_PLAIN_FTP` | `'false'` | Allow insecure FTP transport for affiliate feeds. Local dev only. |

### apps/www (Marketing Site)

| Variable | Default | Description |
|----------|---------|-------------|
| `MARKET_SNAPSHOT_CANARY_BASE_URL` | `'https://www.ironscout.ai'` | Base URL for production canary verification of market snapshots. |
| `MARKET_SNAPSHOT_CANARY_ALLOW_TIMESTAMP_DRIFT` | `'true'` | Allow timestamp-only mismatches in canary verification. Set `'false'` for strict parity checks. |
| `ALLOW_MISSING_PROD_ARTIFACTS` | `''` (false) | Allow missing production market snapshot artifacts in canary. Set `'true'` or `'1'` to treat 404s as blocked rather than errors. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | none (required for contact form) | Public Cloudflare Turnstile site key for the `www` contact form widget. If missing, the form is disabled in the UI. |

### Logging (Cross-App via `@ironscout/logger`)

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `'info'` | Global minimum log level (`debug`, `info`, `warn`, `error`, `fatal`). Highest priority — overrides all other log level settings. Change during incident investigation. |
| `LOG_ASYNC` | `'false'` | Enable buffered async logging (`'true'` or `'1'`). Logs are queued and flushed on shutdown. Only use with graceful shutdown (no `kill -9`). |
| `LOG_REDACT` | auto (true in prod) | Enable automatic PII/secrets redaction in logs. Defaults to true in production. Set `'false'` only in local dev for debugging. |
| `LOG_FORMAT` | `'json'` in prod, `'pretty'` in dev | Log output format. `json` for machine parsing (production); `pretty` for human readability (development). |
| `DATAFEED_FILE_LOG_LEVEL` | `'info'` | Log level for per-run file-based logging of affiliate datafeed runs. Harvester only. |

---

## E2E Testing Variables

These bypass security controls and **must never be enabled in production**. All E2E variables include a fatal production guard that throws on startup if `NODE_ENV === 'production'`.

| Variable | Default | Apps | Description |
|----------|---------|------|-------------|
| `E2E_AUTH_BYPASS` | `'false'` | admin, merchant | Completely bypasses authentication. Returns a synthetic session. **Fatal in production.** |
| `E2E_TEST_MODE` | `'false'` | admin, merchant | Enables mock data injection (merchants, feeds). **Fatal in production.** |
| `NEXT_PUBLIC_E2E_TEST_MODE` | `'false'` | web | Client-side E2E mode flag. Bypasses certain frontend validations. |
| `E2E_ADMIN_USER_ID` | `'e2e-admin'` | admin | Synthetic admin user ID for E2E bypass. |
| `E2E_ADMIN_EMAIL` | first `ADMIN_EMAILS` entry or `'e2e-admin@ironscout.local'` | admin | Synthetic admin email for E2E bypass. |
| `E2E_MERCHANT_ID` | `'e2e-merchant'` | merchant | Synthetic merchant ID for E2E bypass. |
| `E2E_MERCHANT_USER_ID` | `'e2e-merchant-user'` | merchant | Synthetic merchant user ID for E2E bypass. |
| `E2E_MERCHANT_EMAIL` | `'e2e-merchant@ironscout.local'` | merchant | Synthetic merchant email for E2E bypass. |
| `E2E_MERCHANT_BUSINESS` | `'E2E Ammo'` | merchant | Synthetic merchant business name for E2E bypass. |

---

## Test-Only Variables

These are only used in test files and never in production code.

| Variable | Default | Description |
|----------|---------|-------------|
| `TEST_DATABASE_URL` | none | Separate Postgres URL for integration tests. Tests skip if not set. |
| `RUN_EXHAUSTIVE_SEARCH_MATRIX` | `'0'` | Enable expensive exhaustive search test suites. Set `'1'` to run. |
| `RUN_TIER` | none | Select specific merchant tier for scale tests (e.g. `BRONZE`, `SILVER`, `GOLD`). |
| `RUN_STRESS_TESTS` | `'false'` | Enable stress tests. Must be exact string `'true'`. |
| `RUN_MEMORY_TESTS` | `'false'` | Enable memory/bottleneck tests. Must be exact string `'true'`. |
| `RUN_BOTTLENECK` | `'0'` | Enable bottleneck pipeline tests. Must be `'1'`. |

---

## Monitoring (Developer Workstation)

These are set on developer machines for the `/check-logs` Claude Code skill. They are **not** deployed service variables.

| Variable | Default | Description |
|----------|---------|-------------|
| `GRAFANA_SA_TOKEN` | none (required for /check-logs) | Grafana service account token with Viewer role (read-only). Prefix: `glsa_`. Rotate quarterly or on team departure. |
| `GRAFANA_URL` | `'http://10.10.9.28:3001'` | Self-hosted Grafana instance URL. |
| `LOKI_DATASOURCE_UID` | `'loki'` | Loki datasource UID string. Resolved at runtime; override only if it differs. |

Grafana host variables (set on the Grafana server, not developer machines):
- `SLACK_DATAFEED_ALERTS_WEBHOOK_URL` — Required. Same Slack webhook used by the app. Used for alert contact point interpolation.
- `LOKI_DATASOURCE_UID` — Required. Must match the Loki datasource UID in Grafana.
- `GRAFANA_URL` — Required. Externally-reachable Grafana URL for dashboard links in Slack alerts.

---

## Cross-App Consistency Requirements

These variables **must match** across the listed apps or things break silently:

| Variable | Must Match Between | Failure Mode |
|----------|-------------------|--------------|
| `NEXTAUTH_SECRET` | api, web, admin, merchant | JWT verification fails; users can't authenticate |
| `INTERNAL_API_KEY` | api, web | SSR requests rejected or rate-limited |
| `ADMIN_API_KEY` | api, admin | Admin proxy routes return 503 |
| `CREDENTIAL_ENCRYPTION_KEY_B64` | admin, harvester | Credential decrypt fails; feed downloads fail |
| `OUTBOUND_LINK_SECRET` | api, web | Outbound redirect URLs fail HMAC verification |
| `CURRENT_PRICE_LOOKBACK_DAYS` | api, harvester | Stale or missing prices in search results |

---

## Minimum Local Dev Set

```env
# Infrastructure
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379

# Auth (same value in all .env.local files)
NEXTAUTH_SECRET=your-dev-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
ADMIN_EMAILS=you@example.com

# URLs (Caddy local DNS)
NEXT_PUBLIC_API_URL=https://api.local.ironscout.ai
NEXTAUTH_URL=https://app.local.ironscout.ai  # or admin/merchant URL
COOKIE_DOMAIN=.local.ironscout.ai

# Optional (for full feature coverage)
OPENAI_API_KEY=sk-...
RESEND_API_KEY=re_...
CREDENTIAL_ENCRYPTION_KEY_B64=...
```

---

## Validation Checklist

Before running in any environment:
- [ ] Database points to the correct environment
- [ ] Redis points to the correct environment
- [ ] `NEXTAUTH_SECRET` is identical across all four apps and the API
- [ ] `CREDENTIAL_ENCRYPTION_KEY_B64` matches between admin and harvester
- [ ] Harvester scheduler is enabled in only one instance (database setting, not env var)
- [ ] Stripe keys match the correct environment (test vs live)
- [ ] No secrets are exposed to the client via `NEXT_PUBLIC_*`
- [ ] E2E bypass variables are not set in production
- [ ] `COOKIE_DOMAIN` is correct for the deployment domain
