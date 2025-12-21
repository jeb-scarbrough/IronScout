# Release Criteria

This document defines the **minimum conditions required to ship IronScout v1**.

Release criteria are binary.  
If any required condition is not met, v1 does not ship.

Partial implementation, manual workarounds, or optimistic assumptions do not satisfy these criteria.

---

## Purpose

The purpose of these criteria is to ensure that v1:
- Matches public promises
- Enforces scope boundaries
- Protects user trust
- Is operable without constant intervention

This document has higher authority than roadmaps, timelines, or launch pressure.

---

## Core Release Gate

IronScout v1 may ship only if:

> A user cannot reasonably experience behavior that contradicts `00_public_promises.md`.

All criteria below exist to enforce this rule.

---

## Data Integrity & Visibility

### Required

- Canonical product grouping is stable and deterministic
- Prices shown to users are tied to a specific source and timestamp
- Historical price context is derived from stored data, not inference
- Blocked or ineligible dealers never appear in:
  - search results
  - alerts
  - watchlists
  - direct product views

### Must Not Ship If

- Dealers can appear after being blocked or suspended
- Duplicate SKUs fragment canonical groupings
- Price history is missing without explanation
- Users can see inventory they should not be eligible to see

---

## Subscription & Tier Enforcement

### Required

- Subscription tier is enforced server-side
- Premium features cannot be accessed by manipulating the client
- Tier limits affect data shape, not just UI visibility
- Expired subscriptions correctly transition through grace states
- Blocked subscriptions result in loss of access where defined

### Must Not Ship If

- Premium behavior is only hidden in the UI
- Tier logic is duplicated inconsistently across services
- Admin impersonation bypasses subscription enforcement
- Dealers receive visibility or context while suspended

---

## Dealer Ingestion & Harvester Behavior

### Required

- Feed ingestion respects dealer eligibility and subscription status
- SKIPPED feeds do not produce downstream effects
- Ingestion jobs are idempotent
- Duplicate scheduling cannot produce duplicate writes
- Broken feeds can be quarantined without system-wide impact

### Must Not Ship If

- Multiple harvester instances can double-ingest
- SKIPPED feeds still generate benchmarks or alerts
- Manual intervention is required to stop bad data propagation

---

## AI Usage & Language Safety

### Required

- AI output is treated as assistive, not authoritative
- AI-generated text uses conservative language
- No AI output implies certainty, optimality, or correctness
- AI explanations degrade gracefully when data is weak

### Must Not Ship If

- AI language reads as advice or recommendation
- AI output contradicts data constraints
- AI confidence exceeds data quality

---

## UI & Copy Consistency

### Required

- UI language matches `00_public_promises.md`
- No screen implies guarantees not enforced by the system
- “Coming soon” features are hidden from paying users
- Error and empty states are honest and conservative

### Must Not Ship If

- Marketing language exceeds enforced behavior
- Disabled features are visible as promises
- Usage-based billing UI is exposed prematurely

---

## Operations & Recoverability

### Required

- System can be deployed and rolled back safely
- Core services can be monitored with basic signals
- Known failure modes have documented runbooks
- Critical issues can be diagnosed without code changes
- Admin actions are audited

### Must Not Ship If

- Recovery depends on undocumented tribal knowledge
- Admin actions leave no audit trail
- Critical failures require direct database manipulation

---

## Security & Trust Boundaries

### Required

- User and dealer data is correctly isolated
- Cross-account access is not possible
- Sensitive actions require explicit authorization
- Secrets are not exposed via logs or UI

### Must Not Ship If

- One dealer can see another dealer’s data
- Admin privileges can be escalated accidentally
- Sensitive configuration is accessible client-side

---

## Pre-Launch Checklist (Minimal)

Before shipping v1, confirm:

- [ ] All public copy reviewed against `00_public_promises.md`
- [ ] All v1 features verified against `02_v1_scope_and_cut_list.md`
- [ ] Tier enforcement verified via direct API access
- [ ] Dealer suspension tested end-to-end
- [ ] Harvester duplication tested under concurrency
- [ ] At least one full rollback completed successfully

---

## Change Control

If any release criterion must be relaxed:
- The change must be explicit
- The risk must be documented
- Public promises must be adjusted first

Silent relaxation is not allowed.

---

## Guiding Principle

> Shipping is a trust event.  
> If trust cannot be enforced, the product is not ready.
