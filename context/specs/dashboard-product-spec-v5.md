# dashboard-product-spec-v5.md

## Purpose

Defines the authoritative structure and behavior of **Dashboard v5**, an account-bound monitoring surface.

---

## Audience

### Intended
- Users with saved items or calibers
- Longitudinal monitoring behavior

### Non-Audience
- Casual or anonymous users
- Immediate-need buyers

These users are served by **Search** and **Market Context**, not the Dashboard.

---

## Core Question

> “What is the current state of what I care about, and what changed recently?”

---

## Global Rules

- Dashboard provides **context, not advice**
- No recommendations, verdicts, rankings, or deal framing
- Actions are informational only:
  - View price history
  - View details
  - See retailers

---

## Sections

### 1. Spotlight (Conditional)

- Renders only if a qualifying signal exists within last 7 days
- Single item only

**Copy**
- Title: Spotlight
- Subtitle: Notable price movement observed recently

**Primary Action**
- View price history

Secondary link:
- See market context →

---

### 2. Your Watchlist (Always)

Header:
Your Watchlist  
Prices we’re monitoring for you

Row:
- Product name
- Attributes
- Current price / round
- Optional factual status line

Allowed status:
- Lowest price observed in last 90 days
- Price moved since last check
- Back in stock

Disallowed:
- Badges
- “No change” text

**Limits**
- Max 10 items
- Sorted by most recent change

Footer (if <5 items):
Add more items to catch more price changes.  
[Search to add items]

CTA:
- View all watchlist →

---

### 3. Recent Price Movement (Conditional)

Header:
Recent Price Movement  
Notable price changes observed recently

Sources:
- Watchlist items
- Gun Locker matches (if configured)

Row:
- Optional badge (ACTIVE / STALE only)
- One-line factual explanation
- Product + retailer
- Price / round
- Action: View price history

**Gun Locker-sourced rows must include:**
“Matches [caliber] in your gun locker”

**Limits**
- Max 5 items
- Sort order:
  1. ACTIVE before STALE
  2. Most recent eventAt
  3. Largest % change (tie-break)

---

### 4. Back in Stock (Conditional)

Header:
Back in Stock  
Items that recently became available again

Limits:
- Max 5 items
- Sort by most recent restock

---

### 5. Matches Your Gun Locker (Conditional)

Rendered only if calibers saved.

Header:
Matches Your Gun Locker  
Matches calibers you’ve saved

Row:
- Product
- Context explanation
- Price / round
- Action: View details

No badges. No urgency.

Limits:
- Max 5 items

---

## Cold-Start Behavior

If no watchlist and no saved calibers, render a single onboarding module:

You haven’t started tracking yet.  
Search ammo and save items to monitor price and availability over time.

[Search ammo]  [How tracking works]

Do not render empty sections.

---

## Section Limits Summary

| Section | Max |
|------|-----|
| Spotlight | 1 |
| Watchlist | 10 |
| Price Movement | 5 |
| Back in Stock | 5 |
| Gun Locker | 5 |

---

## Non-Goals

- No deal feeds
- No purchase recommendations
- No transactional CTAs
- No dashboard-as-homepage

---

## Final Invariant

Every row must answer at least one:

1. State of something the user saved
2. What changed recently (with evidence)
3. Why this is relevant to saved context
