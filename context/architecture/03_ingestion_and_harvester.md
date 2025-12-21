# Ingestion and Harvester

This document describes how data ingestion works in IronScout as implemented today, with explicit callouts where behavior, documentation, or scale assumptions require decisions or code changes.

This document is intentionally operational and conservative. It describes **what the harvester actually does**, not what it could do in the future.

---

## Purpose of the Harvester

The harvester exists to:
- Ingest pricing and availability data from external sources
- Normalize inconsistent inputs into a canonical schema
- Preserve historical price data
- Feed search, alerts, and dealer visibility with predictable inputs

The harvester is designed for **correctness, traceability, and idempotency**, not real-time guarantees.

---

## Harvester Architecture (Current)

### Process Model

- Harvester is a long-running Node.js worker (`apps/harvester`)
- Uses **BullMQ + Redis** for job orchestration
- Writes directly to Postgres via Prisma
- Runs multiple pipelines in the same worker process:
  - Retailer / affiliate ingestion
  - Dealer feed ingestion
  - Dealer benchmarks and insights

This architecture favors simplicity over isolation in v1.

---

## Ingestion Pipelines

### 1) Retailer / Affiliate Ingestion

This pipeline ingests third-party retailer or affiliate sources.

**High-level stages:**
1. Schedule crawl
2. Fetch remote data (HTML, JSON, CSV, XML)
3. Extract offers
4. Normalize ammo attributes
5. Write prices and availability
6. Trigger alerts

**Key components (observed):**
- `scheduler/*`
- `fetcher/*`
- `extractor/*`
- `normalizer/*`
- `writer/*`
- `alerter/*`

**Invariants:**
- Ingestion must be idempotent
- Unchanged content should not produce new writes
- Failures must not corrupt historical data

---

### 2) Dealer Feed Ingestion

Dealer feeds are ingested through a separate pipeline.

**High-level stages:**
1. Dealer feed scheduling
2. Fetch and parse feed
3. Validate feed health
4. Normalize SKUs
5. Match SKUs to canonical products
6. Write dealer inventory and prices
7. Generate benchmarks and insights (if eligible)

**Key components (observed):**
- `dealer/feed-ingest.ts`
- `dealer/sku-match.ts`
- `dealer/benchmark.ts`
- `dealer/insight.ts`
- `dealer/scheduler.ts`

---

## Scheduling Model (Critical)

### Current State

- Dealer scheduling uses `setInterval` inside the worker process.
- Retailer scheduling appears to follow a similar in-process pattern.

### Implication

If more than one harvester instance is running:
- Schedulers will run **once per instance**
- Duplicate executions and writes are possible

This is a **hard scaling constraint**.

---

### Decision Required: Scheduler Ownership

For v1, one of the following must be explicitly chosen and documented:

1. **Singleton Scheduler (Recommended for v1)**
   - Only one harvester instance runs schedulers
   - Additional instances run workers only
   - Simple and low-risk

2. **Distributed Locking**
   - Scheduler ticks acquire a Redis lock
   - Only one instance schedules per interval
   - More complex but scalable

3. **Queue-Native Scheduling**
   - Replace intervals with BullMQ repeatable jobs
   - Most robust, highest complexity

**If no decision is made, v1 should assume a singleton scheduler.**

---

## Idempotency and Deduplication

### Expectations

- Re-running a job must not duplicate data
- Duplicate scheduling must not corrupt state
- Writes must be safe under retries

### Current Observations

- Content hashing is used in some fetch paths
- Writer behavior appears row-by-row in some cases

### Required Invariants

- Use deterministic job IDs where possible
- Batch writes to reduce amplification
- Prefer “skip if unchanged” over overwrite

**If idempotency cannot be guaranteed, ingestion must fail closed.**

---

## Write Strategy and History

### Price History

- Price records form a time series
- History must not be overwritten silently
- “Current price” is derived, not stored as a single mutable field

### Dealer Inventory

- Dealer SKUs anchor dealer offers
- SKU-to-product mapping must be stable
- Failed mappings must be visible to ops

### Decision Required

- Confirm that writes are append-only for price history
- Ensure batch operations are used instead of per-row writes

---

## Dealer Eligibility and SKIPPED Executions

### Required Behavior

- Dealer feeds must respect subscription status
- If a dealer is ineligible:
  - Execution is marked SKIPPED
  - No downstream jobs run
  - No benchmarks or insights are generated

### Trust Requirement

A SKIPPED execution must be a **hard stop**, not a soft warning.

If downstream effects occur after SKIPPED, it is a correctness bug.

---

## Failure Modes and Quarantine

### Expected Failure Types

- Feed unreachable
- Invalid format
- Partial data
- Mapping failures
- Sudden data spikes

### Required Controls

- Ability to disable or quarantine a feed
- Ability to stop propagation without redeploying
- Visibility into last successful execution

Quarantine must isolate the feed without affecting unrelated sources.

---

## Observability and Debugging

### Required Signals

- Execution status and timestamps
- Counts of items processed, written, skipped
- Error summaries
- Ability to replay a failed execution safely

Logs and execution records are operational tools, not user-facing features.

---

## Performance and Scaling Constraints

### v1 Assumptions

- Data is eventually consistent
- Ingestion is not real-time
- Throughput is bounded by:
  - database write capacity
  - normalization complexity
  - scheduler behavior

### Explicitly Out of Scope (v1)

- Real-time ingestion guarantees
- Auto-scaling schedulers
- Multi-region ingestion

---

## Known Inconsistencies and Required Decisions

These must be resolved or explicitly accepted before scaling:

1. **Scheduler duplication risk**
   - Decision: singleton vs lock vs repeatable jobs

2. **Batching and write amplification**
   - Decision: enforce batching and reduce per-item writes

3. **SKIPPED execution enforcement**
   - Decision: audit downstream job creation paths

4. **Embedding generation ownership**
   - Decision: API vs harvester (documented in `02_search_and_ai.md`)

---

## Non-Negotiables

- Ingestion must fail safely
- Bad data must not propagate silently
- Dealer eligibility must be enforced before visibility
- Historical data must not be destroyed to “fix” bugs

---

## Guiding Principle

> Ingestion exists to preserve trust in the data, not to maximize throughput.
