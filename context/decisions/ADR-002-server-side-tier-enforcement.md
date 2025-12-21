# ADR-002: Server-Side Tier and Eligibility Enforcement

## Status
Accepted

## Context

IronScout offers multiple consumer and dealer tiers with different access levels.  
Early implementations included client-provided signals (e.g. headers) to infer tier or identity.

Relying on client-provided context creates:
- security vulnerabilities
- inconsistent enforcement
- trust violations
- difficulty auditing access

Tier and eligibility enforcement are trust-critical paths.

## Decision

All tier and eligibility enforcement in IronScout must be **server-side and authoritative**.

Specifically:
- Tier is resolved from verified authentication context only
- Dealer eligibility is enforced at query time
- UI hiding alone is not sufficient
- Ambiguous state defaults to restricted access

No API endpoint may trust client-provided tier or eligibility indicators.

## Alternatives Considered

### Client-Side Enforcement
- Pros: Simpler UI logic
- Cons: Unsafe, bypassable, not auditable

### Hybrid Enforcement
- Pros: Reduces some server work
- Cons: Still vulnerable, inconsistent, harder to reason about

## Consequences

### Positive
- Deterministic enforcement
- Stronger trust guarantees
- Clear auditability
- Reduced attack surface

### Negative
- Slightly increased server complexity
- Requires consistent enforcement across services

This decision is foundational and non-negotiable.

## Notes

This ADR underpins:
- pricing and tier guarantees
- dealer visibility rules
- admin impersonation boundaries
