# Pricing and Tiers

This document defines IronScout’s pricing model and tier boundaries.

Its purpose is to:
- Clarify what users pay for
- Prevent over-claiming in pricing pages
- Ensure tiers map to enforceable behavior
- Align monetization with trust and operability

If a pricing claim cannot be enforced in the product, it must not appear here.

---

## Pricing Philosophy

IronScout pricing is based on **access to context**, not outcomes.

Users pay for:
- More information
- More control
- More historical depth
- Faster or more flexible alerts

Users do not pay for:
- Guaranteed results
- Predictions
- Recommendations
- Performance outcomes

Pricing increases information density, not certainty.

---

## Consumer Tiers

### Free

The Free tier provides baseline access to IronScout.

Included:
- AI-powered search
- Canonical product grouping
- Current price and availability
- Limited historical price context
- Basic price and availability alerts

Not included:
- Deep historical views
- Advanced alerting
- Advanced filters or ranking
- AI-assisted explanations beyond basic context

The Free tier is designed to be useful without creating false confidence.

---

### Premium

Premium enhances context and control.

Included:
- Deeper historical price context
- Faster and more flexible alerts
- Advanced filters and ranking
- AI-assisted explanations where available

Not included:
- Guaranteed savings
- Purchase recommendations
- Predictive pricing
- Exclusive deals

Premium improves clarity and speed.  
It does not change the fundamental guarantees of the platform.

---

## Dealer Tiers

Dealer tiers are designed to balance:
- Market visibility
- Fair competition
- Operational simplicity

All dealer tiers are subject to eligibility rules.

Eligibility is determined by:
- Active subscription status
- Feed health and data quality
- Platform policies

---

### Dealer Starter

The Starter tier enables basic participation.

Included:
- Inventory ingestion and normalization
- Canonical matching to products
- Eligible inventory visibility in consumer search

Not included:
- Market pricing benchmarks
- Historical context
- Performance analytics
- Usage-based billing UI (v1)

Starter is designed for onboarding and basic presence.

---

### Dealer Standard

Standard adds market context.

Included:
- All Starter features
- Caliber-level pricing benchmarks
- Basic historical context
- Plan-based refresh rates

Not included:
- SKU-level competitive comparisons
- Pricing recommendations
- Conversion analytics

Standard provides context without operational complexity.

---

### Dealer Pro

Pro adds deeper context for larger or more active dealers.

Included:
- All Standard features
- SKU-level pricing context where data is sufficient
- Deeper historical benchmarks
- More frequent refresh where applicable

Not included:
- Automated repricing
- Pricing recommendations
- Guaranteed performance metrics

Pro increases resolution, not authority.

---

## Billing Boundaries

### Consumer Billing

- Consumers are billed via subscription
- Tier changes take effect according to subscription state
- Access is enforced server-side

There are no usage-based consumer charges in v1.

---

### Dealer Billing

- Dealers are billed via subscription
- Billing method may vary by dealer (e.g. invoice, platform billing)
- Subscription state determines eligibility and access

Usage-based billing may exist internally but must not be exposed in v1.

---

## Enforcement Rules

- Tier benefits must be enforced at the API and data level
- UI hiding alone is not sufficient
- Admin overrides must be audited
- If enforcement is ambiguous, the feature must be removed or downgraded

---

## Change Control

Any change to pricing or tier definitions requires:
- Review against `00_public_promises.md`
- Confirmation that enforcement exists
- Update to pricing pages and in-product copy

Pricing language must remain conservative.

---

## Guiding Principle

> Users pay for better understanding, not guaranteed outcomes.
