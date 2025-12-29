# ADR-012: Dashboard v3 – Action-Oriented Deal Surface Integrated with Search and Saved Searches

**Status:** Proposed
**Date:** 2025-12-29
**Owners:** Product, UX, Engineering
**Related ADRs:** ADR-006, ADR-011, ADR-013 (Homepage Guardrails), ADR-014 (Search Guardrails)
**Related Docs:** [UX Charter](../06_ux_charter.md)

---

## Context

The existing dashboard presents duplicated data from Search and Saved Items, resulting in high cognitive load and low conversion. Users are not sophisticated business analysts; they are outdoor consumers seeking confidence and speed when purchasing ammunition and related products.

Search already serves discovery. The dashboard must instead support fast decision-making and drive retailer clicks without introducing subjective scoring, misleading claims, or analytical overhead.

Saved Items and Saved Searches exist but are under-leveraged and overly visible in places where they create friction rather than value.

---

## Decision

We will implement **Dashboard v3**, a simplified, action-oriented dashboard that:

1. Surfaces **at most one high-confidence deal recommendation** at a time.
2. Treats the absence of a recommendation as a valid and expected state.
3. Promotes **Saved Items** as the primary repeat-engagement and conversion surface.
4. Integrates **Saved Searches silently** as signal inputs rather than explicit UI objects.
5. Uses **plain, descriptive language** and allows intentional empty states.
6. Avoids scores, rankings, verdicts, charts, or claims of optimality.

The dashboard functions as an **action surface**, not a discovery or analytics surface.

---

## Design Principles

- One clear recommendation is better than many weak ones.
- Silence is preferable to low-confidence signals.
- Confidence beats cleverness.
- Empty states are preferable to filler.
- Saved searches should feel automatic, not configured.
- Every visible element must justify a click.

---

## Dashboard Language and UX Guardrails

This section defines **hard constraints** for all current and future Dashboard UI, copy, and features.  
All specifications that follow must comply with these guardrails.

The Dashboard is the system’s **point of judgment**, not explanation.

---

### Canonical Role of the Dashboard

The Dashboard exists to answer one question:

> **“Is there something worth buying right now?”**

If a dashboard element does not help answer this question, it does not belong.

---

### Language Guardrails

#### Allowed Language

Dashboard copy may use:
- “Good deal right now”
- “Nothing urgent right now”
- “Nothing changed yet”
- “Lower than usual”
- “Seen this low recently”
- “Price is going down / about the same / going up”
- “Something you’re watching changed”
- “Based on what you’ve been looking for”
- **“We’re out scouting prices and availability”**

All language must be:
- Plain
- Calm
- Defensible by observable data

---

#### Restricted Language

The Dashboard **must not**:
- Mention “AI”, “machine learning”, or “models”
- Claim “best”, “optimal”, or “guaranteed” outcomes
- Use verdicts such as BUY, WAIT, or SKIP
- Display scores, grades, rankings, or leaderboards
- Explain system internals or methodology
- Require interpretation or comparison by the user

If copy needs explanation, it is not dashboard copy.

---

### UI Guardrails

The Dashboard **must not**:
- Show more than one primary recommendation at a time
- Surface multiple competing calls to action
- Display charts, graphs, or historical timelines
- List saved searches or configuration controls
- Duplicate search result grids or filters
- Fill empty space with generic or popular content

The Dashboard **may**:
- Be partially empty
- Change daily
- Show nothing when no confident signal exists

Empty states are preferred over weak recommendations.

---

### Source-of-Truth Guardrail

Every dashboard element must be traceable to **at least one** of:
- A Saved Item
- A Saved Search
- A recent user Search

If the system cannot explain “why this is here” in one sentence, the element must be removed.

---

### Relationship to Intelligence and Automation

Intelligence is implicit.

The Dashboard shows outcomes, not reasoning.

The system may:
- Watch prices
- Detect change
- Surface moments

The Dashboard must never claim *how* those detections were made.

---

## Saved Searches Guardrails (Dashboard-Scoped)

These guardrails apply **only to how Saved Searches are surfaced or consumed by the Dashboard**.  
Creation and management remain governed by Search behavior.

Saved Searches exist to **capture intent**, not to expose configuration.

They are an internal system primitive, not a primary UI feature.

---

### Canonical Role

Saved Searches answer one question:

> **“What should the system keep an eye on for this user?”**

They do not exist to:
- Teach users how the system works
- Require tuning or management
- Surface analytical insight directly

---

### UX Guardrails

Saved Searches **must not**:
- Appear as a list on the Dashboard
- Expose query syntax or filters
- Require users to set thresholds
- Introduce advanced configuration by default
- Be framed as a power-user feature

Saved Searches **may**:
- Be created implicitly through repeated searches
- Be created explicitly via “Turn on alerts”
- Drive dashboard hero selection or nudges
- Be managed only in Search or Settings

---

### Language Guardrails

Primary UI **must not** use the term “Saved Search”.

Use outcome-based language only:
- “We’ll keep an eye on this”
- “Something you’re watching changed”
- “You’re watching this”

The term “Saved Search” may exist only:
- In internal documentation
- In developer-facing code
- In advanced settings, if ever introduced

---

### Relationship to Automation

Saved Searches:
- Trigger tracking
- Feed alerting
- Influence surfaced deals

They must not:
- Explain automation logic
- Claim intelligence or prediction
- Compete with the Dashboard for attention

---

## Specification

### 1. Hero Section: “Good Deal Right Now”

**Description**  
A single, optional hero recommendation shown only when eligibility criteria are met.

**Eligibility**
- Item must be in stock.
- Price must be meaningfully lower than a defined baseline (e.g., 7-day or 30-day median).
- Baseline logic must be deterministic and auditable.

**Display**
- Item name  
- Price per unit  
- Retailer name  
- Optional single context line:
  - “Lower than most prices this week”
  - “Seen this low only a few times recently”
  - “Matches something you’re watching”
  - “Based on what you’ve been looking for”

**CTA**
- `View at <Retailer>`

**Constraints**
- Never show more than one hero.
- Never use “best”, “guaranteed”, or equivalent language.
- If no item qualifies, the hero does not render.

---

### 2. No-Hero State (Intentional Default)

The absence of a Hero recommendation is the **expected default state**.

“No hero” indicates that:
- Prices are within typical ranges, or
- No confident signal meets eligibility thresholds.

This state must feel intentional and reassuring, not empty or broken.

---

#### No-Hero Copy (Locked)

When no Hero is shown, display a low-emphasis status message above Saved Items.

**Default**
> **Nothing urgent right now**  
> We’re out scouting prices and availability. We’ll surface deals when something stands out.

**If the user has Saved Items**
> **Nothing changed yet**  
> We’re out scouting prices and availability on the items you’re watching.

**If a minor change occurred since last visit**
> **Minor changes detected**  
> Prices moved slightly, but nothing worth acting on yet.

Only one message may be shown at a time.

---

#### No-Hero UI Rules

In a no-hero state, the Dashboard must not:
- Show filler recommendations
- Promote popular or trending items
- Encourage random browsing
- Escalate urgency or upsell Premium
- Introduce educational or analytical content

The Dashboard must transition directly into the Saved Items section.

---

#### Rationale

Silence is a feature.

By surfacing deals only when confidence exists, the Dashboard trains users to trust that:
- Quiet days mean nothing worth rushing
- Shown deals are meaningful

This restraint is a deliberate product choice.

---

### 3. Saved Items Section (“Stuff You’re Watching”)

**Source**
- WatchlistItem records.

**Display per item**
- Item name  
- Best current price and retailer  
- Directional status text only:
  - “Price is going down”
  - “About the same”
  - “Price is going up”
- CTA: `View at <Retailer>`

**Constraints**
- No charts.
- No percentages.
- No historical timelines.
- Directional language only.

Saved Items are the primary dashboard list and main repeat-visit driver.

---

### 4. Saved Searches Integration (Non-Surface)

Saved Searches do **not** appear as a list or section on the dashboard.

They are used exclusively as **signal inputs**.

---

### 5. Search Relationship

- Search remains the primary discovery tool.
- Dashboard links land on filtered search results.
- Saved searches are created and managed via Search, not the dashboard.
- Dashboard never exposes search configuration or query syntax.

---

### 6. Premium Integration

A single, soft prompt at the bottom of the dashboard:

> Want alerts when prices drop?  
> Save items and get notified.

CTA:
- `Try Premium`

**Constraints**
- No locked data shown.
- No blurred UI.
- Premium framed as automation and speed, not exclusive truth.

---

## ADR Compliance

- **ADR-006:** No subjective scoring or verdicts introduced.
- **ADR-011:** Saved Items remain the source of alerts and tracking.
- No promises of optimality or “best price” guarantees.
- Retailer neutrality preserved.

---

## Consequences

### Positive
- Lower cognitive load.
- Faster time to first click.
- Higher trust and conversion.
- Clear separation of concerns between Search and Dashboard.

### Tradeoffs
- Reduced surface area for exploratory browsing.
- Less visible “intelligence” compared to dense dashboards.
- Requires strong discipline around eligibility thresholds.

---

---

## Notifications vs Dashboard Policy (v1)

The Dashboard and Notifications serve distinct roles and must not overlap in purpose.

### Canonical Roles

- **Dashboard:** Passive awareness. A place to check what, if anything, is worth acting on.
- **Notifications:** Interruptions. Used only when immediate attention provides clear user value.

Silence on the Dashboard is expected and intentional.  
Notifications are rare by design.

---

### Notification Eligibility (v1)

For v1, notifications are limited to **explicitly Saved Items only**.

Saved Searches influence Dashboard visibility but **do not trigger notifications** in v1.

This constraint is intentional and designed to:
- Minimize alert fatigue
- Preserve trust in interruptions
- Ensure signal quality before expanding scope

---

### Interruption-Worthy Events

Notifications may be sent only for the following event classes:

1. **Meaningful price drops** on a Saved Item  
2. **Back in stock** events for a Saved Item

All other changes, including:
- Minor price movement
- Typical price fluctuations
- Category-level trends
- Saved Search matches

Must remain Dashboard-only signals.

---

### Dashboard Redundancy Rule

If a notification is sent, the related change may also appear on the Dashboard as context.

However, the Dashboard must not:
- Escalate urgency
- Repeat alert-style copy
- Compete with notifications for attention

The notification is the interruption.  
The Dashboard is the confirmation.

---

### Premium Boundary

Premium unlocks:
- Automation
- Speed of detection
- Fewer missed moments

Premium does **not** unlock:
- Additional urgency
- Higher alert volume
- Lower signal thresholds

Alert caps, cooldowns, and thresholds must remain conservative by default.

---

### Future Expansion

Expansion to Saved Search–driven notifications (Model 2) requires:
- Proven signal accuracy
- Documented thresholds
- A new ADR amendment

Until then, v1 operates under this policy.

---

## Enforcement

Product owns adherence to this ADR.
Engineering must block merges that violate it.

Any new Dashboard feature, copy change, or UI addition must be reviewed against:
- This ADR
- ADR-013 (Homepage Positioning Guardrails)
- ADR-014 (Search Positioning Guardrails)
- [UX Charter](../06_ux_charter.md)

Conflicting changes must be rejected or escalated via ADR amendment.

---

**Decision Outcome:**  
Proceed with Dashboard v3 implementation under this ADR. Iterate via amendments as thresholds and data confidence mature.
