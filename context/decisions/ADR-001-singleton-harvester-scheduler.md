# ADR-001: Singleton Harvester Scheduler in v1

## Status
Accepted

## Context

IronScout relies on a background ingestion system ("Harvester") to ingest Retailer feed data.  
In the current implementation, scheduling logic runs inside the Harvester process using in-process timers (`setInterval`).

Running multiple Harvester instances with independent schedulers introduces a high risk of:
- duplicate ingestion
- duplicate writes
- corrupted historical data
- downstream alert and benchmark errors

Distributed locking or queue-native scheduling adds complexity and operational overhead that is disproportionate to v1 scale and team size.

## Decision

For v1, IronScout will operate the Harvester scheduler as a **singleton**.

- Only one Harvester instance may run scheduling logic.
- Additional Harvester instances (if any) may run workers only.
- Scheduler duplication is explicitly disallowed.

If this constraint cannot be enforced operationally, Harvester must be deployed as a single instance.

## Alternatives Considered

### Distributed Locking (Redis)
- Pros: Enables horizontal scaling
- Cons: Adds failure modes, requires careful lock tuning, increases operational complexity

### Queue-Native Repeatable Jobs
- Pros: Robust and scalable
- Cons: Higher implementation cost, additional failure scenarios, not required for v1 scale

## Consequences

### Positive
- Predictable ingestion behavior
- Eliminates duplicate scheduling risk
- Easier debugging and ops
- Aligns with v1 operability constraints

### Negative
- Limits horizontal scaling of schedulers
- Requires explicit operational discipline

This decision may be revisited in a future release if ingestion volume or team size increases.

## Notes

This decision directly supports:
- append-only price history
- deterministic Retailer eligibility enforcement
- trust preservation in consumer-facing data

## Scope Clarification (Updated 2026-01)

This ADR applies to schedulers that create **execution records** (ingestion runs):

| Scheduler | Mechanism | ADR-001 Applies |
|-----------|-----------|-----------------|
| Affiliate feed scheduler (`apps/harvester/src/affiliate/scheduler.ts`) | `FOR UPDATE SKIP LOCKED` claim | **Yes** - DB lock ensures singleton behavior |
| Merchant scheduler (`apps/harvester/src/merchant/scheduler.ts`) | BullMQ repeatable jobs | **No** - BullMQ handles deduplication internally |

**Key invariant**: No duplicate ingestion runs may be created. Different schedulers achieve this through different mechanisms:
- Affiliate scheduler: distributed lock (`FOR UPDATE SKIP LOCKED`) + database setting (Admin UI control)
- Merchant scheduler: BullMQ jobId deduplication (inherently idempotent)
- Scrape scheduler: database setting (Admin UI control) with Emergency Stop capability

**Scheduler Control (Updated 2026-02)**: The `HARVESTER_SCHEDULER_ENABLED` setting is now controlled exclusively via the Admin UI (Settings > Danger Zone). The database is the single source of truth - no env var override. This ensures Emergency Stop reliably disables all schedulers.

**Workers** (job processors) are always safe to scale horizontally regardless of this ADR.

**Historical note**: The legacy crawl scheduler (`apps/harvester/src/scheduler/`) was removed in favor of the unified ingestion pattern where all data sources (affiliate feeds, retailer feeds) follow the same path through `source_products` → resolver → `products`.
