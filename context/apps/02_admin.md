# Admin App

This document describes the **admin-facing application** for IronScout v1.  
It defines admin capabilities, boundaries, and enforcement rules.

The admin app is a **trust-critical surface**. Any ambiguity or overreach here undermines every other system guarantee.

This document must remain aligned with:
- `context/00_public_promises.md`
- `context/02_v1_scope_and_cut_list.md`
- `context/05_security_and_trust.md`
- `architecture/04_subscription_and_billing.md`

If admin behavior conflicts with those documents, this document is wrong.

---

## Purpose of the Admin App

The admin app exists to:
- Support operations and troubleshooting
- Manage dealer lifecycle and subscriptions
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
- Admin users are authenticated separately from consumers and dealers
- Admin permissions are not inferred implicitly

Admin roles (if present) must be explicit.  
If roles are not implemented, all admins are assumed fully privileged but audited.

---

## Core Admin Capabilities (v1)

### Dealer Lifecycle Management

Admins may:
- Approve or onboard dealers
- Suspend or reactivate dealers
- Change dealer subscription tier
- Extend or modify subscription expiration
- Change billing method (e.g. invoice vs platform billing)

All lifecycle changes must:
- Be explicit
- Be reversible
- Be auditable

---

### Feed and Ingestion Control

Admins may:
- Enable or disable dealer feeds
- Quarantine broken feeds
- View feed execution history and errors
- Stop propagation of bad data

Admins must not:
- Modify historical data to “fix” outcomes
- Bypass eligibility rules to force visibility

---

### Impersonation

Admins may impersonate:
- Dealer users (for support and troubleshooting)

Impersonation allows:
- Viewing the dealer portal as the dealer
- Diagnosing configuration or UI issues

Impersonation must not:
- Bypass subscription enforcement
- Bypass visibility rules
- Mutate billing state implicitly
- Elevate privileges beyond the impersonated user

Impersonation must be clearly indicated in the UI and session context.

---

## Subscription and Billing Controls

### Allowed Actions

Admins may:
- Change subscription tier
- Change subscription status
- Apply or remove grace periods
- Extend expiration dates

### Required Constraints

- All changes must be logged with before/after state
- Subscription mutations must be transactionally coupled with audit logging
- Billing method must remain mutually exclusive (invoice vs platform billing)

If subscription or billing state becomes ambiguous:
- Access must default to restricted
- Visibility must be removed

---

## Audit Logging

### Required Coverage

Audit logs must capture:
- Admin identity
- Target entity (dealer, subscription, feed)
- Action performed
- Before and after values
- Timestamp
- Optional reason or note

Actions that require audit logging include:
- Subscription changes
- Dealer eligibility changes
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
- Expose experimental or deferred features
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

## Known Constraints and Decisions (v1)

These are intentional limitations:

- No bulk dealer imports without review
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
