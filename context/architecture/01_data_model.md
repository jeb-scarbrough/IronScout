# Data Model

This document describes IronScout’s current data model as represented in the existing documentation and reflected by how the apps behave (API search, harvester ingestion, dealer feeds, subscriptions).

**Source of truth note:** the only Prisma schema we have in the provided materials is the excerpt in `database.md`, and it contains `...` placeholders. That means some fields and relations are intentionally omitted. Before treating this as final, the repo should expose the actual Prisma schema (e.g. `prisma/schema.prisma` or `packages/db/prisma/schema.prisma`) and this document should be reconciled against it.

---

## Data Model Goals (v1)

- Represent ammunition products in a canonical, comparable way.
- Represent multiple offer sources (retailers and dealers) without mixing identities.
- Track price history in a queryable, tier-shapeable format.
- Support alerts and watchlists without cross-account leakage.
- Support dealer ingestion, feed health, benchmarking, and insights.
- Support subscription enforcement and admin auditability.

---

## Core Entity Map

At a high level:

- **Product** is the canonical unit (what a consumer is searching for).
- **Retailer** and **Dealer** are sources of offers.
- **Price** is the time-series record of an offer price (by source + product or SKU mapping).
- **Alert** is a user-defined trigger referencing product/filters.
- **DealerFeed / DealerSku** model dealer ingestion and mapping to canonical products.
- **MarketBenchmark / DealerInsight** model “context” for dealers (not recommendations).
- **Source / Execution** model harvester ingestion operations.
- **AdminAuditLog** captures privileged actions.

---

## Entities and Responsibilities

### User
Represents a consumer account.

Key responsibilities:
- Owns alerts.
- Owns subscription tier (FREE vs PREMIUM).
- Links to billing identities (Stripe IDs).

Invariants:
- Tier must be derived from authenticated identity (not client headers).
- User-owned data must be isolated (alerts, watchlists, saved items).

**Doc excerpt shows:**
- `tier: UserTier (FREE | PREMIUM)`
- `stripeCustomerId`, `stripeSubscriptionId`
- relations to `Alert[]` and auth tables.

**Potential inconsistency needing decision/code change**
- Current API tier resolution may rely on `X-User-Id` header in some flows (see `architecture/00_system_overview.md`). That violates isolation and must be replaced with verified auth.

---

### Product (Canonical Product)
Represents a canonically grouped ammunition product.

Key responsibilities:
- Canonical grouping for inconsistent listings.
- Anchor entity for search, product pages, and alerts.

Typical fields (per docs and other design intent):
- caliber, grains, brand, casing, bullet type, pressure rating, projectile metadata
- packaging attributes (round count)
- normalized descriptors for filtering and AI search

Invariants:
- Product should be stable and deterministic for grouping.
- Normalized attributes should be the only ones used for filtering/ranking logic.

**Decision to confirm**
- Whether “Offer” is a first-class entity or whether `Price` represents offers directly. Current docs show `Price` but do not show a separate `Offer` model. If API returns “offers”, it is likely derived from latest `Price` records.

---

### Retailer
Represents a non-dealer source (affiliate retailer, marketplace, etc.).

Key responsibilities:
- Anchor for retailer offers and tracking.
- Link to harvester sources.

Invariants:
- Retailer identity must not overlap dealer identity.
- Retailer visibility rules differ from dealer eligibility rules.

---

### Price (Offer Time Series)
Represents a time series record for a product price from a source.

Key responsibilities:
- Support “current price” (latest record) and “historical context” (series).
- Support tier-based history shaping (free sees less).
- Support alert evaluation.

**Important design constraint**
- Price records should be append-only or near-append-only. If you overwrite price history you destroy trust and debugging ability.

**Decision to confirm**
- Uniqueness and indexing strategy:
  - Expected query patterns are “latest by product+source”, “history by product+source”, and “market summary by caliber/product”.
  - This implies indexes on `(productId, retailerId, createdAt)` and/or `(productId, dealerSkuId, createdAt)`.
- If you need dedupe, use a content hash and a “no-op if unchanged” strategy rather than overwriting.

---

### Alert
Represents a consumer alert configured by a user.

Key responsibilities:
- Store alert configuration (thresholds, conditions, cadence).
- Track delivery state.

Invariants:
- Alerts must be isolated to the owning user.
- Alerts should evaluate against data that matches the user’s tier limits.
- Alert language must remain conservative (signals, not advice).

---

## Dealer Domain Model

### Dealer
Represents a dealer organization.

Key responsibilities:
- Dealer identity, eligibility state, plan/tier, billing mode.
- Determines whether dealer inventory is visible to consumers.

**Required invariant**
- Dealer eligibility must be enforced server-side at query time for all consumer paths (search, product view, alerts, watchlists).

**Doc excerpt indicates**
- subscription status and tier exist (details are in subscription management docs).
- relations to feeds, users, contacts, SKUs.

---

### DealerUser and DealerContact
- **DealerUser**: authenticated portal users tied to a dealer.
- **DealerContact**: operational contact info.

Invariants:
- Dealer portal data must not leak across dealers.
- Dealer portal permissions should be explicit (if you have roles).

---

### DealerFeed
Represents a configured feed for a dealer.

Key responsibilities:
- Store feed URL/type, parsing config, status, health, last run.
- Support quarantine/disable behavior.

Operational invariants:
- Feed health affects eligibility for visibility (per public promises).
- If a feed is “SKIPPED” due to subscription status, it must not produce downstream outputs (benchmarks/insights).

---

### DealerSku
Represents a dealer-provided SKU row (their inventory unit) and its mapping to canonical products.

Key responsibilities:
- Preserve dealer SKU identity and metadata.
- Map to canonical `Product` when possible.
- Serve as the anchor for dealer “offer” visibility.

Invariants:
- Mapping must be deterministic and explainable enough for ops.
- When mapping fails, SKU should be quarantinable or flagged, not silently mis-mapped.

---

### MarketBenchmark
Represents aggregated market pricing context.

Key responsibilities:
- Provide plan-appropriate benchmark context (caliber-level, product-level, etc.).
- Should be descriptive statistics, not recommendations.

Invariants:
- Benchmarks must never imply optimal actions.
- Benchmark generation must be idempotent and skip-safe (no output for SKIPPED executions).

---

### DealerInsight
Represents dealer-facing “context” derived from benchmarks and dealer inventory.

Key responsibilities:
- Plan-appropriate “you are above/below market” style context.
- Historical context and trend summaries.

Invariants:
- No prescriptive “recommended price” fields in v1.
- If you compute recommendation-like fields internally, they must be stripped from API/UI until explicitly enabled later.

---

## Harvester Operational Model

### Source
Represents a crawlable/ingestable source for the harvester (retailer feed/page).

Key responsibilities:
- Configuration and enable/disable state.
- Links to executions.

---

### Execution
Represents a run of the harvester pipeline for a source.

Key responsibilities:
- Track status, timings, counts, errors.
- Enable debugging and replay.

Invariants:
- Executions should be immutable records of what happened.
- If the system is re-run, it should create a new execution record, not overwrite history.

---

## Admin Auditability

### AdminAuditLog
Represents an auditable record of privileged changes.

Required coverage:
- Subscription changes
- Dealer eligibility changes
- Feed enable/disable/quarantine
- Any override that changes visibility or billing state

Invariants:
- If a privileged action can’t be audited, it shouldn’t exist.
- Audit log must capture “before” and “after” values (JSON is fine).

**Potential inconsistency needing code change**
- Ensure all admin mutations are wrapped in a transaction that writes audit logs alongside the mutation, not “best effort”.

---

## Key Enums and Constraints

From `database.md`, the model relies on enums such as:
- `UserTier`: FREE, PREMIUM
- Ammo attribute enums (bullet type, casing, pressure, etc.)
- Dealer subscription and tier enums (documented elsewhere)

**Decision to confirm**
- Ensure all tier/eligibility enums are centralized and referenced consistently across:
  - API shaping
  - dealer portal
  - admin portal
  - harvester SKIPPED logic

---

## Cross-Cutting Invariants (Must Hold Everywhere)

1. **No cross-account access**
   - user-to-user
   - dealer-to-dealer
   - consumer-to-dealer sensitive data

2. **Tier enforcement is server-side**
   - history depth
   - explanation visibility
   - advanced features

3. **Dealer visibility is deterministic**
   - blocked dealers never appear in consumer flows

4. **Append-only time series**
   - preserve price history
   - avoid overwrites that hide errors

5. **Idempotent ingestion**
   - schedulers and workers cannot create duplicates under concurrency

---

## Known Gaps and Items Requiring Decisions

These need explicit decisions and may require code changes:

1. **Where is the actual Prisma schema?**
   - The provided `database.md` excerpt contains placeholders (`...`).
   - Decision: expose the real schema file and treat it as truth.

2. **Offer representation**
   - Docs show `Price` but do not show `Offer`.
   - Decision: confirm whether “offer” is derived (latest Price) or a first-class model.

3. **Dealer eligibility fields**
   - Public promises require eligibility based on subscription, feed health, and policies.
   - Decision: confirm which fields encode feed health and how they affect visibility.

4. **Index strategy for price history**
   - Decision: define indexes for “latest offer” and “history slice” queries so v1 performance is stable.

---

## Next Document

`architecture/02_search_and_ai.md` should define:
- what AI signals exist
- how canonical grouping interacts with embeddings
- exactly what is returned to Free vs Premium
- how explanations are gated and degraded
