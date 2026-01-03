# Merchant and Retailer Reference Guide

## Purpose

This document defines the canonical meaning of **Merchant** and **Retailer** in IronScout, how they relate to each other, and how they are used across data ingestion, permissions, UI, and data corrections.

This is a **reference document**, not an ADR.  
It is authoritative. If implementation conflicts with this document, the implementation is wrong.

---

## Core Definitions

### Merchant

A **Merchant** is a B2B portal account and subscription customer of IronScout.

A Merchant:
- Has billing and subscription status.
- Has authenticated users.
- Submits data via the portal (feeds, pricing snapshots).
- Receives benchmarks, alerts, and operational insights.
- May administer one or more Retailer identities.

A Merchant is **not** consumer-facing.

---

### Retailer

A **Retailer** is a consumer-facing storefront whose prices appear in IronScout search results.

A Retailer:
- Is shown to end users (“View at <Retailer>”).
- Owns consumer price visibility.
- Is the entity consumers recognize and trust.
- May be administered by one or more Merchant users via permissions.

A Retailer does **not** authenticate directly.

---

## Relationship Model

### Merchant → Retailer

- One Merchant can administer **many Retailers**.
- A Retailer may be administered by:
  - One Merchant (typical today), or
  - Multiple Merchants (future-supported, not assumed).

Relationships are **explicit**, never inferred.

Recommended structure:
- `merchants`
- `retailers`
- `merchant_retailers` (join table)

### Listing / Entitlement

- `merchant_retailers.listingStatus` controls whether a Merchant’s retailer listings are shown to consumers (LISTED | UNLISTED).
- Relationship status (ACTIVE | SUSPENDED) is separate from Retailer eligibility.
- Consumer visibility predicate (query-time): `retailers.visibilityStatus = ELIGIBLE` AND `merchant_retailers.listingStatus = LISTED` AND `merchant_retailers.status = ACTIVE`.
- Subscription status is NOT a consumer visibility predicate.

---

## Users and Permissions

### Merchant Users

- Users authenticate under a Merchant account.
- Users are granted permissions per Retailer.
- Permissions are explicit and auditable.

Common roles:
- Admin: all retailers under the merchant.
- Manager: specific retailers.
- Analyst: read-only.

Retailers do not have users. Merchants do.

---

## Data Ownership and Attribution

### Consumer Prices (`prices`)

- Immutable facts.
- Keyed by `retailerId`.
- Represent what end users see in search results.
- Provenance fields explain **how** the data was obtained.

---

### Merchant-Submitted Data (`pricing_snapshots`)

- Immutable facts.
- Keyed by `merchantId`.
- Represent merchant-submitted or benchmark data.
- Not consumer-visible by default.

Publishing merchant data into consumer prices requires an explicit mapping to a Retailer.

---

## Source and Feed Model

A **Source** or **Feed** represents the technical origin of price data.

- Source/Feed is **not** a Merchant.
- Source/Feed is usually associated with a Retailer.
- Source explains provenance, not ownership.

Simple rule:
- Retailer = who the price is from.
- Source = how we got it.
- Merchant = who logged in and manages data.

---

## Corrections Reference (ADR-015 aligned)

Correction scopes are table- and key-specific.

| Scope     | Applies To          | Key |
|-----------|--------------------|-----|
| PRODUCT   | prices              | productId |
| RETAILER  | prices              | retailerId |
| MERCHANT  | pricing_snapshots   | merchantId |
| SOURCE    | prices              | sourceProductId or sourceId |
| AFFILIATE | prices              | affiliateId |
| FEED_RUN  | prices + snapshots  | ingestionRunId |

If a Merchant is linked to a Retailer, a single incident may require **multiple corrections**.

---

## ER-Style Model

```text
Merchant (portal account)
  └─ Merchant Users
       └─ Permissions (per Retailer)
            └─ Retailer (storefront)
                 ├─ Prices (consumer-visible)
                 └─ Feeds / Sources (ingestion config)

Merchant
  └─ Pricing Snapshots (benchmarks, portal-only)
```

---

## Operational Decision Guide

### If consumer prices are wrong
- Wrong for one retailer → RETAILER
- Wrong for one product → PRODUCT
- Wrong from one source/feed → SOURCE
- Wrong from one affiliate network → AFFILIATE
- Wrong from one ingestion run → FEED_RUN

### If portal benchmarks are wrong
- Wrong for one merchant → MERCHANT
- Wrong from one portal ingestion run → FEED_RUN

If both are wrong, apply corrections separately. Do not blur scopes.

---

## Real-World Examples (Illustrative)

### Example 1: One merchant, multiple retailers
Merchant: Bass Pro Shops (portal account)  
Retailers: Bass Pro Shops, Cabela’s

- Consumer price issue for Cabela’s → RETAILER correction.
- Benchmark upload issue → MERCHANT correction.

---

### Example 2: Merchant is also a retailer
Merchant: Brownells (portal account)  
Retailer: Brownells (storefront)

- Consumer price issue → RETAILER correction.
- Benchmark issue → MERCHANT correction.
- Often requires both.

---

### Example 3: Benchmark-only merchant
Merchant: Regional distributor  
Retailers: none

- Only MERCHANT corrections apply.
- No consumer impact.

---

## Explicit Non-Goals

- Retailer authentication.
- Implicit merchant–retailer identity equivalence.
- Treating Source or Feed as a business entity.
- Automatic publishing of merchant data into consumer prices.

---

## Summary

- Merchants log in.
- Retailers appear to consumers.
- Consumer visibility = visibilityStatus (ELIGIBLE) + listingStatus (LISTED) + relationship status (ACTIVE); subscription is not a consumer visibility gate.
- Delinquency/suspension auto-unlists; recovery requires explicit relist.
- Sources explain ingestion.
- Permissions are explicit.
- Corrections are scoped, not guessed.

This separation is required for scale, clarity, and operational safety.
