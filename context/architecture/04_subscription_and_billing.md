# Subscription and Billing

This document describes how subscriptions and billing are modeled and enforced in IronScout **as implemented today**, with explicit callouts where behavior, documentation, or code paths require decisions or tightening.

This document defines **mechanics and enforcement**, not pricing language. Pricing promises live in `context/04_pricing_and_tiers.md`.

---

## Goals (v1)

Subscriptions and billing must:
- Enforce access deterministically
- Be auditable and reversible
- Fail closed when state is ambiguous
- Avoid creating trust or support debt

v1 prioritizes correctness and simplicity over billing sophistication.

---

## Subscription Domains

IronScout has two distinct subscription domains:

1. **Consumers**
2. **Dealers**

They must remain isolated in data, logic, and enforcement.

---

## Consumer Subscriptions

### Model

- Consumers have a `User` record with a tier enum:
  - `FREE`
  - `PREMIUM`
- Billing is subscription-based
- There is no usage-based consumer billing in v1

### Enforcement Points

Consumer tier affects:
- History depth
- Alert limits and cadence
- Advanced filters and ranking
- AI-assisted explanations

**Required invariant**
- Tier enforcement must occur server-side, before data is returned.
- UI hiding alone is insufficient.

### Observed Implementation

- Tier configuration appears centralized in `apps/api/src/config/tiers.ts`
- API helpers shape responses based on tier

### Required Tightening

**Decision / Code change required**
- Some API paths appear to derive tier using client-provided headers.
- Tier must instead be derived from verified auth context (session/JWT).

If tier cannot be verified, default to `FREE`.

---

## Dealer Subscriptions

### Model

Dealers have:
- A subscription tier (e.g. STARTER, STANDARD, PRO)
- A subscription status (ACTIVE, EXPIRED, SUSPENDED, CANCELLED)
- A billing method (e.g. platform billing, invoice)

Subscription state governs:
- Ingestion eligibility
- Visibility in consumer experiences
- Access to dealer-facing context

---

### Dealer Subscription States

#### ACTIVE
- Full access to tier-appropriate features
- Inventory eligible for consumer visibility

#### EXPIRED (Grace)
- Access may be partially retained for a limited period
- Eligibility rules must be explicit and documented

#### SUSPENDED / CANCELLED
- No consumer visibility
- Ingestion must be SKIPPED
- Dealer portal access may be restricted

**Required invariant**
- A suspended dealer must never appear in consumer search, alerts, or watchlists.

---

## Enforcement Surfaces (Dealer)

Dealer subscription state must be enforced in **all** of the following places:

1. **Harvester**
   - Skip ingestion when ineligible
   - Do not enqueue downstream jobs

2. **API Query Layer**
   - Filter dealer inventory at query time
   - Do not rely on ingestion-time filtering alone

3. **Alerts**
   - Dealer inventory must not trigger alerts when ineligible

4. **Dealer Portal**
   - Restrict access to context based on tier and status

Failure at any one surface is a trust violation.

---

## Billing Methods

### Consumer Billing

- Managed via subscription provider (e.g. Stripe)
- Linked via `stripeCustomerId` / `stripeSubscriptionId`
- Subscription state is authoritative

No metered billing exists for consumers in v1.

---

### Dealer Billing

- Dealers may be billed via:
  - platform billing
  - invoice / purchase order
- Billing method must be mutually exclusive

**Required invariant**
- A dealer must not simultaneously have:
  - invoice billing, and
  - active platform billing identifiers

If billing state is ambiguous, default to restricted access.

---

## Admin Capabilities and Auditability

### Admin Powers

Admins may:
- Change subscription tier
- Change subscription status
- Extend expiration
- Switch billing method
- Impersonate dealers for support

These powers are **trust-critical**.

---

### Audit Requirements

All admin actions that affect:
- access
- visibility
- billing
- subscription state

must:
- be recorded in an audit log
- include before/after values
- include admin identity
- include timestamp

**Observed risk**
- Some admin mutations may not yet be transactionally coupled with audit logging.

**Required action**
- Wrap subscription mutations and audit logging in a single transaction.

---

## Impersonation Boundaries

### Allowed

- View dealer portal as the dealer
- Troubleshoot UI and configuration issues

### Not Allowed

- Bypass subscription enforcement
- Bypass visibility rules
- Mutate billing state implicitly

Impersonation must be explicit in session context and must not elevate privilege beyond UI access.

---

## Failure Modes and Defaults

### Ambiguous State

If subscription or billing state is unclear:
- Default to restricted access
- Do not expose dealer inventory
- Do not enable Premium features

### Manual Overrides

Manual admin overrides:
- Must be explicit
- Must be audited
- Must be reversible

Silent overrides are not acceptable.

---

## Known Inconsistencies and Required Decisions

1. **Tier resolution trust**
   - Decision: remove all header-based tier inference
   - Enforce verified auth-based resolution only

2. **Grace period semantics**
   - Decision: explicitly document which features remain during grace
   - Ensure consistency across harvester, API, and UI

3. **Billing exclusivity**
   - Decision: enforce mutual exclusivity in code and admin UI

4. **Audit coverage**
   - Decision: confirm all subscription mutations are audited transactionally

---

## Non-Negotiables

- Subscription enforcement must be deterministic
- Visibility must fail closed
- Admin actions must be auditable
- Billing ambiguity must restrict access

---

## Guiding Principle

> Billing exists to gate access, not to explain value.
