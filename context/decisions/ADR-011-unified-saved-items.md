# ADR-011: Unified Saved Items (Collapse Watchlist + Alerts)

## Status
Accepted

## Context
(unchanged)

## Decision
(unchanged)

## Implementation Phases
(unchanged)

---

## Amendments and Architectural Clarifications

### ADR-011A — Intent-Ready Saved Items (WatchlistItem Resolver Seam)

This ADR is amended by **ADR-011A-Intent-Ready-Saved-Items.md**, which defines
internal architecture and schema requirements while preserving all user-facing
behavior specified here.

Key clarifications introduced by ADR-011A:

- **Internal model:** `WatchlistItem` remains the canonical DB/domain entity.
- **SKU idempotency:** Active SKU saved items are unique per user and enforced
  via a partial unique index excluding soft-deleted rows.
- **Soft delete semantics:** Soft-deleted saved items MUST NOT fire alerts.
- **Resolver seam:** Downstream flows (dashboard, alerter, API) must not rely on
  direct `productId` access; product resolution must go through the resolver to
  preserve future SEARCH support.
- **SEARCH intent gating:** SEARCH intent is explicitly disabled in v1 and Phase 2.
  Schema support exists for future work only.

### Phase 2 Addendum (Intent-Ready Alignment)

Phase 2 remains **SKU-only**. Creation of SEARCH intent Saved Items is explicitly disabled until a future ADR ships:
- SEARCH uniqueness policy (e.g. `query_snapshot_hash`)
- Null-tolerant DTO and UI handling for "product unavailable" rows

**Unsave semantics:** Unsave is a **soft delete**:
- Set `WatchlistItem.deleted_at = now`
- Linked Alerts remain in DB but MUST NOT fire while `deleted_at IS NOT NULL`
- Alert evaluation MUST join through WatchlistItem with `deleted_at IS NULL`

**Resave semantics:** Re-saving a previously deleted SKU item **resurrects** the existing WatchlistItem:
- Clear `deleted_at`
- Preserve notification preferences and collection membership
- Existing alerts become active again (no re-creation required)

**Resolver seam:** Downstream flows must not rely on direct `productId` access; use the resolver for product resolution to preserve future SEARCH support and prevent N+1 regressions.

See ADR-011A for authoritative schema and migration details.

---

### SavedItemDTO Contract Note

> **Note:** SavedItemDTO assumes SKU-backed items in Phase 2 because SEARCH intent is gated. Before SEARCH ships, a new ADR must either make `productId` nullable and harden all clients, or introduce a SEARCH-specific DTO. No implicit behavior change is allowed.
