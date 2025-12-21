# ADR-005: Dealer Visibility Determined at Query Time

## Status
Accepted

## Context

Dealer inventory appears in consumer experiences only when the dealer is eligible.

Dealer eligibility depends on:
- Subscription status
- Feed health
- Platform policies

Eligibility may change over time and must be enforced consistently across:
- search
- product views
- alerts
- watchlists

Relying solely on ingestion-time filtering is insufficient because:
- eligibility can change after ingestion
- historical data must be preserved
- ingestion may lag behind state changes

## Decision

Dealer visibility in all consumer-facing experiences is determined **at query time**.

Specifically:
- Dealer inventory is filtered during API queries
- Eligibility is resolved dynamically based on current state
- Ingestion may still skip writing data for ineligible dealers, but query-time enforcement is mandatory
- Alerts must check eligibility at evaluation time

No consumer-facing path may rely exclusively on ingestion-time filtering.

## Alternatives Considered

### Ingestion-Time Filtering Only
- Pros: Simpler queries
- Cons: Stale visibility, trust violations when eligibility changes

### Materialized Visibility Flags
- Pros: Faster reads
- Cons: Risk of staleness, complex invalidation logic

## Consequences

### Positive
- Deterministic enforcement
- Immediate removal of ineligible inventory
- Consistent behavior across all surfaces
- Reduced trust risk

### Negative
- Slightly more complex query logic
- Requires careful indexing and filtering

These tradeoffs are acceptable and align with v1 performance assumptions.

## Notes

This ADR governs:
- API query design
- alert evaluation logic
- dealer suspension and reactivation behavior
- trust enforcement across the platform
