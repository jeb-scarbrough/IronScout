# ADR-016: Foreign Key Deletion Behaviors

## Status
Accepted

## Context

IronScout has several foreign key relationships where the deletion behavior impacts data integrity, operational workflows, and historical preservation. Key relationships include:

1. **sources.retailerId** → retailers: Sources must belong to a retailer
2. **prices.merchantId/sourceId** → merchants/sources: Price history references
3. **pricing_snapshots.retailerId/sourceId** → retailers/sources: Snapshot history references
4. **retailers.merchantId** → merchants: Legacy field, now deprecated

The question is: when a parent entity is deleted, what should happen to child records?

Options for each FK:
- **Cascade**: Delete child records when parent is deleted
- **SetNull**: Nullify the FK, preserving the child record
- **Restrict**: Prevent parent deletion if children exist

## Decision

### 1. sources.retailerId: Restrict (Required + Default Restrict)

**Rationale**: A source MUST belong to a retailer (it's an ingestion configuration for that retailer). Deleting a retailer is a significant administrative action. Sources contain ingestion configurations, URLs, and operational state. Silently orphaning or deleting sources could cause:
- Lost configuration
- Unclear feed status
- Ingestion failures

**Workflow**: Retailer deletion requires explicit admin workflow:
1. Reassign sources to another retailer, OR
2. Delete sources explicitly
3. Then delete the retailer

Note: `sources.retailerId` is **required** (NOT NULL). Sources cannot exist without a retailer.

Documented in: `context/operations/04_guides.md` → "Guide: Deleting a Retailer Safely"

### 2. prices.retailerId: Cascade (Required + Cascade)

**Rationale**: Price records require a retailer to maintain referential integrity. Using Cascade means deleting a retailer also deletes its price history. This prevents orphaned price records and maintains data consistency.

**Important**: Because this deletes price history, **retailer deletion should be forbidden in practice**. Instead:
- Mark retailers as `visibilityStatus = INELIGIBLE` or `SUSPENDED`
- Keep the retailer record but hide from consumers
- Only delete retailers in extreme edge cases (e.g., test data cleanup)

### 3. prices.merchantId, prices.sourceId: SetNull

**Rationale**: Merchants and sources can be deleted without losing price history. Setting these FKs to NULL preserves the price record while indicating the original entity no longer exists.

### 4. pricing_snapshots.retailerId, pricing_snapshots.sourceId: SetNull

**Rationale**: Same as prices.merchantId/sourceId—snapshots are historical records that should be preserved. retailerId is **optional** here to allow SetNull.

### 5. retailers.merchantId: REMOVED

**History**: This legacy field was deprecated in favor of the `merchant_retailers` join table and has been removed from the schema.

**Migration**: `20260102_remove_retailers_merchantid` drops the column and its index.

**Current State**: Use `merchant_retailers` exclusively for retailer↔merchant relationships.

## Alternatives Considered

### Cascade for sources.retailerId
- **Rejected**: Too dangerous. Deleting a retailer would silently remove all source configurations, potentially breaking ingestion without warning.

### SetNull for prices.retailerId
- **Rejected**: Would create orphaned price records with NULL retailerId, making analysis difficult. Required FK + Cascade maintains referential integrity. The operational solution is to forbid retailer deletes in practice.

### Restrict for prices/pricing_snapshots
- **Rejected for merchantId/sourceId**: Would prevent deleting merchants/sources that have historical price data. Since these are long-lived entities with years of price history, this would effectively make them undeletable.

## Consequences

### Technical
- `sources.retailerId`: Required + RESTRICT (Postgres default)
- `prices.retailerId`: Required + CASCADE
- `prices.merchantId/sourceId`, `pricing_snapshots.*`: Optional + SET NULL
- Schema comments document behavior

### Operational
- Retailer deletion requires explicit admin workflow (sources must be reassigned/deleted first)
- **Retailer deletion should be avoided** because it cascades to price history
- Prefer soft-delete via `visibilityStatus = INELIGIBLE/SUSPENDED` for retailers
- Merchant/source deletion is safe and preserves price history (FKs set to NULL)

### Product
- Price history is preserved when merchants/sources are deleted
- Referential integrity is maintained (no orphaned prices without retailer)
- Clear audit trail for deleted entities via NULL FKs on optional relations

## Notes

- The `merchant_retailers` join table uses Cascade for both FKs, which is correct for a pure join table with no independent data.
- Future: Consider adding a `deletedAt` timestamp to soft-delete entities instead of hard delete, preserving full referential integrity.

### pricing_snapshots Alignment Constraint

`pricing_snapshots` has both `retailerId` (optional) and `merchantId` (required). When `retailerId` IS set, the pair `(retailerId, merchantId)` should be valid per `merchant_retailers` (v1 constraint: one retailer → one merchant).

**Current State**:
- Composite index `pricing_snapshots_retailer_merchant_idx` exists for efficient validation queries
- Current write path (`benchmark.ts`) does NOT set `retailerId` (it's NULL for merchant-sourced snapshots)
- No DB-level constraint enforces alignment (would require complex CHECK constraint with function)

**Enforcement Approach**:
- Application-level validation when both fields are provided
- Periodic validation query for data integrity monitoring (admin Settings → Data Integrity)
- Documented in: `context/operations/04_guides.md` → "Guide: Validating pricing_snapshots Retailer↔Merchant Alignment"

**Validation Helper** (`@ironscout/db`):
```typescript
import { assertPricingSnapshotValid, validatePricingSnapshotAlignment } from '@ironscout/db'

// Option 1: Assert (throws on invalid)
await assertPricingSnapshotValid({ retailerId, merchantId })
await prisma.pricing_snapshots.create({ data: { ... } })

// Option 2: Check (returns result)
const result = await validatePricingSnapshotAlignment(retailerId, merchantId)
if (!result.valid) {
  log.error('Invalid alignment', { error: result.error })
  return
}

// Option 3: Batch validation
const { valid, invalid } = await validatePricingSnapshotAlignmentBatch(pairs)
```

**Usage Rules**:
- If `retailerId` is NULL: No validation needed (merchant-only snapshots)
- If `retailerId` is set: MUST validate before insert
- Current write paths: `benchmark.ts` (retailerId=NULL, no validation needed)

### retailers.merchantId Removal (Completed)

The `retailers.merchantId` field has been **removed** in favor of the `merchant_retailers` join table.

**Why Join Table?**
- Supports future M:N relationships (one merchant can have multiple retailers)
- Explicit relationship status (`ACTIVE`, `SUSPENDED`, etc.)
- Listing status for consumer visibility (`LISTED`, `UNLISTED`)
- Audit fields (`createdBy`, `listedAt`, `unlistedBy`, etc.)

**Migration Applied**: `20260102_remove_retailers_merchantid`
- Dropped `retailers.merchantId` column
- Dropped `retailers_merchantId_idx` index
- Dropped FK constraint

**Current State**: All retailer↔merchant relationships are managed via `merchant_retailers` join table.
