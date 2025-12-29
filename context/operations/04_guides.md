# Guides

This document defines **operational guides** for IronScout v1.

Guides answer the question:
> “How do I do this safely?”

They are distinct from runbooks:
- **Runbooks** = incident response
- **Guides** = routine operations and debugging

If a task is expected to be performed more than once, it belongs in a guide.

---

## Purpose of Guides

Guides exist to:
- Reduce reliance on memory
- Enable safe, repeatable actions
- Support a small team operating under load
- Prevent common mistakes

Guides prioritize **clarity and safety** over speed.

---

## Guide Principles

All guides must:
- Be step-by-step
- State prerequisites clearly
- Call out irreversible actions
- Include verification steps
- Favor “do no harm” defaults

If a step feels risky, it must be documented.

---

## Guide Index (v1)

The following guides are required for v1 operations.

---

### Guide: Affiliate Feeds Go-Live

**Purpose**
- Safely enable and validate the affiliate feed pipeline.

**Docs**
- `context/operations/affiliate-feeds-go-live.md`
- Verification SQL: `context/operations/affiliate_feeds_verify.sql`

---

### Guide: Debugging a Broken Dealer Feed

**When to use**
- Dealer reports missing or incorrect inventory
- Ingestion errors appear for a dealer feed

**Steps**
1. Open Admin app → Dealer → Feeds
2. Identify feed status and last execution
3. Inspect execution logs and error summaries
4. Determine if issue is format, connectivity, or mapping
5. Quarantine feed if data integrity is at risk
6. Notify dealer of issue and next steps

**Verification**
- Feed no longer propagates bad data
- No downstream benchmarks or alerts run

---

### Guide: Quarantining a Feed Safely

**When to use**
- Feed produces malformed or dangerous data
- Duplicate or corrupt ingestion detected

**Steps**
1. Pause or disable the feed in Admin app
2. Confirm feed state is QUARANTINED
3. Verify no new executions are scheduled
4. Confirm API no longer surfaces affected data

**Verification**
- Consumer search excludes affected inventory
- Alerts do not trigger from feed data

---

### Guide: Verifying Dealer Eligibility Enforcement

**When to use**
- Dealer subscription changes
- Visibility-related incidents

**Steps**
1. Check dealer subscription status
2. Confirm feed health
3. Verify API search results exclude dealer when ineligible
4. Verify alerts are suppressed

**Verification**
- Dealer inventory is not visible in any consumer path

---

### Guide: Validating Tier Enforcement

**When to use**
- New feature deployment
- Pricing or tier changes

**Steps**
1. Test endpoint access as Free user
2. Test endpoint access as Premium user
3. Inspect API responses directly
4. Confirm UI reflects server-shaped data

**Verification**
- No Premium-only fields appear for Free users

---

### Guide: Investigating Unexpected Alert Behavior

**When to use**
- Duplicate alerts
- Alerts firing incorrectly

**Steps**
1. Identify alert definition and owner
2. Inspect evaluation logs
3. Confirm dealer eligibility at trigger time
4. Check deduplication keys

**Verification**
- Alerts behave deterministically on re-evaluation

---

### Guide: Safe Feature Flag Use

**When to use**
- Temporarily disabling features
- Testing risky changes

**Steps**
1. Confirm flag scope and environment
2. Disable flag in staging first
3. Monitor for side effects
4. Apply to production if safe

**Verification**
- Feature behavior changes without breaking core flows

---

## Writing New Guides

When adding a guide:
- Name it by task, not system
- Assume the operator is tired
- Assume mistakes are easy to make
- Include “how to verify” explicitly

Guides should prevent incidents, not just respond to them.

---

## Non-Negotiables

- No undocumented operational tasks
- No reliance on tribal knowledge
- No “just do X in prod” instructions

---

## Guiding Principle

> Guides exist so operators don’t have to think under pressure.
