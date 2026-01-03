# Security and Trust

This document defines the security, trust, and integrity boundaries for IronScout v1.

Its purpose is to:
- Protect users and merchants from unintended exposure
- Ensure claims are enforceable
- Prevent trust erosion from partial or ambiguous behavior
- Establish clear boundaries for AI, data, and operations

If a behavior cannot be secured or explained clearly, it must not be shipped.

---

## Terminology (Canonical)

- **Merchant**: B2B portal account (subscription, billing, auth boundary). Merchant has users. Merchant submits merchant-scoped datasets (e.g., `pricing_snapshots`).
- **Retailer**: Consumer-facing storefront shown in search results. Consumer `prices` are keyed by `retailerId`. Retailers do not authenticate.
- **Source/Feed**: Technical origin of a consumer price record (affiliate, scraper, direct feed). Source is not Merchant.
- **Admin rights**: Merchant users are explicitly granted permissions per Retailer.
- **Legacy**: Any “dealer” wording or `DEALER_*` keys are legacy and must be migrated to “merchant” terminology.

## Trust Model

IronScout operates on a simple trust model:

- Users trust IronScout to present information honestly and conservatively
- Merchants trust IronScout to enforce visibility rules fairly for the Retailers they administer
- IronScout does not ask users to trust predictions, recommendations, or guarantees

Trust is maintained by:
- Clear boundaries
- Conservative language
- Deterministic enforcement
- Auditable actions

---

## Identity and Access Control

### Consumers

- Consumer accounts are isolated from merchant and admin data
- Consumer identity is used only to personalize access and alerts
- No consumer can access merchant-only or admin-only data

---

### Merchants

- Merchant accounts are isolated from other merchants
- Merchants can only access Retailers, feeds, and metrics they are explicitly permitted to administer
- Auth boundary = Merchant. Retailers do not authenticate. All access is via Merchant users with explicit Retailer permissions.

Visibility boundary = Retailer. Eligibility and visibility are enforced by:
- Subscription state (merchant)
- Feed health
- Platform policies

---

### Admins

- Admin access is restricted and explicit
- Admin impersonation exists for support and troubleshooting only
- Impersonation does not bypass:
  - subscription enforcement
  - Retailer visibility rules
  - billing logic

All admin actions that affect access, billing, or visibility must be audited.

---

## Data Isolation and Integrity

- Cross-account data access is not permitted
- Merchant data cannot be accessed by other merchants through any path
- Consumer data is not shared with merchants except in aggregate where explicitly allowed
- Sensitive fields are never exposed client-side

If isolation cannot be guaranteed, the feature must be removed or restricted.

---

## Retailer Visibility Enforcement

- Only eligible Retailer inventory may appear in consumer experiences
- Eligibility changes propagate deterministically
- Suspended or blocked Merchants lose portal access; ineligible Retailers must be removed from:
  - search results
  - alerts
  - watchlists
  - direct product views

Visibility enforcement is a trust-critical path.

---

## AI Trust Boundaries

IronScout uses AI as an assistive tool.

### AI may be used to:
- Interpret search intent
- Normalize and group listings
- Assist ranking
- Generate explanatory text where data is sufficient

### AI must not:
- Make decisions on behalf of users
- Present recommendations as advice
- Claim certainty or optimality
- Override explicit data constraints

AI output must degrade gracefully when:
- Data is sparse
- Signals conflict
- Confidence is low

If graceful degradation is not possible, output must be reduced or removed.

---

## Language and Presentation Safety

- Public-facing language must remain conservative
- UI must not imply guarantees, predictions, or advice
- Empty states and errors must be honest
- “Coming soon” features must not be visible to paying users

Language is part of the security surface.

---

## Billing and Subscription Integrity

- Subscription state is enforced server-side
- Tier benefits are derived from data shaping, not UI gating
- Expired and suspended states are respected across all services
- Billing-related admin actions are logged and auditable

If billing state is ambiguous, access must default to restricted.

---

## Operational Safety

- Critical workflows must be observable
- Failures must be diagnosable without modifying production code
- Known failure modes must have documented runbooks
- Emergency actions must be reversible where possible

Operational opacity is a trust risk.

---

## Data Freshness and Accuracy

IronScout makes reasonable efforts to keep data current.

IronScout does not guarantee:
- Real-time accuracy
- Complete market coverage
- Immediate propagation of changes

When data is stale or incomplete:
- It must not be presented as authoritative
- Language must reflect uncertainty

---

## Incident Response and Disclosure

- Security-relevant incidents must be investigated promptly
- Access-impacting issues take priority over feature issues
- Corrections must favor removing access over risking exposure

Silently allowing incorrect or unsafe behavior is not acceptable.

---

## Change Control

Any change that affects trust boundaries requires:
- Review against `00_public_promises.md`
- Review against `03_release_criteria.md`
- Explicit acknowledgment of new risk

Trust boundaries are harder to rebuild than features.

---

## Guiding Principle

> Trust is enforced through boundaries, not assurances.
