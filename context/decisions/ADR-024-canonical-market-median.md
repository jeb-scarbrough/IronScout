# ADR-024: Canonical Market Median

## Status
Accepted

## Context
Three services compute "the median" for ammunition pricing:

1. **market-deals.ts** — SQL `PERCENTILE_CONT(0.5)` per product
2. **price-check.ts** — JS `sorted[Math.floor(len/2)]` per caliber
3. **price-signal-index.ts** — JS `sorted[Math.ceil(p*len)-1]` per caliber

The JS approximations produce different numbers than SQL `PERCENTILE_CONT` for the same dataset:
- `Math.floor(len/2)` picks the lower-middle element (no interpolation)
- `Math.ceil(p*len)-1` uses a different index formula
- `PERCENTILE_CONT` linearly interpolates between adjacent values

When any public surface (API response, UI, AI-cited number) labels a value as "median", it must be identical regardless of which codepath generated it. Inconsistent numbers undermine IronScout's authority as a pricing reference.

## Decision

**Canonical Median** = `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY daily_best_ppr)`

All public-facing median values MUST be computed via SQL `PERCENTILE_CONT`. Specifically:

- **Daily best** = `MIN(corrected_visible_price / roundCount)` per product per UTC calendar day
- **Window** = 30-day trailing
- **Minimum samples** = 5 daily-best data points (below this → `INSUFFICIENT_DATA`)
- **Corrections/visibility** = Full ADR-015 overlay (IGNORE exclusion, MULTIPLIER application ≤2, scrape guardrails per ADR-021, retailer visibility per ADR-005)
- **Query path** = `products → product_links → prices` (canonical resolution per ADR-019)

**JS approximations** may remain for:
- Lightweight internal classification (e.g., LOW/TYPICAL/HIGH context bands via `positionInRange`)
- Ranking heuristics not surfaced as named statistics
- But NOT for any value labeled or surfaceable as "median", "p25", "p75", etc.

Percentile statistics (p25, p75) similarly use `PERCENTILE_CONT(0.25)` and `PERCENTILE_CONT(0.75)`.

## Alternatives Considered

**Precomputed materialized table**: A `market_snapshots` derived table rebuilt every 5 minutes alongside `current_visible_prices`. Rejected for v1 because the immediate problem is definitional consistency, not performance. The three services can each run `PERCENTILE_CONT` in their existing queries. Precomputation is a valid future optimization if query latency becomes an issue.

**Standardize on JS with interpolation**: Implement proper linear interpolation in JS to match `PERCENTILE_CONT`. Rejected because SQL aggregation is simpler, eliminates the sort step, and is already proven in `market-deals.ts`.

## Consequences

### Technical
- `price-check.ts` outer SELECT changed from raw-row return to `PERCENTILE_CONT` aggregation; JS sort + manual percentile removed
- `price-signal-index.ts` query restructured to daily-best CTE + `PERCENTILE_CONT`; JS `percentile()` helper removed; in-memory cache now stores SQL-computed values
- `market-deals.ts` unchanged (already compliant)

### Operational
- Median values may shift slightly for edge cases where JS approximation diverged from SQL interpolation
- Context band classification in price-signal-index is unchanged: uses `positionInRange` (linear 0-1 scale between min/max) against fixed 0.30/0.70 thresholds. p25/p75 are computed in SQL for future use but not consumed by the band classifier.

### Product / Trust
- Any surface citing "IronScout median" now returns a deterministic, consistent number
- LLM-facing market summaries backed by a single authoritative definition
- Foundation for future precomputed market statistics (caliber pages, DaaS, etc.)

## Notes
- The daily-best primitive (MIN corrected price per product per UTC day) is shared across all three consumers and `market-deals.ts` Query 2
- `current_visible_prices` only holds 7-day lookback data; median queries must go against the `prices` table with full corrections overlay for the 30-day window
- References: ADR-006 (no recommendations), ADR-015 (corrections overlay), ADR-019 (product resolver path), ADR-021 (scrape guardrails)
