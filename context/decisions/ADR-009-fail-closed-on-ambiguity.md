# ADR-009: Fail Closed on Eligibility, Tier, and Trust Ambiguity

## Status
Accepted

## Context
Ambiguous state can arise from failures or delays.

## Decision
When state is ambiguous, IronScout fails closed: restrict access and visibility.

## Alternatives Considered
- Fail open
- Partial access

## Consequences
Strong trust guarantees with occasional temporary restriction.

## Notes
Underpins enforcement logic across the system.
