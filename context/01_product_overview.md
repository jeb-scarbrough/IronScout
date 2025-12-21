# Product Overview

IronScout is an AI-native discovery and pricing intelligence platform for ammunition.

It exists because ammunition listings are fragmented, inconsistent, and noisy. “Lowest price” alone is rarely enough to make a good buying decision. IronScout combines cleaner product understanding with historical context so users can evaluate offers faster and with more confidence.

This document describes what IronScout is, what it is not, and the product principles that guide v1.

---

## What IronScout Is

### A discovery layer over fragmented listings
IronScout helps users find ammunition by intent, not just keywords. It groups inconsistent listings into canonically matched products so users can compare offers on a like-for-like basis.

### A pricing context layer
IronScout shows current price and availability with historical context. Users can interpret whether a price looks typical or unusually low relative to recent history.

### A two-sided platform with different value props
- Consumers get cleaner search and clearer pricing context.
- Dealers get visibility and market context, not pricing automation.

---

## What IronScout Is Not

IronScout is not:
- A recommendation engine that decides what to buy
- A prediction service for future prices
- A guarantee of lowest price, best timing, or savings
- A dealer pricing automation product
- A compliance or legal guidance system

IronScout provides information density and context. Decisions remain with the user.

---

## Product Goals for v1

### 1) Make search feel “ammo-aware”
Users should be able to find what they want even when retailer listings are inconsistent. Results should feel grouped, comparable, and navigable without requiring expert filtering.

### 2) Make price interpretation easy
Users should be able to answer, quickly:
- What is the best price right now?
- How does this compare to recent history?
- Is this unusually low, or just normal?

v1 should deliver this without implying certainty or guarantees.

### 3) Make Premium clearly worth paying for
Premium should be an upgrade in:
- depth (more historical context)
- speed (faster alerts)
- control (advanced filters and ranking)
- clarity (AI-assisted explanations where available)

Premium must not depend on “magic.” It must feel like more signal, less noise.

### 4) Make dealer participation operationally simple
Dealers are not typically technical. v1 must support:
- straightforward feed ingestion
- predictable matching behavior
- clear visibility rules
- plan-based access to market context

Dealer value must be real without requiring deep configuration.

### 5) Protect trust as the core asset
If IronScout is wrong, it must fail safely:
- degrade language
- reduce confidence
- limit claims
- avoid presenting speculative outputs as facts

Trust is more valuable than feature breadth.

---

## Primary User Experiences

### Consumer experience (v1)
- Search for ammo with AI-assisted intent understanding
- Browse canonically matched product groups
- Compare retailer offers in a consistent view
- See price and availability with historical context
- Set alerts for price and availability changes
- Upgrade to Premium for deeper context and faster, more flexible alerts

### Dealer experience (v1)
- Connect a feed (CSV/XML/JSON)
- Ingestion normalizes and matches listings to canonical products
- Eligible inventory appears in consumer search
- Dealer can view plan-appropriate market context and benchmarks

Eligibility is based on subscription status, feed health, and platform policies.

### Admin experience (v1)
- Support impersonation for troubleshooting
- Subscription management with auditability
- Controlled overrides for operational issues
- Tools to stop or quarantine broken feeds without system-wide impact

---

## Differentiation

IronScout differentiates on:
- AI-powered intent-aware search for ammo-specific attributes
- Canonical product matching across inconsistent retailer listings
- Historical price context that changes how users interpret “a deal”
- A product philosophy of conservative claims and enforceable guarantees

IronScout does not differentiate by promising automation or certainty. It differentiates by making the market legible.

---

## Guardrails and Non-Negotiables

### Public promise ceiling
UI language and marketing must obey `00_public_promises.md`. If the system cannot enforce a claim, it cannot say it.

### Conservative phrasing
Use language like:
- “context,” “signals,” “relative to recent history”
Avoid language like:
- “guarantee,” “optimal,” “recommended,” “best time to buy”

### Tier enforcement is server-side
Premium is not a UI paywall. Premium benefits must be enforced in APIs and data shaping.

### Dealer visibility is deterministic
Blocked or ineligible dealers should not appear in consumer experiences through any path (search, alerts, watchlists, etc.).

### Operations matter
v1 must be operable by a small team. Complexity that requires constant intervention is out of scope.

---

## How v1 Should Evolve (Without Changing Promises)

As enforcement improves, IronScout can deepen:
- confidence scoring and safe degradation
- richer explanations grounded in data
- more robust alerting and personalization
- improved dealer benchmarks and segmentation

These improvements should increase usefulness without crossing into guarantees or decision-making.

---

## Guiding Principle

> IronScout makes the market easier to understand.  
> It does not decide for the user.
