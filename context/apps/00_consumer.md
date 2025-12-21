# Consumer App

This document describes the **consumer-facing experience** of IronScout as implemented for v1.  
It defines what consumers can see, do, and expect, and where explicit constraints apply.

This document must remain aligned with:
- `context/00_public_promises.md`
- `context/01_product_overview.md`
- `context/02_v1_scope_and_cut_list.md`

If consumer UI behavior conflicts with those documents, this document is wrong.

---

## Purpose of the Consumer App

The consumer app exists to help users:
- Discover ammunition more easily
- Compare prices across fragmented listings
- Interpret prices using historical context
- Monitor changes without constant manual checking

It is not designed to:
- Tell users what to buy
- Predict future prices
- Guarantee savings or optimal timing

---

## Core Consumer Flows (v1)

### Search

Consumers can:
- Enter free-text queries
- Apply structured filters (caliber, grain, casing, etc.)
- Browse canonically grouped products

Search behavior:
- Is intent-aware, not keyword-only
- Returns grouped results for like-for-like comparison
- Prioritizes clarity and consistency over exhaustiveness

Search must not:
- Imply recommendations
- Hide relevant uncertainty
- Collapse distinct products incorrectly for convenience

---

### Product Detail View

For a selected product, consumers can:
- See current offers from multiple retailers and eligible dealers
- Compare prices in a consistent format
- View historical price context (tier-limited)
- See availability status where known

Constraints:
- Offers must reflect dealer eligibility at view time
- Historical gaps must be visible or explained
- Prices must be tied to a source and timestamp

---

### Price History and Context

Price history is presented as:
- A time series or summary
- Contextual comparisons to recent ranges
- Descriptive signals, not verdicts

Language rules:
- “Lower than recent prices” is acceptable
- “Best deal” or “Buy now” is not

If history is sparse or noisy:
- Context must degrade
- Confidence must not be implied

---

### Alerts and Watchlists

Consumers can:
- Create alerts for price or availability changes
- Add products to watchlists
- Manage alert preferences

Alert behavior:
- Tier-limited in quantity and cadence
- Best-effort delivery
- Conservative language

Alerts must not:
- Trigger from ineligible dealer inventory
- Leak cross-account data
- Imply advice or urgency

---

## Subscription Behavior

### Free Users

Free users have access to:
- Core search
- Canonical grouping
- Current price and availability
- Limited historical context
- Basic alerts

Free users must not see:
- Premium-only explanations
- Deep historical views
- Advanced filters or ranking options

---

### Premium Users

Premium users gain:
- Deeper historical price context
- Faster and more flexible alerts
- Advanced filters and ranking
- AI-assisted explanations where data allows

Premium:
- Enhances information density
- Does not change guarantees
- Does not unlock recommendations or predictions

Tier enforcement must occur server-side.

---

## UI Language and Presentation Rules

Consumer UI must:
- Use conservative, descriptive language
- Avoid claims of certainty or optimality
- Avoid urgency framing

Disallowed language includes:
- “Best price”
- “Guaranteed savings”
- “You should buy now”

Allowed language includes:
- “Compared to recent prices”
- “Historically priced around”
- “Lower than recent averages”

Language is a trust surface.

---

## Error States and Degradation

When data is missing, delayed, or unreliable:
- Errors must be explicit and honest
- Features may be hidden or reduced
- UI must not fabricate confidence

Acceptable degradation:
- Hide explanations
- Reduce history depth
- Delay alerts

Unacceptable degradation:
- Showing stale data as current
- Showing ineligible inventory
- Presenting guesses as facts

---

## Accessibility and Performance

- Pages must load predictably
- Heavy computation must not block rendering
- Core functionality must remain usable on common devices

Performance tradeoffs should:
- Favor clarity over density
- Favor correctness over speed

---

## Known Constraints and Decisions

These are intentional for v1:

- No purchase links guarantee outcomes
- No “deal score” or verdict
- No social proof or gamification
- No personalization beyond tier and alerts

If any of these appear in UI, they are bugs.

---

## Non-Negotiables

- Consumer trust overrides conversion optimization
- Tier enforcement is mandatory
- Dealer eligibility is mandatory
- Conservative language is mandatory

---

## Guiding Principle

> The consumer app exists to clarify the market, not to decide for the user.
