# Environment Variables

This document lists environment variables required to run IronScout. It is written for coding agents and operators.

Rules:
- Do not commit secrets.
- Do not reuse credentials across environments.
- If a value is missing or ambiguous, default to restricted behavior (fail closed).

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
- `PORT` (default 3001 or similar)
- `DATABASE_URL`
- `REDIS_URL` (if API enqueues jobs or reads queue state)

Auth (pick one model, document it, enforce it):
- If API verifies JWTs:
  - `JWT_PUBLIC_KEY` or `JWT_SECRET`
- If API trusts internal service token:
  - `INTERNAL_API_TOKEN` (web/dealer/admin use it server-to-server)

AI/Search:
- `OPENAI_API_KEY` (or equivalent provider key)
- Optional:
  - `EMBEDDING_MODEL`
  - `CHAT_MODEL`

Stripe (consumer subscriptions):
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Required behavior:
- API must not resolve tier from client-provided headers. It must use verified auth (ADR-002).

---

## apps/web (Consumer)

Required:
- `NEXT_PUBLIC_API_URL` (points to apps/api)
- `NEXTAUTH_URL` (if using NextAuth)
- `NEXTAUTH_SECRET` (if using NextAuth)

Stripe (client):
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (if checkout is embedded)
- Server-side webhooks should live in API or a server route with `STRIPE_WEBHOOK_SECRET`.

---

## apps/dealer

Required:
- `NEXT_PUBLIC_API_URL` or dealer-specific API URL (if separate)
- `NEXTAUTH_URL` (if NextAuth)
- `NEXTAUTH_SECRET`

Optional:
- Dealer onboarding keys if dealer feeds are pulled from private endpoints

---

## apps/admin

Required:
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_ADMIN_API_URL` (if admin calls API directly)

Important:
- Admin impersonation must not bypass tier/eligibility enforcement.

---

## apps/harvester

Required:
- `DATABASE_URL`
- `REDIS_URL`

Networking:
- `HTTP_TIMEOUT_MS` (optional)
- `USER_AGENT` (optional)

Scheduling:
- `HARVESTER_SCHEDULER_ENABLED=true|false`
  - Use this to enforce singleton scheduler deployments (ADR-001).
  - Only one instance should set this true in production.

Safety:
- `MAX_WRITE_BATCH_SIZE` (optional)
- `MAX_SOURCE_CONCURRENCY` (optional)

---

## Minimum Local Dev Set (Suggested)

- `DATABASE_URL`
- `REDIS_URL`
- `OPENAI_API_KEY` (if AI search is enabled locally)
- `NEXTAUTH_SECRET` (for web/dealer/admin if applicable)
- `NEXT_PUBLIC_API_URL` (for web/dealer/admin)

---

## Validation Checklist

Before running in any environment:
- Database points to the correct environment.
- Redis points to the correct environment.
- Harvester scheduler is enabled in only one place.
- Stripe keys match environment.
- No secrets are exposed to client via `NEXT_PUBLIC_*` unless intended.
