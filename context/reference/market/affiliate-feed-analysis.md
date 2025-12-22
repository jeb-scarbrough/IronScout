# Affiliate Feed Analysis & Proposed Changes Review

**Date:** 2025-12-22
**Status:** Under Review
**Purpose:** Evaluate proposed schema/interface changes for affiliate feed handling

---

## Executive Summary

Analysis of proposed changes to support Impact-style affiliate feeds. Each item evaluated against:
- Industry patterns (Impact, AvantLink, ShareASale, CJ)
- Competitor implementations (AmmoSeek, WikiArms, GunBroker)
- IronScout architecture constraints (ADRs, existing schema)

---

## Proposed Changes

### A. Affiliate Attribution Fields

**Proposal:**
```typescript
{
  "affiliateNetwork": "impact",
  "affiliateProgramId": "12345",
  "affiliateCampaignId": "67890",
  "affiliateTrackingTemplate": "https://track.impact.com/...",
  "affiliateClickId": null
}
```

**Rationale Given:**
- Impact tracking is network + advertiser + campaign scoped
- Need to swap tracking templates per retailer
- Keeps product record neutral while enabling dynamic link wrapping

**Current State:**
- `Source.affiliateNetwork` already exists (IMPACT, AVANTLINK, SHAREASALE, CJ, RAKUTEN)
- No campaign/program/template fields exist

**Research Findings:**
- AmmoSeek/WikiArms store product data separately from tracking
- Tracking URLs generated at click time, not ingestion
- Same product from different networks needs different tracking

**Options:**
1. Add to ParsedProduct interface
2. Add to Source table
3. Create new AffiliateConfig table
4. Defer until click tracking is needed

**Recommendation:** `APPROVED - Option 2`

**Decision (2025-12-22):** Add minimal, network-agnostic fields to Source table:
- `affiliateProgramId` (String, nullable) - Internal program identifier for this Source, if used
- `affiliateAdvertiserId` (String, nullable) - Network advertiser/merchant ID (Impact advertiser ID or equivalent)
- `affiliateCampaignId` (String, nullable) - Campaign identifier for attribution within the network
- `affiliateTrackingTemplate` (Text, nullable) - URL template for generating tracking links at click time

**Rationale:**
- Source already tracks `affiliateNetwork` - these fields extend that pattern
- Configuration is per-feed, not per-product
- Prevents predictable refactor when monetization ships
- Low-churn, low-cost addition
- Tracking URLs generated at click time, not at ingestion

---

### B. Retailer Identity Normalization

**Proposal:**
```typescript
{
  "retailerId": "ammo-hero",
  "retailerTier": "large"
}
```

**Rationale Given:**
- Impact reporting keys off advertiser IDs, not names
- Need deterministic joins across feeds, clicks, and payouts
- Tier drives polling cadence, SLA, and error thresholds

**Current State:**
```prisma
model Price {
  retailerId  String
  retailer    Retailer  @relation(...)
}

model Retailer {
  id    String
  tier  RetailerTier  // STANDARD, PREMIUM
}
```

**Research Findings:**
- Parser should pass retailer as string for matching
- Writer layer resolves to retailerId via lookup/upsert
- This separation is correct pattern

**Options:**
1. Add retailerId to ParsedProduct
2. Keep current pattern (string in parser, ID in writer)
3. Add retailerTier to ParsedProduct

**Recommendation:** `APPROVED - Option 2`

**Decision (2025-12-22):** Keep current pattern. No retailerId or retailerTier on ParsedProduct.

**Rationale:**
- ParsedProduct is feed-shaped. Feeds provide retailer name or implicit Source, not stable internal IDs
- Normalization is a writer concern - writer already resolves Retailer via Source or lookup
- Tier belongs on Retailer table - internal segmentation for scheduling, SLAs, throttling, alert thresholds

**Implementation Notes:**
- Every ingestion run scoped by sourceId (canonical retailer mapping key)
- Raw retailer string stored only if needed for audit/debug; Source relation is sufficient
- If ops needs SMALL|MEDIUM|LARGE sizing separate from business tier, add `RetailerSize` enum rather than overloading `RetailerTier`

**Tests to Add:**
- Ingest same product from two Sources mapping to same Retailer → verify single Retailer, multiple Sources, no product duplication
- Ingest from new Source with unknown retailer name → verify Retailer created with default tier

---

### C. Offer/Pricing Semantics

**Proposal:**
```typescript
{
  "salePrice": 17.99,
  "saleStart": "2025-12-01T00:00:00Z",
  "saleEnd": "2025-12-31T23:59:59Z",
  "couponCode": null
}
```

**Rationale Given:**
- Impact merchants often run promos that are not price-based
- Some merchants do not change base price
- Avoids price-history corruption

**Current State:**
- ParsedProduct has: `price`, `originalPrice`, `discountPercentage`
- Price schema has: `price` only
- Price is append-only (ADR-004)

**Research Findings:**
- Impact/AvantLink feeds provide both price and originalPrice
- AmmoSeek XML spec includes sale metadata
- Append-only model can track sale windows via timestamps

**Options:**
1. Add to ParsedProduct interface only
2. Add to Price schema only
3. Add to both (parser extracts, writer persists)
4. Use price history queries to infer sales

**Proposed Schema Addition:**
```prisma
model Price {
  // Existing
  price               Decimal   @db.Decimal(10, 2)

  // Proposed additions
  originalPrice       Decimal?  @db.Decimal(10, 2)
  priceType           String?   // 'regular' | 'sale' | 'clearance'
  saleStartsAt        DateTime?
  saleEndsAt          DateTime?
  couponCode          String?
}
```

**Recommendation:** `APPROVED - Option 3`

**Decision (2025-12-22):** Add to both ParsedProduct and Price schema.

**Schema Changes (Price model):**
```prisma
originalPrice       Decimal?        @db.Decimal(10, 2)
priceType           PriceType?      // enum: REGULAR, SALE, CLEARANCE
saleStartsAt        DateTime?       // Informational only, not enforced
saleEndsAt          DateTime?       // Informational only, not enforced
```

**ParsedProduct Changes:**
```typescript
originalPrice?: number
priceType?: 'REGULAR' | 'SALE' | 'CLEARANCE'
saleStartsAt?: string  // ISO-8601
saleEndsAt?: string    // ISO-8601
```

**Rationale:**
- Prices are append-only (ADR-004) - promo context must be persisted with snapshot or lost forever
- Using enum prevents downstream logic rot vs String type
- Sale windows are informational only - feeds lie, never enforce them
- Deferred `couponCode` - adds junk data and support tickets without proven source

**Rules:**
- Treat sale windows as informational only
- If feed provides only discountPercentage but not originalPrice, store what you got - compute nothing

---

### D. Product Lifecycle & Compliance

**Proposal:**
```typescript
{
  "productStatus": "active",
  "lastSeenAt": "2025-12-22T12:30:00Z",
  "sourceFeed": "impact"
}
```

**Rationale Given:**
- Needed for soft deletes
- Needed for compliance audits
- Needed to explain "why did this disappear"

**Current State:**
```prisma
model DealerSku {
  isActive      Boolean   @default(true)
  lastSeenAt    DateTime?
  missingCount  Int       @default(0)
}

model Source {
  affiliateNetwork  AffiliateNetwork?
}
```

**Research Findings:**
- These fields already exist in dealer pipeline
- Affiliate feeds go through Source → Price, not DealerSku
- May need equivalent for affiliate-sourced products

**Options:**
1. Add to ParsedProduct interface
2. Add lifecycle fields to Price model
3. Rely on existing Source + execution logs
4. Create ProductLifecycle tracking table

**Recommendation:** `APPROVED - Option 3 now, Option 4 later if needed`

**Decision (2025-12-22):** Do not add lifecycle fields to ParsedProduct or Price. Rely on existing primitives.

**Existing Primitives (sufficient for now):**
- `Source.lastRunAt` + execution logs for run boundaries
- `Price.createdAt` for presence and recency
- `DealerSku.lastSeenAt/missingCount` for dealer pipeline (SKU-level lifecycle)

**Rationale:**
- `productStatus` for affiliate ingestion is usually derived, not trustworthy from feed
- Adding declared status creates conflicting truth sources (derived vs declared)
- Creates a new state machine to maintain forever

**Track Presence by Observation:**
- During Source run: mark seen items in temp set keyed by product identity (UPC/SKU/catalogItemId)
- After run: compute "missing" by diff against previous known set
- Store counters and timestamps in execution metrics only

**Expose Lifecycle via Queries:**
- "Active" = seen within N days based on latest `Price.createdAt`

**Upgrade to Option 4 When:**
- Need "delisted" accuracy per product per source
- Need fast "show only active listings" queries at scale without scanning price history
- Ingest deltas where absence is meaningful

**Future Schema (if needed):**
```prisma
model SourceProduct {
  sourceId          String
  sourceProductKey  String    // sku/upc/catalogItemId
  firstSeenAt       DateTime
  lastSeenAt        DateTime
  missingCount      Int       @default(0)
  isActive          Boolean   @default(true)
}
```
This mirrors DealerSku cleanly without polluting Price.

---

### E. Fields to NOT Add (Confirmed)

**These should NOT be added per original proposal:**

| Field | Reason |
|-------|--------|
| Conversion rate | Post-click metric, Impact provides |
| EPC (earnings per click) | Network provides this |
| Commission amount | Network provides this |
| Dealer quality scores | Policy/bias risk |
| Trust/reliability metrics | ADR-006 violation |

**Recommendation:** `CONFIRMED - DO NOT ADD`

---

### F. Structural Change: Split Product from Tracking

**Proposal:**
```typescript
ProductRecord {
  catalogItemId
  sku
  upc
  name
  price
  availability
}

AffiliateContext {
  retailerId
  affiliateNetwork
  trackingTemplate
  campaignId
}
```

**Current State:**
```
ParsedProduct (ephemeral, in-memory)
  └── Normalized fields for any network

Source (persistent)
  └── affiliateNetwork, url, feedHash

Price (persistent, append-only)
  └── url (canonical), retailerId, price
```

**Research Findings:**
- Current architecture matches AmmoSeek/WikiArms patterns
- Product data independent of tracking URLs
- Tracking URL generation at query/click time, not ingestion

**Options:**
1. Current structure is correct - no change
2. Formalize with explicit AffiliateContext type
3. Create separate AffiliateTracking table

**Recommendation:** `APPROVED - Option 1 with formalization`

**Decision (2025-12-22):** No new tables. No big refactor. Current structure is correct. Add one explicit in-code type.

**Current Structure (confirmed correct):**
- `ParsedProduct` (ephemeral) → product-shaped data, network-agnostic
- `Source` (persistent) → affiliate config (network, advertiser, campaign, template)
- `Price` (persistent, append-only) → canonical URL, price snapshot

**Formalization Required:**

Create an explicit in-code type (not a DB table):
```typescript
// Picked from Source for click-time link generation
type AffiliateContext = Pick<Source,
  'affiliateNetwork' |
  'affiliateAdvertiserId' |
  'affiliateCampaignId' |
  'affiliateTrackingTemplate'
>

function buildTrackingUrl(productUrl: string, context: AffiliateContext): string
```

**Rationale:**
- Makes "click-time link generation" a first-class boundary
- Prevents accidental drift (no one stores tracking URLs on Price)
- Makes testing trivial

**What NOT to do:**
- Do not add AffiliateTracking table yet
- Do not add tracking fields to Price
- Do not store click IDs in product records

**Acceptance Criteria:**
- [x] One canonical `buildTrackingUrl` function (`apps/api/src/services/affiliate-tracking.ts`)
- [x] Unit tests per network for template placeholder substitution and URL encoding (`apps/api/src/services/__tests__/affiliate-tracking.test.ts` - 12 tests)
- [ ] Integration test: ingest stores canonical URL, click endpoint returns wrapped URL (deferred until click endpoint exists)

---

## Review Checklist

- [x] A. Affiliate Attribution Fields
- [x] B. Retailer Identity Normalization
- [x] C. Offer/Pricing Semantics
- [x] D. Product Lifecycle & Compliance
- [x] E. Fields to NOT Add (confirmed)
- [x] F. Structural Split

---

## Decision Log

| Item | Decision | Date | Notes |
|------|----------|------|-------|
| A. Affiliate Attribution | APPROVED - Option 2 | 2025-12-22 | Added to Source: affiliateProgramId (internal), affiliateAdvertiserId (network merchant ID), affiliateCampaignId, affiliateTrackingTemplate |
| B. Retailer Identity | APPROVED - Option 2 | 2025-12-22 | Keep current pattern. No retailerId/retailerTier on ParsedProduct. Writer handles normalization. |
| C. Offer/Pricing | APPROVED - Option 3 | 2025-12-22 | Added to both: originalPrice, priceType (enum), saleStartsAt, saleEndsAt. Deferred couponCode. |
| D. Product Lifecycle | APPROVED - Option 3 | 2025-12-22 | No schema changes. Use existing Source.lastRunAt, Price.createdAt, execution logs. Add SourceProduct table later if needed. |
| E. Exclusions | CONFIRMED | 2025-12-22 | Do not add conversion/EPC/commission/trust metrics |
| F. Structural Split | APPROVED - Option 1 | 2025-12-22 | Current structure correct. Add AffiliateContext type + buildTrackingUrl() function. No new tables. |

---

## Link Generation Contract

This section locks the architectural boundary for affiliate link generation.

### Invariants

1. **Tracking URLs are generated at click time only** - Never at ingestion
2. **Canonical product URLs are persisted** - `Price.url` contains the retailer's clean URL
3. **Source owns affiliate configuration** - All tracking params live on Source table
4. **AffiliateContext is code-only** - Not a database table, just a type for passing config

### Placeholder Contract

Templates use `{PLACEHOLDER}` syntax. Supported placeholders:

| Placeholder | Description | Source Field |
|-------------|-------------|--------------|
| `{PRODUCT_URL}` | Canonical URL (URL-encoded) | Runtime parameter |
| `{PRODUCT_URL_RAW}` | Canonical URL (not encoded) | Runtime parameter |
| `{PROGRAM_ID}` | Internal program identifier | `Source.affiliateProgramId` |
| `{ADVERTISER_ID}` | Network merchant ID | `Source.affiliateAdvertiserId` |
| `{CAMPAIGN_ID}` | Campaign identifier | `Source.affiliateCampaignId` |

### Validation Rules

- Templates **must** contain `{PRODUCT_URL}` or `{PRODUCT_URL_RAW}`
- Unknown placeholders emit warnings (not errors)
- Network set without template emits revenue leak warning

### Implementation

- Type: `AffiliateContext` in `apps/api/src/services/affiliate-tracking.ts`
- Function: `buildTrackingUrl(productUrl, context): TrackingUrlResult`
- Validation: `validateTrackingTemplate(template): TemplateValidationResult`

---

## References

- ADR-004: Price history is append-only
- ADR-006: No recommendations, verdicts, or deal scores
- Impact.com Feed Specifications
- AmmoSeek XML Feed Specification
- AvantLink Datafeed Manager Guide
