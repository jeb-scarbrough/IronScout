# Repo Map

This document is a machine-usable map of the IronScout repository. It is written for humans and coding agents.

If this document conflicts with the actual repo layout, the repo wins. Update this file.

## Terminology (Canonical)

- **Merchant**: B2B portal account (subscription, billing, auth boundary). Merchant has users. Merchant submits merchant-scoped datasets.
- **Retailer**: Consumer-facing storefront shown in search results. Consumer `prices` are keyed by `retailerId`. Retailers do not authenticate.
- **Source/Feed**: Technical origin of a consumer price record (affiliate, scraper, direct feed). Source is not Merchant.
- **Admin rights**: Merchant users are explicitly granted permissions per Retailer.
- **Legacy**: Any "dealer" wording or `DEALER_*` keys are legacy and must be migrated to "merchant" terminology.

---

## Top-Level

- `apps/`
  - `api/` Backend API (Node, Express)
  - `web/` Consumer Next.js app (App Router)
  - `merchant/` Merchant portal Next.js app
  - `admin/` Admin Next.js app (App Router)
  - `harvester/` Worker app (Node + BullMQ)
  - `www/` Marketing website (Next.js static export)
- `context/` Authoritative product and system documentation
- `context/decisions/` ADRs (immutable once accepted)
- `packages/` Shared packages (crypto, db, logger, notifications, redis, scraper-registry, ui)

---

## apps/api

Primary responsibilities:
- Search endpoints (text + filters)
- Product endpoints (canonical product + offers + history)
- Alerts/watchlists endpoints
- Uniform v1 capability shaping (no consumer tiers)
- Retailer visibility filtering at query time
- AI search integration (intent parsing, embeddings, optional explanations)

Structure:
- `apps/api/src/routes/` Express route modules
- `apps/api/src/services/`
  - `ai-search/` AI search, embeddings, ranking, explanations
- `apps/api/src/config/`
  - `tiers.ts` V1 capabilities (uniform for all users)
- `apps/api/src/middleware/` auth, rate limiting, request context
- `apps/api/src/lib/` shared utilities

Hot paths:
- Search query path
- Retailer eligibility enforcement path
- Tier shaping path

---

## apps/web (Consumer)

Primary responsibilities:
- Consumer search UI
- Product views (offers + history)
- Alerts/watchlist UI
- Conservative copy and trust-safe UX

Structure:
- `apps/web/app/` App Router routes
- `apps/web/app/api/auth/` NextAuth routes
- `apps/web/components/` UI components

Note:
- If `apps/web/app/admin/*` exists, treat it as internal ops tooling, not the primary admin portal.

---

## apps/merchant (Merchant Portal)

Primary responsibilities:
- Merchant authentication
- Feed configuration
- Feed health visibility
- SKU match visibility
- Merchant context (benchmarks) by plan (inactive in v1)
- Explicit enforcement of "no recommendations" stance in UI

Structure:
- `apps/merchant/app/` App Router routes
- `apps/merchant/app/api/` Merchant portal API routes (feed ops, status)
- `apps/merchant/components/`

---

## apps/admin (Admin Portal)

Primary responsibilities:
- Affiliate feed operations and retailer eligibility (v1)
- Audit visibility
- Safe impersonation (must not bypass enforcement, inactive in v1)
- Merchant lifecycle and billing (inactive in v1)

Structure:
- `apps/admin/app/` App Router routes
- `apps/admin/app/api/auth/` NextAuth routes

---

## apps/harvester (Worker)

Primary responsibilities:
- Affiliate ingestion pipeline (v1)
- Retailer ingestion pipeline (inactive in v1)
- Merchant ingestion pipeline (feed ingest → sku match → benchmarks → insights, inactive in v1)
- BullMQ queues orchestration
- Execution records + logs generation

Structure:
- `apps/harvester/src/`
  - `affiliate/` affiliate feed ingestion pipeline
  - `alerter/` alert triggers
  - `config/` configuration and queue definitions
  - `currentprice/` current price tracking
  - `embedding/` embedding generation
  - `merchant/` Merchant pipeline modules
  - `ops/` operational utilities
  - `parsers/` data parsers
  - `quarantine/` quarantine system for invalid products
  - `resolver/` product resolver logic
  - `scraper/` web scraping orchestration
  - `utils/` helper utilities
  - `worker.ts` main worker entry point

Critical constraint:
- Scheduler must be singleton or lock-protected (ADR-001).

---

## Shared Data Layer

Source of truth:
- `packages/db/prisma/schema.prisma`

Agents should not guess schema. If schema is not visible, expose it.

---

## Where to Make Changes Safely

- Product promises: `context/00_public_promises.md` (ceiling)
- v1 scope: `context/02_v1_scope_and_cut_list.md`
- release gates: `context/03_release_criteria.md`
- security boundaries: `context/05_security_and_trust.md`
- decisions: `decisions/ADR-*.md`

If code changes violate any ADR, write a new ADR or fix the code.

---

## Invariants Agents Must Not Break

- Tier enforcement, if reintroduced, must be server-side (ADR-002)
- Retailer visibility filtered at query time (ADR-005)
- Append-only price history (ADR-004)
- Fail closed on ambiguity (ADR-009)
- No recommendations or verdicts (ADR-006)
- Singleton scheduler or lock (ADR-001)
