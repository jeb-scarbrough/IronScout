# Firearm → Preferred Ammo Mapping Spec (v3)

## Status
**Build-ready.**
This version locks the use-case–based model and supersedes all prior drafts.

---

## Decision Lock: Use-Case Model (Authoritative)

This feature **uses a use-case enum**, not preference tiers.

The enum is:
- `use_case = TRAINING | CARRY | COMPETITION | GENERAL`

The following concepts are explicitly **not used and are forbidden**:
- `preference_tier`
- `PRIMARY / ACCEPTABLE / OPPORTUNISTIC`
- Any ranked or default “best” ammo semantics

Rationale:
- Shooters think in **use cases**, not ranked preferences.
- Use cases are descriptive, not evaluative.
- This avoids recommendation drift, priority ambiguity, and default-selection logic.

This decision is final. Any reintroduction of tiered preference requires a new ADR.

---

## Summary
Users can explicitly associate one or more ammo SKUs with a specific firearm in their Gun Locker. This mapping represents **user-declared usage context** (e.g., “what I train with” or “what I carry”), not system judgment.

IronScout must never infer, rank, or recommend ammo for a firearm.

---

## Job This Feature Serves (Product Definition)

**When I already know what ammo I typically use for a firearm, help me quickly recognize, compare, and re-purchase that ammo — without telling me what I should buy.**

This feature exists to support recall and reordering, not discovery or advice.

---

## Surface Boundaries

| Surface        | Purpose                                      |
|----------------|----------------------------------------------|
| Search         | Discovery, exploration, market comparison    |
| Gun Locker     | Inventory of owned firearms                  |
| Ammo Mapping   | Recall + re-purchase context                 |
| My Loadout     | Aggregated status of tracked items           |
| Market Context | Market awareness without personalization     |

This feature does not replace Search and does not surface deals.

---

## Non-Goals (Product-Level)

- No recommendations or “best ammo” claims
- No inferred preferences
- No auto-population
- No suitability, ballistic, or safety guidance
- No conversion optimization

---

## Definitions

### Firearm
A user-managed firearm entity in Gun Locker.

### Ammo SKU
A normalized ammo product identifier used across retailers.

### Use Case (User-Declared)
A label describing how the user typically uses a given ammo SKU with a firearm:
- TRAINING
- CARRY
- COMPETITION
- GENERAL

Use cases are descriptive only and imply no hierarchy.

---

## Data Model

### FirearmAmmoPreference
Represents a mapping between a firearm and an ammo SKU for a declared use case.

Fields:
- id (uuid)
- user_id (uuid)
- firearm_id (uuid)
- ammo_sku_id (uuid)
- use_case (TRAINING | CARRY | COMPETITION | GENERAL)
- created_at
- updated_at
- deleted_at (nullable)
- delete_reason (USER_REMOVED | FIREARM_DELETED | SKU_SUPERSEDED | ADMIN_CLEANUP)

Constraints:
- UNIQUE (user_id, firearm_id, ammo_sku_id, use_case) WHERE deleted_at IS NULL

Recommended indexes:
- (user_id, firearm_id, deleted_at)
- (user_id, ammo_sku_id, deleted_at)
- (user_id, use_case, deleted_at)

---

## Lifecycle & FK Deletion Semantics

Mappings are soft-deleted.

- ACTIVE: deleted_at IS NULL
- DELETED: deleted_at IS NOT NULL

User deletion:
- Cascade soft-delete all mappings.

Firearm deletion:
- Cascade soft-delete all mappings with delete_reason = FIREARM_DELETED.

Ammo SKU deletion:
- Ammo SKUs must not be hard-deleted.
- Deprecated SKUs rely on supersession.

---

## Ammo SKU Supersession

Ammo SKUs must support aliasing to preserve user intent.

Fields:
- is_active
- superseded_by_ammo_sku_id
- superseded_at

Rules:
- Deprecated SKUs resolve to canonical SKU at read time.
- If both deprecated and canonical SKUs are mapped:
  - Render canonical only.
  - Soft-delete deprecated mapping with delete_reason = SKU_SUPERSEDED.

---

## Gun Locker UI (Firearm Detail)

### Preferred Ammo
Grouped by use case, displayed in fixed order:
1. CARRY
2. TRAINING
3. COMPETITION
4. GENERAL

Each row:
- Ammo name
- Caliber / grain / type
- Price range ($X–$Y / rd)
- Retailer count
- Action: Compare prices
- Overflow: Change use case / Remove

Empty state:
“Add ammo you typically use with this firearm to speed up reorders.”

CTA:
Add ammo → Firearm-scoped Search.

---

## Creating & Editing Mappings

Primary entry:
- Search / retailer panel
- “Add to firearm…” → select firearm → select use case

Secondary entry:
- Gun Locker inline edit

Partial setup is expected and valuable.

---

## Firearm-Scoped Search

- Apply caliber compatibility filter.
- Show banner: “Adding ammo for {Firearm}”.
- Fail-closed on ambiguous caliber mapping.

Ambiguity triggers:
- Unknown or multi-caliber firearm
- Unknown or multi-caliber ammo
- Firearm caliber ≠ ammo caliber

Blocked attempts must emit:
`firearm_ammo_preference.blocked`

---

## My Loadout Integration

Context labels:
- “Training ammo for Glock 19”
- “Carry ammo for Glock 19 + 1 more”

Ordering:
- Most recently updated mapping first
- Tie-breaker: ammo_sku_id ASC

---

## Retailer Comparison Panel

- Primary action: Compare prices
- Context line if applicable
- Out of stock:
  - Message
  - Action: Search {caliber} ammo

---

## Query & Cache Rules

- Prefer query-time joins.
- If denormalized:
  - Emit firearm_ammo_preference.updated events
  - Invalidate derived views

Stale context is a correctness bug.

---

## Policy & Trust Guardrails

Prohibited:
- Recommendation language
- Inference
- Suitability claims

Allowed:
- Compatibility context
- Price ranges
- Availability status

---

## Analytics (Guarded)

For adoption and reliability only:
- Mapping creation rate
- % firearms with mappings
- Orphaned mappings

No conversion optimization permitted.

---

## Acceptance Criteria

- Use-case enum is the only supported model.
- Ammo can be mapped in ≤2 focused user decisions.
- Gun Locker groups ammo by use case.
- My Loadout explains “why” neutrally.
- Lifecycle and supersession edge cases fail safely.
