# ADR-001: Singleton Harvester Scheduler in v1

## Status
Accepted

## Context

IronScout relies on a background ingestion system (“Harvester”) to ingest retailer and dealer data.  
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

This decision may be revisited post-v1 if ingestion volume or team size increases.

## Notes

This decision directly supports:
- append-only price history
- deterministic dealer eligibility enforcement
- trust preservation in consumer-facing data
