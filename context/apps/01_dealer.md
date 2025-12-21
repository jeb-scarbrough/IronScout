# Dealer App

This document describes the **dealer-facing application** for IronScout v1.  
It defines what dealers can do, see, and expect, and where explicit constraints apply.

This document must remain aligned with:
- `context/00_public_promises.md`
- `context/01_product_overview.md`
- `context/02_v1_scope_and_cut_list.md`
- `context/04_pricing_and_tiers.md`
- `architecture/04_subscription_and_billing.md`

If dealer UI behavior conflicts with those documents, this document is wrong.

---

## Purpose of the Dealer App

The dealer app exists to:
- Ingest dealer inventory reliably
- Normalize and match SKUs to canonical products
- Determine eligibility for consumer visibility
- Provide **market pricing context**, not pricing advice

It is not designed to:
- Recommend prices
- Automate repricing
- Guarantee traffic or conversions
- Provide competitive or prescriptive analytics

---

## Core Dealer Flows (v1)

### Authentication and Access

- Dealer users authenticate into the dealer portal
- Access is scoped to a single dealer account
- Dealer users cannot see other dealers’ data

Access is governed by:
- Dealer subscription tier
- Dealer subscription status
- Feed health and platform policies

---

### Feed Configuration and Ingestion

Dealers can:
- Configure one or more inventory feeds (CSV, XML, JSON)
- View feed status and last execution
- See ingestion errors and health indicators
- Disable or correct feeds when issues occur

Constraints:
- Feed configuration changes must not require redeploys
- Feed health affects eligibility for visibility
- Broken feeds may be quarantined

If a feed is quarantined or disabled:
- Inventory from that feed must not appear in consumer experiences
- No downstream benchmarks or insights may be generated

---

### SKU Normalization and Matching

Dealer SKUs are:
- Parsed from feeds
- Normalized into ammo attributes
- Matched to canonical products where possible

Dealer users may:
- View SKU match status
- Identify unmapped or ambiguous SKUs

Constraints:
- SKU-to-product matching must be deterministic
- Ambiguous matches must not silently map
- Mapping failures must be visible to ops

---

### Inventory Visibility

Dealer inventory appears in consumer search **only if eligible**.

Eligibility is determined by:
- Active subscription state
- Feed health
- Platform policies

Visibility rules:
- Visibility is enforced server-side
- UI hiding alone is insufficient
- Ineligible inventory must not appear through any consumer path

If eligibility changes:
- Visibility must update deterministically
- Alerts must not trigger from ineligible inventory

---

### Dealer Context and Benchmarks

Depending on plan tier, dealers may see:
- Market pricing context
- Caliber-level benchmarks
- Historical pricing ranges

Dealer context:
- Is descriptive, not prescriptive
- Compares dealer pricing to market ranges
- Does not suggest actions

Disallowed outputs include:
- “Recommended price”
- “You should lower your price”
- “Best price positioning”

---

## Subscription and Tier Behavior

### Starter

Starter dealers have:
- Inventory ingestion
- Canonical matching
- Eligible inventory visibility

Starter dealers do not have:
- Market benchmarks
- Historical context
- Performance analytics
- Usage-based billing UI (v1)

---

### Standard

Standard dealers have:
- All Starter features
- Caliber-level market benchmarks
- Basic historical context
- Plan-appropriate refresh behavior

---

### Pro

Pro dealers have:
- All Standard features
- Deeper historical benchmarks
- SKU-level pricing context where data allows
- More frequent refresh where applicable

Pro increases **resolution**, not authority.

---

## Subscription States and Effects

### Active
- Full access to tier-appropriate features
- Inventory eligible for visibility

### Expired (Grace)
- Behavior must be explicitly defined and consistent
- Visibility rules must be deterministic

### Suspended / Cancelled
- Inventory not visible
- Ingestion must be SKIPPED
- Dealer context access may be restricted

If state is ambiguous, access must default to restricted.

---

## UI Language and Presentation Rules

Dealer UI must:
- Use neutral, operational language
- Avoid claims of performance or outcomes
- Avoid recommendation framing

Allowed language:
- “Compared to market range”
- “Above recent average”
- “Below recent range”

Disallowed language:
- “Optimal price”
- “Guaranteed traffic”
- “Recommended adjustment”

Language is a trust and liability surface.

---

## Error States and Degradation

When data is missing or unreliable:
- Context must be reduced or hidden
- Explanations must be removed
- Errors must be explicit

Dealer-facing errors must:
- Identify the affected feed or SKU
- Avoid blaming the dealer without evidence
- Provide clear next steps

---

## Known Constraints and Decisions (v1)

These are intentional:

- No pricing recommendations
- No automated repricing
- No usage-based billing UI
- No conversion attribution
- No dealer-to-dealer competitive ranking

If any of these appear, it is a scope violation.

---

## Non-Negotiables

- Eligibility enforcement is mandatory
- Visibility must fail closed
- Subscription state must be respected everywhere
- Dealer trust depends on fairness and predictability

---

## Guiding Principle

> The dealer app exists to provide visibility and context, not instructions.
