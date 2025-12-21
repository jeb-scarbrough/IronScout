# ADR-004: Append-Only Price History

## Status
Accepted

## Context

IronScout presents historical price context to consumers and dealers.  
Trust in this context depends on preserving what was observed at a given time.

Overwriting or mutating historical price records:
- Destroys auditability
- Masks ingestion or normalization errors
- Makes debugging impossible
- Undermines user trust

Ingestion pipelines may re-run, retry, or fail partially. The data model must remain resilient under these conditions.

## Decision

All price history in IronScout is **append-only**.

Specifically:
- Each observed price is recorded as a new time-series entry
- “Current price” is derived from the most recent valid record
- Historical records must not be overwritten silently
- Corrections must create new records or be explicitly audited

Price history may be filtered, summarized, or shaped at query time, but the underlying data must remain immutable.

## Alternatives Considered

### Mutable Price Records
- Pros: Simpler schema
- Cons: Loses history, hides errors, breaks trust

### Periodic Snapshotting
- Pros: Reduced storage growth
- Cons: Loses resolution, complicates alerts and explanations

## Consequences

### Positive
- Strong auditability
- Reliable historical context
- Easier debugging and incident analysis
- Safer ingestion retries

### Negative
- Increased data volume
- Requires careful indexing and pruning strategies

These tradeoffs are acceptable for v1 and consistent with scaling assumptions.

## Notes

This ADR directly supports:
- historical price charts
- alert evaluation correctness
- conservative AI explanations
- trust-safe rollback and debugging
