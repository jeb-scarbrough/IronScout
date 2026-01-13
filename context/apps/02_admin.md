# Admin App

This document describes the **admin-facing application** for IronScout.  
It defines admin capabilities, boundaries, and enforcement rules.

The admin app is a **trust-critical surface**. Any ambiguity or overreach here undermines every other system guarantee.

This document must remain aligned with:
- `context/00_public_promises.md`
- `context/02_v1_scope_and_cut_list.md`
- `context/05_security_and_trust.md`
- `architecture/04_subscription_and_billing.md`

If admin behavior conflicts with those documents, this document is wrong.

---

## Terminology (Canonical)

- **Merchant**: B2B portal account (subscription, billing, auth boundary).
- **Retailer**: Consumer-facing storefront shown in search results. Consumer `prices` are keyed by `retailerId`. Retailers do not authenticate.
- **Source/Feed**: Technical origin of a consumer price record (affiliate, scraper, direct feed). Source is not Merchant.
- **Admin rights**: Merchant users are explicitly granted permissions per Retailer.
- **Legacy**: Any “dealer” wording or `DEALER_*` keys are legacy and must be migrated to “merchant” terminology.

## Purpose of the Admin App

The admin app exists to:
- Support operations and troubleshooting
- Manage affiliate feed ingestion and retailer visibility
- Safely intervene when automated systems fail
- Preserve system integrity and trust

It is not designed to:
- Bypass enforcement rules
- Provide hidden product capabilities
- Act as a “superuser” interface without auditability

Admin power is constrained power.

---

## Admin Access and Identity

- Admin access is explicit and restricted
- Admin users are authenticated separately from consumers and merchants
- Admin permissions are not inferred implicitly

Admin roles (if present) must be explicit.  
If roles are not implemented, all admins are assumed fully privileged but audited.

---

## Core Admin Capabilities

### Retailer Eligibility and Visibility

Admins may:
- Flip `retailers.visibilityStatus` (ELIGIBLE/INELIGIBLE/SUSPENDED) per policy
- Manage source and affiliate feed linkage for retailer identity

Constraints:
- All actions must be audited with before/after values.
- Subscription status is not a consumer visibility gate; eligibility changes must be explicit.
- Overrides must be reversible and fail closed.

---

### Feed and Ingestion Control

Admins may:
- Enable or disable affiliate feeds
- Quarantine broken feeds
- View feed execution history and errors
- Stop propagation of bad data

Admins must not:
- Modify historical data to “fix” outcomes
- Bypass eligibility rules to force visibility

---

### Impersonation

Admins may impersonate:
- Merchant user sessions (for support and troubleshooting)

Impersonation allows:
- Viewing the merchant portal as that user
- Diagnosing configuration or UI issues

Impersonation must not:
- Bypass subscription enforcement
- Bypass visibility rules
- Mutate billing state implicitly
- Elevate privileges beyond the impersonated user

Impersonation must be clearly indicated in the UI and session context.

---

---

## Audit Logging

### Required Coverage

Audit logs must capture:
- Admin identity
- Target entity (Merchant portal access, Retailer visibility, subscription, feed)
- Action performed
- Before and after values
- Timestamp
- Optional reason or note

Actions that require audit logging include:
- Subscription changes
- Merchant or Retailer eligibility changes
- Feed enable/disable
- Billing method changes
- Any override affecting visibility or access

If an action is not logged, it should not exist.

---

## UI Language and Safety

Admin UI language must:
- Be operational and neutral
- Avoid aspirational or marketing language
- Avoid implying recommendations or guarantees

Admin UI must not:
- Expose experimental or out-of-scope features
- Leak internal feature flags or future plans
- Encourage unsafe overrides

Admins are operators, not product testers.

---

## Error Handling and Safeguards

Admin actions must:
- Require confirmation for destructive changes
- Prevent accidental double-application
- Surface clear errors when actions fail

Bulk operations (if any) must:
- Be intentionally scoped
- Be reversible
- Have additional safeguards

---

## Known Constraints and Decisions

These are intentional limitations:

- No bulk Merchant imports without review
- No automated corrective actions without admin approval
- No silent overrides of eligibility or billing
- No admin-triggered pricing automation

If any of these appear, it is a scope violation.

---

## Non-Negotiables

- Admin actions must be auditable
- Impersonation must not bypass enforcement
- Visibility and billing rules always win
- Ambiguity defaults to restriction

---

## Guiding Principle

> Admin power exists to protect the system, not to bypass it.
