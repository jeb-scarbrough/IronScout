# System Architecture Deep Dive (Pre-Launch, v1)

This is the day-one, no-fluff version. It is opinionated on purpose. The goal is to keep you from breaking trust boundaries or building the wrong thing because it already exists in the repo.

---

## V1 Runtime Topology (What Actually Ships)

Use this as the mental map for v1:

- Ingestion: affiliate feeds only
- Consumer UI: `apps/web`
- API: `apps/api`
- Worker: `apps/harvester`
- Admin: `apps/admin`
- Merchant: present in repo but deferred
- Consumer premium: not in v1 (all consumer capabilities are uniform)
- Dashboard: status-oriented monitoring (ADR-020)

Present in repo does not mean shippable. Scope doc wins.

---

## 1) Architecture Overview

The system is two loops that meet at the database:

- Ingestion loop: Harvester pulls affiliate feeds, normalizes, resolves to canonical products, and appends prices.
- Read loop: API filters and shapes data at query time; web app renders conservative UI.

Major components (canonical map):
- `apps/api` - enforcement and shaping
- `apps/web` - consumer UI
- `apps/admin` - operational controls
- `apps/merchant` - canonical naming (codebase may still contain `apps/dealer` as a legacy artifact)
- `apps/harvester` - ingestion pipeline

True system boundaries:
- Retailer vs Merchant is the trust boundary, not a UX boundary.
- Visibility is enforced in API query logic, not at ingest.
- Prices are immutable facts; visibility and corrections are interpretation layers.

The simplest way to think about it: Harvester writes facts. API decides what is safe to show.

---

## 2) Codebase Structure (and why it matters)

High-level structure:
- `apps/*`: deployable apps (API, web, admin, merchant, harvester)
- `packages/*`: shared libraries (db client, visibility predicates, types)
- `context/*`: product scope, promises, ADRs, and operations rules

Intentional boundaries:
- API routes are the only enforcement surface. That is where visibility, eligibility, and scope are applied.
- Harvester is the only writer of price facts.
- `packages/db/visibility.js` is the canonical visibility predicate. Anything that re-implements it is a drift bug.

Historical accidents:
- `apps/dealer` is legacy naming for the merchant portal. Treat it as `apps/merchant`.

Dependency reality:
- Web depends on API contracts, not the database.
- Harvester depends on the database and queues, not API routes.
- Admin can touch operational state; treat it as privileged and auditable.

---

## 3) Technology Choices (and tradeoffs)

Core tech:
- Node/Express for API: fast iteration, weak guardrails.
- Next.js for UI: quick UI iteration, copy drift risk.
- Postgres + Prisma: solid schema discipline, migrations can bite you if client is stale.
- Redis + BullMQ: reliable queues, but scheduler discipline is non-negotiable.
- pgvector + OpenAI embeddings: high leverage search, higher ops and cost surface.

What we would reconsider later (not v1 blockers):
- Stronger API gateway or policy layer to reduce query drift.
- Read replicas for heavy analytics paths (if they exist).

No consumer premium in v1. Any tier or premium behavior is future-only.

---

## 4) Key Architectural Decisions (the guardrails)

- ADR-001: Scheduler singleton. Schedulers that create execution records must be singleton or lock-protected. Workers can scale horizontally. Different schedulers achieve singleton differently (env var, DB lock, or BullMQ semantics).
- ADR-004 + ADR-015: Append-only price history with correction overlays. Facts are immutable; visibility is dynamic.
- ADR-005: Retailer visibility is enforced at query time, not ingest time.
- ADR-006 / ADR-003: No recommendations, AI is assistive only.
- ADR-009: Fail closed on ambiguity.

These are not preferences. They are the system.

---

## 5) Bugs, Failures, and Near-Misses (pre-launch)

Product has not launched. This section is grounded in pre-launch audits and runbooks.

Observed issues:
- Schema/client drift (P2022) required a dedicated runbook. This happens when schema changes are not migrated and generated client is stale.
- DB audit flagged orphan tables and heavy unused index load. That is pre-launch tech debt and a performance footgun if left unchecked.

Known incident classes (runbooks exist):
- Duplicate ingestion from scheduler duplication.
- Ineligible retailer visibility leaks.
- Alert misfires or spam.

These are the landmines you should assume will go off if you loosen the guardrails.

---

## 6) Wrong Turns and Course Corrections

- "Dealer" naming stuck around too long. It is deprecated. Canonical terminology is Merchant/Retailer.
- Dashboard positioning drifted toward action/recommendation language, then corrected to status-oriented monitoring (ADR-020).

The pattern: copy drift is easy, trust drift is easy. Guardrails exist to prevent both.

---

## 7) Pitfalls for Future Engineers

Common ways to break the system:
- Adding a new consumer read path and forgetting visibility + ignore + correction rules.
- Treating Merchant subscription state as a consumer visibility gate (it is explicitly not).
- Running multiple schedulers or enabling scheduler on multiple harvester instances.
- Treating existing deferred features as "live" because the code exists.

If you touch these areas, read first:
- `context/decisions/ADR-001-singleton-harvester-scheduler.md`
- `context/decisions/ADR-004-Append-Only-Price-History.md`
- `context/decisions/ADR-005-Retailer-Visibility-Determined-at-Query-Time.md`
- `context/decisions/ADR-015-price-history-immutability-and-data-corrections.md`
- `context/02_v1_scope_and_cut_list.md`

---

## 8) Engineering Thinking (how we reasoned)

Boundaries are defined by trust, not code ownership:
- Retailer visibility is a trust boundary. Every consumer query must respect it.
- Append-only history is a storage boundary. Corrections are overlays, not rewrites.
- Ambiguity fails closed. If a predicate cannot be evaluated, we hide, not show.

When tradeoffs were ugly:
- Immutability plus corrections is harder than rewriting rows, but it preserves auditability.
- Query-time enforcement adds complexity, but it is the only way to prevent stale visibility.

---

## 9) Best Practices That Actually Mattered

- Shared visibility predicates in `packages/db` prevent drift between API and harvester.
- Runbooks and guides are treated as part of the system, not paperwork.
- Environment isolation rules are strict: no cross-env DB/Redis.

---

## 10) New or Noteworthy Technologies

- BullMQ: simple but unforgiving if you duplicate schedulers.
- pgvector: powerful search, but troubleshooting is opaque and needs instrumentation.
- Prisma: migration discipline is required, or you will hit P2022.

---

## Trust Boundary Checklist (literal predicate)

Consumer visibility must use the canonical predicate:

- `retailers.visibilityStatus = ELIGIBLE`
- `merchant_retailers.listingStatus = LISTED`
- `merchant_retailers.status = ACTIVE`
- Subscription status is explicitly not part of visibility

If you see a read path not applying this, assume it is a trust bug.

---

## Repo Contains Deferred Systems (read this twice)

Present in repo does not mean shippable in v1. Scope doc wins.

- Affiliate feeds: in scope
- Retailer feeds: deferred or gated
- Merchant ingestion: deferred or gated
- Consumer premium: not in v1

If you wire up a deferred system just because it exists, you are shipping scope creep.
