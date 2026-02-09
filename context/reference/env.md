# Environment Variables

This document lists environment variables required to run IronScout. It is written for coding agents and operators.

Rules:
- Do not commit secrets.
- Do not reuse credentials across environments.
- If a value is missing or ambiguous, default to restricted behavior (fail closed).

> Legacy note: `DEALER_*` environment variables are legacy naming and will migrate to `MERCHANT_*`. They refer to Merchant portal accounts, not Retailers.

## Terminology (Canonical)

- **Merchant**: B2B portal account (subscription, billing, auth boundary). Merchant has users. Merchant submits merchant-scoped datasets.
- **Retailer**: Consumer-facing storefront shown in search results. Consumer `prices` are keyed by `retailerId`. Retailers do not authenticate.
- **Source/Feed**: Technical origin of a consumer price record (affiliate, scraper, direct feed). Source is not Merchant.
- **Admin rights**: Merchant users are explicitly granted permissions per Retailer.
- **Legacy**: Any “dealer” wording or `DEALER_*` keys are legacy and must be migrated to “merchant” terminology.

---

## Global Conventions

- `NODE_ENV`: `development | production`
- Prefer explicit app-specific env vars over shared ambiguous ones.
- Separate databases and Redis per environment.

---

## Postgres

Required for:
- API
- Harvester
- All Next.js apps that read directly (if applicable)

Variables:
- `DATABASE_URL`
  - Postgres connection string used by Prisma

Optional but common:
- `DIRECT_URL`
  - Direct (non-pooled) connection string for migrations

---

## Redis (BullMQ)

Required for:
- Harvester
- Any service enqueuing jobs

Variables:
- `REDIS_URL`
  - Redis connection string

If you use separate roles:
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`

---

## apps/api

Required:
- `PORT` (default 8000)
- `DATABASE_URL`
- `REDIS_URL` (if API enqueues jobs or reads queue state)
- `NEXTAUTH_SECRET` - **Required for auth**. Must match `NEXTAUTH_SECRET` used by web/dealer [legacy path]/admin apps.

Auth:
- API signs and verifies JWTs using `NEXTAUTH_SECRET`
- All apps sharing auth must use the same `NEXTAUTH_SECRET` value

Optional:
- `ADMIN_EMAILS` - Comma-separated list of admin email addresses
- `INTERNAL_API_KEY` - For internal service-to-service calls

AI/Search:
- `OPENAI_API_KEY` (or equivalent provider key)
- Optional:
  - `EMBEDDING_MODEL`
  - `CHAT_MODEL`
  - `ENABLE_LENS_V1=true|false` - Enable lens-based search filtering (default: false)
    - When enabled, search results can be filtered and ordered by deterministic lens policies
    - Lenses: ALL, RANGE, DEFENSIVE, MATCH
    - See `context/specs/search-lens-v1.md` for full specification
  - `INTENT_EXTRACTOR_MODEL` - Model ID for intent extraction (default: gpt-4o-mini)

Stripe:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Email:
- `RESEND_API_KEY` - Resend API key for email delivery
- `ALERTS_EMAIL_FROM` - Sender for consumer price/availability alert emails (alerts@ironscout.ai)
- `NOREPLY_EMAIL_FROM` - Sender for transactional account emails (noreply@ironscout.ai)

Required behavior:
- If tiering is reintroduced, API must not resolve tier from client-provided headers. It must use verified auth (ADR-002).

---

## apps/web (Consumer)

Required:
- `NEXT_PUBLIC_API_URL` (points to apps/api)
- `NEXTAUTH_URL` (canonical URL for NextAuth callbacks)
- `NEXTAUTH_SECRET` - Must match API's `NEXTAUTH_SECRET` for shared auth

Stripe (client):
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (if checkout is embedded)
- Server-side webhooks should live in API or a server route with `STRIPE_WEBHOOK_SECRET`.

---

## apps/dealer (Merchant portal, legacy path)

Required:
- `NEXT_PUBLIC_API_URL` or Merchant-specific API URL (if separate)
- `NEXTAUTH_SECRET` - Must match API's `NEXTAUTH_SECRET` for shared auth

Optional:
- Merchant onboarding keys if Retailer feeds are pulled from private endpoints

---

## apps/merchant (Merchant portal)

Required:
- `NEXT_PUBLIC_API_URL`
- `NEXTAUTH_SECRET` - Must match API's `NEXTAUTH_SECRET` for shared auth
- `NEXTAUTH_URL`
- `MERCHANT_EMAIL_FROM` - Sender for merchant transactional emails
- `OPERATIONS_EMAIL_TO` - Recipient for internal merchant notifications

Optional:
- `INTERNAL_API_URL` (if server-to-server calls differ)
- `ADMIN_EMAILS` (if admin session support is enabled)
- `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` (only for feed refresh endpoints)

---

## apps/admin

Required:
- `NEXTAUTH_SECRET` - Must match API's `NEXTAUTH_SECRET` for shared auth
- `NEXT_PUBLIC_ADMIN_API_URL` (if admin calls API directly)
- `ADMIN_EMAILS` - Comma-separated list of admin email addresses
 - `MERCHANT_EMAIL_FROM` - Sender for merchant-facing admin emails

Important:
- Admin impersonation must not bypass eligibility enforcement (or tier enforcement if reintroduced).

---

## apps/harvester

Required:
- `DATABASE_URL`
- `REDIS_URL`

Networking:
- `HTTP_TIMEOUT_MS` (optional)
- `USER_AGENT` (optional)

Scheduling:
- `HARVESTER_SCHEDULER_ENABLED` - **Controlled via admin settings only**
  - This setting is managed through the Admin UI (Settings > Danger Zone)
  - Database is the single source of truth (env var is ignored)
  - Use Emergency Stop in admin to disable scheduler and clear queues
  - Per ADR-001: Only one instance should run the scheduler

Logging:
- `LOG_ASYNC=true|1` - Enable async buffered logging with flush on shutdown (default: false)
  - Use only when graceful shutdown is enforced (no `kill -9`).

Email:
- `ALERTS_EMAIL_FROM` - Sender for consumer alert emails

Safety:
- `MAX_WRITE_BATCH_SIZE` (optional)
- `MAX_SOURCE_CONCURRENCY` (optional)

Data Quality:
- `MISSING_BRAND_THRESHOLD_PERCENT` - Percentage threshold for missing-brand data quality alerts (default: 10)
  - Alerts fire when missing-brand rate exceeds this value on a feed run with >= 50 products
  - Uses crossing-threshold logic: only alerts when rate crosses from below threshold to above

Affiliate Feeds:
- `AFFILIATE_FEED_SCHEDULER_ENABLED=true|false` - Enable affiliate feed scheduling
- `AFFILIATE_FEED_ALLOW_PLAIN_FTP=true|false` - Allow insecure FTP (default: false)
- `CREDENTIAL_ENCRYPTION_KEY_B64` - Base64-encoded 32-byte key for credential encryption
- `PRICE_HEARTBEAT_HOURS` - Hours before writing heartbeat price even if unchanged (default: 24)
- `AFFILIATE_RUN_RETENTION_DAYS` - Days to retain completed runs before cleanup (default: 30)

Bull Board (Queue Monitor):
- `BULLBOARD_PORT` - Server port (default: 3939)
- `BULLBOARD_USERNAME` - **Required** for auth. Basic auth username.
- `BULLBOARD_PASSWORD` - **Required** for auth. Basic auth password.
- `BULLBOARD_BASE_PATH` - URL path (default: /admin/queues)

**Security:** Bull Board must never be exposed to public internet. Use SSH tunnel or VPN.

---

## Minimum Local Dev Set (Suggested)

- `DATABASE_URL`
- `REDIS_URL`
- `OPENAI_API_KEY` (if AI search is enabled locally)
- `NEXTAUTH_SECRET` - Same value across all apps (api, web, dealer [legacy path], admin)
- `NEXT_PUBLIC_API_URL` (for web/dealer [legacy path]/admin)
- `ALERTS_EMAIL_FROM` and `TRANSACTIONAL_EMAIL_FROM` (if email flows are tested locally)
- `MERCHANT_EMAIL_FROM` and `OPERATIONS_EMAIL_TO` (if merchant/admin email flows are tested locally)

---

## Validation Checklist

Before running in any environment:
- Database points to the correct environment.
- Redis points to the correct environment.
- Harvester scheduler is enabled in only one place.
- Stripe keys match environment.
- No secrets are exposed to client via `NEXT_PUBLIC_*` unless intended.
