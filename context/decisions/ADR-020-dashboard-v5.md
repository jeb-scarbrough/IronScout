# ADR-020 — Dashboard v5: Status-Oriented Monitoring Surface

**Status:** Approved  
**Supersedes:** ADR-012

---

## Context

Earlier dashboard iterations positioned the dashboard as an action-oriented or deal-driven surface. This caused recommendation drift, urgency bias, cognitive overload, and direct tension with **ADR-006 (No Purchase Recommendations or Verdicts)**.

Ammo buyers fall into distinct behavior patterns:

- **Casual / Need-based buyers**: anonymous, transactional, use Search only.
- **Opportunists**: want synthesized awareness of market changes, not advice.
- **Stockpilers / Planners / Power users**: want calm, longitudinal monitoring.

Attempting to serve all three via a single dashboard surface proved ineffective.

---

## Decision

The Dashboard is defined as a **Status-Oriented Monitoring Surface**, explicitly **account-bound** and **longitudinal**.

It answers:

> “What is the current state of what I’m tracking, and what has changed recently?”

It does **not**:
- recommend purchases
- surface deals or verdicts
- drive transactions
- replace Search or Market Context

---

## Surface Delineation (Normative)

| Surface | Auth | Primary Users | Purpose |
|------|------|---------------|--------|
| **Search** | Public | Casual, Need-based, Opportunist | Discover and compare ammo |
| **Market Context** | Public | Casual, Opportunist | Understand market conditions |
| **Dashboard** | Account-bound | Stockpiler, Planner, Power user | Monitor saved items over time |

These boundaries are intentional and enforced.

---

## Market Context (Clarification)

Market Context is a **public, unauthenticated surface** that provides factual, non-prescriptive views of the ammo market.

It may include:
- Largest observed price movements
- Caliber-level volatility
- Back-in-stock trends

It must never:
- recommend purchases
- rank “best” products
- use deal or verdict language

Market Context is **not** part of the Dashboard.

---

## Canonical Dashboard Sections (v5)

The Dashboard may render up to **five sections**, all conditional except Watchlist:

1. Spotlight (single synthesized factual signal)
2. Your Watchlist
3. Recent Price Movement
4. Back in Stock
5. Matches Your Gun Locker

No additional sections without a new ADR.

---

## Spotlight (Synthesis Without Recommendation)

**Purpose:** Provide synthesis for opportunists without judgment.

Spotlight surfaces **one factual signal**, selected via internal heuristics.

### Selection Rules
- Event occurred within the last **7 days**
- Preference order: Watchlist → Gun Locker → Other relevant context
- ACTIVE signals preferred over STALE

### Presentation Rules
- Spotlight must not communicate ranking or priority.
- Copy must be observational or temporal.

**Allowed bases**
- Notable price movement observed recently
- Item recently back in stock
- Price at a lowest observed point within a defined window

**Disallowed**
- “Best”, “Deal”, “Worth buying”, urgency framing

Spotlight renders **only if a qualifying signal exists**.

---

## Signal Lifecycle

Signals (not users) have lifecycle states:

- **ACTIVE:** < 24 hours since `eventAt`
- **STALE:** 1–7 days since `eventAt`
- **CLEARED:** > 7 days or condition no longer holds

Lifecycle governs:
- badge visibility
- section inclusion
- visual emphasis

Notification delivery resets the signal to **ACTIVE** for that user.

---

## Language Guardrails

**Banned:** deal, best, worth it, cheapest delivered, buy now, must-have  
**Allowed:** price movement, lowest observed, back in stock, observed

Any change requires ADR amendment.

---

## Consequences

**Benefits**
- Trust-preserving
- Clear intent separation
- Scales with market volatility

**Tradeoffs**
- Less overt urgency
- Requires strong Search and Market Context surfaces
