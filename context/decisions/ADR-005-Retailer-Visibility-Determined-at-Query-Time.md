# ADR-005: Retailer Visibility Determined at Query Time

## Status
Accepted

## Context

Retailer inventory (consumer prices) appears in consumer experiences only when the Retailer is eligible.

Retailer eligibility depends on:
- Feed health
- Platform policies
- Operational listing status set by the administering Merchant (see predicate below)

**Key distinction (per Merchant-and-Retailer-Reference.md):**
- **Retailer**: Consumer-facing storefront whose prices appear in search results. Prices are keyed by `retailerId`.
- **Merchant**: B2B portal account with authentication, billing, and subscription. Merchants may administer one or more Retailers.
- **Eligibility**: Applies to Retailer visibility, not Merchant existence or portal access.

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

Retailer visibility in all consumer-facing experiences is determined **at query time**.

Specifically:
- The query-time visibility predicate is:
  - `retailers.visibilityStatus = ELIGIBLE`
  - `merchant_retailers.listingStatus = LISTED`
  - `merchant_retailers.status = ACTIVE`
- Subscription status MUST NOT be used as a visibility gate in consumer queries.
- v1: Retailers may have no Merchant relationship; listing applies only when a relationship exists.
- Eligibility and listing are resolved dynamically based on current state.
- Ingestion may still skip writing data for ineligible or unlisted Retailers, but query-time enforcement is mandatory.
- Alerts must check Retailer eligibility/listing at evaluation time.

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
- Immediate removal of ineligible Retailer inventory
- Consistent behavior across all surfaces
- Reduced trust risk

### Negative
- Slightly more complex query logic
- Requires careful indexing and filtering

These tradeoffs are acceptable and align with v1 performance assumptions.

## Notes

This ADR governs:
- API query design
- Alert evaluation logic
- Retailer eligibility enforcement (via feed health, platform policies, or Merchant listing state)
- Trust enforcement across the platform

## Canonical Statements (Required)

This ADR explicitly supports:
- Merchants authenticate; Retailers do not
- Consumer prices are keyed by `retailerId`
- Eligibility applies to Retailer visibility, not Merchant existence
- Listing is an explicit Merchant↔Retailer entitlement; both eligibility and listing must be true for consumer visibility
- Merchant subscription status is not a consumer visibility predicate
- v1: Retailers may have no Merchant relationship; listing applies only when a relationship exists
- Merchant billing per Retailer listing is an entitlement unit when billing exists
