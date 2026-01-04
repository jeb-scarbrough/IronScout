# ADR-016: Feed Variant Design for Flexible Ingestion

## Status
Accepted

## Context

The original affiliate feed schema enforced a strict 1:1:1 mapping:
```
affiliate_feeds.sourceId @unique → sources.retailerId (required) → retailers
```

This works for simple cases but creates friction when:
- A retailer provides **full + delta feeds** (daily full refresh, hourly deltas)
- A retailer has **regional splits** (US, CA, EU catalogs)
- A retailer has **category splits** (ammo feed vs accessories feed)
- Different affiliate programs exist under the same retailer brand

The workaround (creating multiple `sources` per retailer) leads to source proliferation and conceptual confusion about what "source" means.

A separate concern: some affiliate networks offer **multi-retailer consolidated exports** (one feed containing multiple advertisers). The original schema blocks this entirely.

## Decision

### Primary Change: Add `variant` field to `affiliate_feeds`

```prisma
enum FeedVariant {
  FULL
  DELTA
  REGIONAL_US
  REGIONAL_CA
  REGIONAL_EU
  CATEGORY_AMMO
  CATEGORY_ACCESSORIES
}

model affiliate_feeds {
  sourceId String
  variant  FeedVariant @default(FULL)

  @@unique([sourceId, variant])  // Replaces sourceId @unique
}
```

This enables:
- Multiple feeds per source (one FULL, one DELTA, etc.)
- Clean differentiation without source proliferation
- Existing run semantics unchanged (one run = one feed = one source = one retailer)

### Deferred: Multi-Retailer Exports

Multi-retailer consolidated feeds are **not supported** in this change. This is intentional.

Multi-retailer feeds would require:
- Exploding one physical run into multiple logical runs, OR
- Changing `affiliate_feed_runs` to stop assuming one source/retailer
- Row-level `advertiserId` routing in the processor
- Per-retailer expiry, locking, and error attribution

This is a distinct abstraction. When needed, model it as a separate ingestion primitive (`network_export_feeds`), not nullable fields on `affiliate_feeds`.

**The schema blocking multi-retailer feeds is a feature, not a bug.** It preserves clean run-level accounting.

## Alternatives Considered

### Keep Current (Source Proliferation)
- Pros: No schema change
- Cons: Multiple sources per retailer is conceptually confusing, harder to reason about

### Nullable sourceId for Multi-Retailer
- Pros: Single table handles all cases
- Cons: Breaks existing provenance model, run semantics become ambiguous, requires significant refactor

### feedType on Sources Instead
- Pros: Keeps affiliate_feeds 1:1 with sources
- Cons: Pollutes source model with feed-specific concerns

## Consequences

### Positive
- Clean support for full/delta, regional, and category splits
- No source proliferation
- Run semantics unchanged
- Cheap migration (add column, change unique constraint)
- Scheduler schedules per (sourceId, variant)

### Negative
- Code querying by sourceId alone must specify variant (but no such code exists today)
- Multi-retailer exports still unsupported (by design)

## Migration

1. Add `variant` column with default `FULL`
2. Drop unique index on `sourceId`
3. Add unique index on `(sourceId, variant)`
4. Existing rows backfill to `FULL` automatically

## Notes

- All existing code queries by `id` (primary key), not `sourceId`, so no code changes required
- Future multi-retailer support should be a new table with explicit child-run semantics
