# Consumer App Behavior

This document defines the behavior of the IronScout consumer-facing application.

It describes what users see, how surfaces behave, and how decisions are communicated.  
All user-facing behavior must comply with the UX Charter and relevant ADRs.

---

## Core User Flow

IronScout follows a simple loop:

1. Users search to explore prices.
2. Users save items they care about.
3. IronScout watches the market.
4. The Dashboard surfaces moments worth attention.

The system favors restraint over noise.

---

## Search

Search is the primary discovery surface.

Users can:
- Search by caliber, brand, and attributes
- Compare current prices across retailers
- View limited historical context
- Filter and refine results

Search does not recommend what to buy.

Search captures user intent but does not escalate urgency.

---

## Saved Items

Saved Items represent explicit user interest.

Users can:
- Save individual products
- View current price and retailer
- See simple directional price movement

Saved Items power:
- Dashboard surfacing
- Alert eligibility (per Alerts Policy v1)

Saved Items are the primary repeat-engagement mechanism.

---

## Saved Searches

Saved Searches exist to capture intent **implicitly**.

They are created when:
- Users repeat similar searches, or
- Users explicitly enable alerts from search

Saved Searches:
- Influence Dashboard visibility
- Do not appear as primary UI objects
- Are not managed on the Dashboard
- Do not trigger alerts in v1

Users are not expected to configure or tune Saved Searches.

---

## Dashboard

The Dashboard is the primary **action surface**.

It answers one question:

> “Is there something worth buying right now?”

### Hero Recommendation

- At most one Hero may be shown.
- The Hero appears only when a confident signal exists.
- If no Hero qualifies, nothing is shown in its place.

### No-Hero State (Default)

The absence of a Hero is the expected state.

In this case, the Dashboard displays a calm status message such as:
- “Nothing urgent right now”
- “Nothing changed yet”

This indicates the system is actively watching.

### Saved Items List

Below the Hero or No-Hero message, Saved Items are shown.

Saved Items include:
- Current price
- Retailer
- Directional price movement

No charts, scores, or timelines are shown.

---

## Alerts

Alerts are governed by `context/operations/alerts_policy_v1.md`.

In v1:
- Alerts apply only to explicitly Saved Items
- Alerts are rare and interruption-worthy
- Alerts do not apply to Saved Searches

Alerts complement the Dashboard. They do not replace it.

---

## Premium

Premium unlocks:
- Automated monitoring
- Faster detection of eligible events
- Reduced chance of missing time-sensitive moments

Premium does not:
- Increase alert volume
- Lower thresholds
- Introduce recommendations or predictions

Premium improves speed, not judgment.

---

## Language and Tone

All user-facing copy must:
- Be calm and factual
- Avoid urgency unless justified
- Avoid explanations or reasoning
- Avoid claims of optimality or authority

See `06_ux_charter.md` for enforcement rules.

---

## Summary

The consumer app is designed to:
- Reduce noise
- Preserve trust
- Surface moments selectively

Silence is intentional.
