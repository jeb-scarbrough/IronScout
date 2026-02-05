# Mobile Price Check v1 Spec

## Status
Deferred to v1.1. This spec does not govern v1 implementation details unless explicitly referenced.

Note: Internal, user-linked analytics for Price Check may be implemented in v1.
The privacy rules below apply specifically to the **consumer-facing PriceCheckEvent** telemetry,
not to internal product analytics tables.

## Purpose
Support high-intent buyers by providing instant price sanity checks at the moment of decision.

Answers:
> “Is this price normal, high, or unusually low right now?”

---

## Entry Points
- Mobile route (/price-check)
- Header quick access
- Deep links
- Public endpoint. Authentication is optional (used only for optional Gun Locker prompts).

---

## Inputs
Required:
- Caliber
- Price per round

Optional:
- Brand
- Grain weight
- Box count (round count)
- Case material
- Bullet type

---

## Output
Single screen:
- Classification:
  - Lower than usual
  - Typical range
  - Higher than usual
- Supporting context:
  - Recent online price range
  - Freshness indicator

V1 does not surface retailer offers or outbound purchase links on this screen.

No verdicts or recommendations.

---

## Constraints
- No BUY / WAIT / SKIP
- No guarantees

### Classification Thresholds

Classification is based on percentile position within the 30-day price distribution:

| Classification | Threshold |
|----------------|-----------|
| **Lower than usual** | At or below 25th percentile (p25) |
| **Typical range** | Between 25th and 75th percentile |
| **Higher than usual** | At or above 75th percentile (p75) |

**Rationale**: Percentile-based classification is deterministic, avoids value judgments, and provides meaningful context without implying recommendations. The 25th/75th boundaries create a balanced distribution where ~50% of prices fall in "typical".

### Sparse Data Rule
Classification requires ≥5 price points for caliber in trailing 30 days.

- If <5 points: Display "Limited data. Recent range: $X.XX–$Y.YY/rd."
- If 0 points: Display "No recent data for [caliber]."

Do NOT show Lower/Typical/Higher classification when below threshold.

### Definitions
- **Price point**: One daily best price per product per caliber (lowest visible offer price on a given UTC calendar day)
- **Trailing 30 days**: Calendar days, not rolling hours
- **Freshness indicator**: "Based on prices from the last N days" where N = count of days with data in the 30-day window

---

## Intent Signal (Internal Only)

```ts
PriceCheckEvent {
  caliber: CaliberEnum
  enteredPrice: number
  classification: 'LOWER' | 'TYPICAL' | 'HIGHER' | 'INSUFFICIENT_DATA'
  hasGunLocker: boolean
  clickedOffer: boolean
  timestamp: Date
}
```

### Privacy Rules (Enforced)
These rules apply to the **consumer-facing PriceCheckEvent telemetry** only.

- **No individual-level persistence**: Raw `enteredPrice` values must not be stored in user-linked records
- **Aggregation only**: Events are aggregated to caliber-level statistics before long-term storage
- **Retention**: Raw event logs retained only for short-term debugging per ops policy, then purged or aggregated
- **No user linking**: Events must not be joinable to user identity after aggregation

Internal, user-linked analytics tables are governed by operational policy and DSAR handling.

**Implementation note (v1):** If event telemetry is emitted before aggregation is implemented,
it must remain short-lived and must not be stored in any user-linked system.

---

## Integration
- Optional prompt to add Gun Locker after result
- Optional save item flow
- No direct deal injection

**Analytics note:** `clickedOffer` is reserved for future offer-link UX. In v1, it should remain `false`/unused.

---

## Success Signals
- Repeat price checks
- Conversion to deal views
