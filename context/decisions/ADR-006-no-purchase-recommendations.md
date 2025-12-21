# ADR-006: No Purchase Recommendations or Verdicts

## Status
Accepted

## Context
IronScout aggregates pricing and availability data and presents historical context to users.  
There is a strong temptation to convert this context into prescriptive outputs such as buy / wait / hold verdicts or deal scores.  
Such outputs imply authority and certainty the system cannot guarantee.

## Decision
IronScout will not present purchase recommendations, verdicts, or deal scores in v1.  
The platform provides context and signals only. All decisions remain with the user.

## Alternatives Considered
- Verdict-based recommendations
- Confidence or deal scores

## Consequences
Preserves trust and reduces liability at the cost of prescriptive UX.

## Notes
Governs consumer UI, alerts, and AI explanations.

### Implementation Notes (2024-12)

**Confidence signals are internal-only until objective criteria exist.**

The following fields are used for internal ranking but MUST NOT appear in consumer-facing responses:

- `retailerConfidenceHint` - Derived from retailer tier, used internally for ranking
- `brandDataCompletenessHint` - Derived from brand data availability, used internally

These hints live in `price-signal-index.ts` behind an `_internal` property and are explicitly
stripped before consumer output. The `consumer-output-safety.test.ts` test suite enforces
that these fields never leak to consumer routes (search, dashboard, alerts).

Consumer-facing output uses `PriceSignalIndex` which provides only:
- `relativePricePct` - How current price compares to trailing median
- `positionInRange` - Position within observed min/max (0-1)
- `contextBand` - LOW / TYPICAL / HIGH classification
- `meta` - Data coverage information (windowDays, sampleCount, asOf)

This separation allows internal ranking optimization while maintaining the
"context only, no verdicts" policy for users.
