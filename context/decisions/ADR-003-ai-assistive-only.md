# ADR-003: AI as Assistive Context Only

## Status
Accepted

## Context

IronScout uses AI for:
- intent-aware search
- normalization assistance
- ranking support
- explanatory context

There is a high risk that AI output could be misinterpreted as:
- advice
- recommendations
- predictions
- guarantees

Such interpretations would violate public promises and erode trust.

## Decision

AI in IronScout is **assistive only**.

AI may:
- interpret search intent
- assist grouping and ranking
- generate optional explanatory context

AI must not:
- make decisions for users
- recommend purchases
- predict future prices
- imply certainty or optimality

AI output must degrade gracefully when data quality is insufficient and must be removable without breaking core functionality.

## Alternatives Considered

### AI-Driven Recommendations
- Pros: Higher perceived “magic”
- Cons: Trust risk, liability exposure, requires guarantees the system cannot enforce

### Confidence Scores and Verdicts
- Pros: Simplifies decisions for users
- Cons: Creates false certainty, contradicts product philosophy

## Consequences

### Positive
- Preserves user trust
- Aligns with conservative public promises
- Keeps AI usage explainable and defensible
- Reduces liability and support burden

### Negative
- Less prescriptive output
- Requires careful language design
- Some users may want stronger guidance

These tradeoffs are intentional for v1.

## Notes

This ADR governs:
- search explanations
- alert language
- UI copy involving AI
- future feature evaluation involving AI
