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

## Clarification: Promotional Metadata (2025-12-22)

Price records may include promotional context persisted at ingestion time:

- `originalPrice` - MSRP when feed provides it
- `priceType` - REGULAR, SALE, or CLEARANCE (or null if unknown)
- `saleStartsAt`, `saleEndsAt` - Sale window timestamps

**Rules:**

1. **No inference** - These fields store what the feed explicitly provides. Do not compute or guess.
2. **No enforcement** - Sale windows are informational only. Feeds lie. Never use them for access control or filtering.
3. **No retroactive mutation** - Like all price data, promo metadata is append-only. Do not update historical records to "fix" sale status.

If a field is unknown, store `null`. Do not default to REGULAR or compute priceType from originalPrice vs price.

## Clarification: Derived Insights (2025-12-22)

Certain user-facing insights are **derived** from price history, not stored:

- "Lowest price seen" for a saved item
- "Is this the lowest price?" indicator
- Price percentile position

**Rules:**

1. **Derive at query time** - These values are computed from append-only price records, not stored on SavedItem or WatchlistItem.

2. **Tier-gated** - Derived insights like "lowest in 30 days" are Premium features. Free tier sees current price only.

3. **Not part of SavedItemDTO core** - The unified Saved Items API (ADR-011) returns core fields only. Derived insights require separate queries or a dedicated insights endpoint.

**Rationale**: Storing derived values would create denormalization risk and stale data. Keeping them query-time ensures consistency with append-only source of truth.
