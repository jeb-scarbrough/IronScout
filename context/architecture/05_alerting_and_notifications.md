# Alerting and Notifications

This document describes how alerts and notifications work in IronScout **as implemented today**, with explicit guardrails to ensure alerts remain trust-safe, tier-correct, and operationally manageable.

This document defines **mechanics and constraints**, not marketing language. User-facing promises live in `context/00_public_promises.md`.

---

## Terminology Note

| User-Facing | Internal (Code/DB) | Notes |
|-------------|-------------------|-------|
| **Saved Item** | WatchlistItem | The canonical "I care about this" record |
| **Notification** | Alert | Alert is internal; users see "notifications" |
| Saved Items page | `/dashboard/saved` | Was `/dashboard/alerts` |

**Rule**: User-facing surfaces (UI, emails, docs) use "Saved Items" and "Notifications". This document uses internal terms for precision.

See ADR-011 for the unified Saved Items model.

---

## Purpose of Alerts

Alerts exist to:
- Notify users when monitored conditions change
- Reduce the need for constant manual checking
- Surface *signals*, not decisions

Alerts are informational.  
They must never imply advice, urgency, or guaranteed outcomes.

---

## Alert Types (v1)

### Consumer Alerts

Supported alert categories in v1:
- **Price change alerts** for a product or group
- **Availability change alerts** (in stock / out of stock)
- **Watchlist-based alerts**

Alerts are scoped to:
- Canonical products
- User-defined conditions
- User subscription tier

---

### Dealer Notifications

Dealer-facing notifications are operational, not marketing.

Examples:
- Feed failures
- Quarantine events
- Subscription state changes
- Visibility changes

Dealer notifications must not:
- Compare dealers competitively
- Imply performance outcomes
- Recommend pricing actions

---

## Alert Lifecycle

### Creation

- Alerts are created by authenticated users
- Alert configuration is validated server-side
- Invalid or ambiguous alert conditions must be rejected

**Invariant**
- Alert conditions must be evaluable using stored data.
- Alerts must not rely on speculative inference.

---

### Evaluation

Alerts are evaluated when:
- New price data is ingested
- Availability state changes
- Relevant dealer eligibility changes

Evaluation may occur:
- Synchronously (limited cases)
- Asynchronously via background jobs

**Tier shaping applies at evaluation time**, not just at delivery.

---

### Triggering

When an alert condition is met:
- An alert event is created
- Delivery is scheduled according to user preferences and tier

Triggering must:
- Be idempotent
- Avoid duplicate notifications for the same condition
- Respect cooldowns and rate limits

---

### Delivery

Supported delivery mechanisms (v1):
- Email
- In-app notifications (where implemented)

Delivery must:
- Respect user preferences
- Respect subscription tier limits
- Fail gracefully if delivery fails

---

## Tier-Based Alert Behavior

### Free Users

- Limited number of active alerts
- Slower evaluation cadence
- Basic alert language
- Fewer delivery options

---

### Premium Users

- Higher alert limits
- Faster evaluation cadence
- More flexible conditions
- Optional AI-assisted explanations (where data quality allows)

**Important**
Premium improves speed and flexibility, not certainty.

---

## Language and Presentation Rules

Alerts must:
- Describe *what changed*
- Avoid telling users *what to do*
- Avoid urgency framing (“buy now”, “last chance”)

Acceptable language:
- “The price changed from X to Y.”
- “This item is back in stock.”
- “This price is lower than recent levels.”

Unacceptable language:
- “This is the best time to buy.”
- “You should act now.”
- “Guaranteed savings.”

Language is part of the trust boundary.

---

## Dealer Eligibility and Alert Safety

### Required Enforcement

- Alerts must not trigger on inventory from ineligible dealers
- Dealer eligibility must be checked at evaluation time
- Historical alerts must not retroactively expose ineligible data

**Critical invariant**
If a dealer is blocked or suspended:
- Their inventory must not trigger alerts
- Their offers must not appear in alert payloads

---

## AI-Assisted Alert Explanations

### Purpose

AI-assisted explanations may:
- Provide context about why an alert triggered
- Reference historical price behavior
- Explain grouping or evaluation logic at a high level

### Constraints

AI explanations:
- Must be optional
- Must be tier-gated
- Must degrade or be removed when data quality is low
- Must never present advice or certainty

If explanation safety cannot be guaranteed, explanations must be disabled.

---

## Observability and Debugging

### Required Capabilities

Operators must be able to:
- Inspect why an alert triggered
- See evaluation inputs and outputs
- Identify duplicate or missed triggers
- Replay evaluation safely for debugging

Alert evaluation must be reproducible from stored data.

---

## Failure Modes

### Acceptable Failures

- Delayed alerts
- Missed non-critical alerts during outages

### Unacceptable Failures

- Alerts triggered from ineligible inventory
- Alerts implying advice or certainty
- Duplicate alert spam
- Alerts leaking cross-account data

If failures occur, default to **not notifying** rather than notifying incorrectly.

---

## Known Inconsistencies and Required Decisions

1. **Evaluation ownership**
   - Decision: confirm whether alert evaluation lives in API, harvester, or both.
   - Ensure there is a single authoritative evaluation path.

2. **Deduplication strategy**
   - Decision: define deterministic keys for alert triggers to prevent duplicates.

3. **AI explanation gating**
   - Decision: explicitly gate explanations by tier *and* data sufficiency.

4. **Delivery guarantees**
   - Decision: document that delivery is best-effort, not guaranteed.

---

## Non-Negotiables

- Alerts must be accurate or silent
- Eligibility enforcement must apply at evaluation time
- Language must remain conservative
- Tier shaping must occur before delivery

---

## Guiding Principle

> An alert should inform, not persuade.
