# ADR-011: Unified Saved Items (Collapse Watchlist + Alerts)

## Status
Accepted

## Context

IronScout currently exposes two overlapping concepts to users:
- **Watchlist**: passive tracking, see price changes, target price
- **Alerts**: active notifications when conditions are met

This creates confusion because users think in terms of:
- "I care about this item"
- "Tell me when something changes"

These are the same mental model. Exposing implementation concepts (watchlist vs alerts) instead of user intent is a common failure mode in price-tracking products.

## Decision

Collapse Watchlist and Alerts into a single user-facing concept: **Saved Items**.

### User-Facing Model

One thing. One action.

- **Button**: "Save" / "Track"
- **State**: Saved
- **Implication**: interest + tracking + notifications (by default)

No separate mental buckets.

### Implementation Approach

**Option A (chosen)**: Keep both tables, merge at API and UX layer.

- `WatchlistItem` and `Alert` tables remain
- API returns unified `SavedItem` DTO
- Single "Save" action creates both entries with default rules
- Prove the concept before considering physical table merge

**Option B (deferred)**: Single `SavedItem` table. Only pursue when:
- Need advanced rule types per item, per channel
- Significant query cost from joining two systems
- Real maintenance tax from dual tables

### Default Notification Rules

Applied automatically when user saves an item:

1. **Price drop**: Notify when price drops:
   - Below saved baseline price, AND
   - By at least 5% or $5 (whichever is greater)
   - Prevents noisy penny-drop alerts

2. **Back in stock**: Notify when item transitions from OOS to in-stock.
   - Always enabled, regardless of stock status at save time
   - Users expect stock tracking even if currently in stock
   - Throttle: max 1 stock alert per item per 24 hours

### Per-Item Notification Toggle

Some users want a list without notifications.

- Toggle: "Notifications: On | Off" per saved item
- Default: On
- Prevents "I saved it and now it nags me" churn

## Implementation Phases

### Phase 1: Establish New Contract

**Goal**: Users see one concept. Fix immediate issues.

1. Fix 404 on `/dashboard/watchlist`
2. Rename `/dashboard/alerts` → `/dashboard/saved`
3. Add single product CTA: "Save"
4. Create `SavedItem` API DTO that UI uses everywhere
5. Stop exposing "Watchlist" vs "Alerts" in UI
6. Update header nav: "My Alerts" → "Saved Items"

**Deliverable**: Unified UX, existing tables unchanged.

### Phase 2: Real Merge Behavior

**Goal**: Single save action with default rules.

1. Implement unified Save action:
   - Creates `WatchlistItem` if missing
   - Creates default `Alert` rules if missing
2. Add "Manage notifications" drawer on saved items
3. Add per-item notifications toggle
4. Backfill: for existing watchlist-only items, create default alerts lazily on first view or via one-time job

### Phase 3: Physical Merge (Optional)

Only if needed:
- Migrate to single `SavedItem` table
- Drop `WatchlistItem` and `Alert` tables
- Requires data migration

## Consequences

### Positive
- Single mental model for users
- Fewer decisions at save time
- No "did I save it or alert it?" confusion
- Scales naturally when adding alert types
- Matches best-in-class products (CamelCamelCamel, PCPartPicker, Zillow)

### Negative
- Dual tables remain (acceptable for now)
- Backfill needed for existing data
- UI refactoring across multiple components

## Notes

This ADR affects:
- `/dashboard/alerts` → `/dashboard/saved`
- `WatchlistPreview` component
- Header navigation
- Product cards (save button)
- Mobile navigation

Does NOT affect:
- Harvester alert engine (internal implementation)
- Email notification system
- Database schema (Phase 1-2)
