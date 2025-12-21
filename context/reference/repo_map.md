# Repo Map

This document is a machine-usable map of the IronScout repository. It is written for humans and coding agents.

If this document conflicts with the actual repo layout, the repo wins. Update this file.

---

## Top-Level

- `apps/`
  - `api/` Backend API (Node, Express)
  - `web/` Consumer Next.js app (App Router)
  - `dealer/` Dealer Next.js app (App Router)
  - `admin/` Admin Next.js app (App Router)
  - `harvester/` Worker app (Node + BullMQ)
- `context/` Authoritative product and system documentation
- `decisions/` ADRs (immutable once accepted)
- `packages/` Shared packages (common libs, db client, types) if present

---

## apps/api

Primary responsibilities:
- Search endpoints (text + filters)
- Product endpoints (canonical product + offers + history)
- Alerts/watchlists endpoints
- Tier shaping and enforcement
- Dealer visibility filtering at query time
- AI search integration (intent parsing, embeddings, optional explanations)

Likely structure (verify in repo):
- `apps/api/src/routes/` Express route modules
- `apps/api/src/services/`
  - `ai-search/` AI search, embeddings, ranking, explanations
- `apps/api/src/config/`
  - `tiers.ts` Tier config and feature gates
- `apps/api/src/middleware/` auth, rate limiting, request context
- `apps/api/src/lib/` shared utilities

Hot paths:
- Search query path
- Dealer eligibility enforcement path
- Tier shaping path

---

## apps/web (Consumer)

Primary responsibilities:
- Consumer search UI
- Product views (offers + history)
- Alerts/watchlist UI
- Subscription UI and upgrade flows
- Conservative copy and trust-safe UX

Likely structure:
- `apps/web/app/` App Router routes
- `apps/web/app/api/auth/` NextAuth routes (if used)
- `apps/web/components/` UI components

Note:
- If `apps/web/app/admin/*` exists, treat it as internal ops tooling, not the primary admin portal.

---

## apps/dealer (Dealer Portal)

Primary responsibilities:
- Dealer authentication
- Feed configuration
- Feed health visibility
- SKU match visibility
- Dealer context (benchmarks) by plan
- Explicit enforcement of “no recommendations” stance in UI

Likely structure:
- `apps/dealer/app/` App Router routes
- `apps/dealer/app/api/` dealer portal API routes (feed ops, status)
- `apps/dealer/components/`

---

## apps/admin (Admin Portal)

Primary responsibilities:
- Dealer lifecycle actions (approve, suspend, reactivate)
- Subscription tier and status changes
- Billing method management
- Audit visibility
- Safe impersonation (must not bypass enforcement)

Likely structure:
- `apps/admin/app/` App Router routes
- `apps/admin/app/api/auth/` NextAuth routes

---

## apps/harvester (Worker)

Primary responsibilities:
- Retailer ingestion pipeline (fetch → extract → normalize → write)
- Dealer ingestion pipeline (feed ingest → sku match → benchmarks → insights)
- BullMQ queues orchestration
- Execution records + logs generation

Likely structure:
- `apps/harvester/src/`
  - `scheduler/` scheduling logic
  - `fetcher/` network fetch
  - `extractor/` parsing/extraction
  - `normalizer/` ammo normalization
  - `writer/` DB writes
  - `alerter/` alert triggers
  - `dealer/` dealer pipeline modules
  - `config/queues.ts` queue definitions

Critical constraint:
- Scheduler must be singleton or lock-protected (ADR-001).

---

## Shared Data Layer

Source of truth should be:
- `prisma/schema.prisma` or `packages/db/prisma/schema.prisma`

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

- Server-side tier enforcement (ADR-002)
- Dealer visibility filtered at query time (ADR-005)
- Append-only price history (ADR-004)
- Fail closed on ambiguity (ADR-009)
- No recommendations or verdicts (ADR-006)
- Singleton scheduler or lock (ADR-001)
