# Brand Alias Pub/Sub - Post-Launch Follow-ups

These issues should be created after merging the brand-alias cache invalidation feature.

---

## Issue 1: Add pub/sub health metrics to harvester /health endpoint

**Labels:** tech-debt, observability
**Timeline:** 1 week post-launch

### Context
Post-launch follow-up from brand-aliases cache invalidation implementation.

### Problem
Currently we only have logs for Redis pub/sub health, no dashboard metrics. This makes it harder to monitor pub/sub health proactively.

### Proposed Solution
Add to harvester `/health` endpoint:
- `pubsub.connected: boolean`
- `pubsub.lastMessageAt: timestamp | null`
- `pubsub.subscriptionActive: boolean`

### Acceptance Criteria
- [ ] Health endpoint includes pub/sub status
- [ ] Grafana dashboard updated with pub/sub panel
- [ ] Alert rule for subscription down > 5 minutes

---

## Issue 2: Extract BRAND_ALIAS_INVALIDATE_CHANNEL to shared constants

**Labels:** tech-debt
**Timeline:** 2 weeks post-launch

### Context
Post-launch follow-up from brand-aliases cache invalidation implementation.

### Problem
The channel name `brand-alias:invalidate` is defined independently in two places:
- `apps/admin/lib/queue.ts:29`
- `apps/harvester/src/resolver/brand-alias-cache.ts:45`

If one changes without the other, pub/sub silently fails (falls back to 60s periodic refresh).

### Proposed Solution
Create `packages/constants` or add to `@ironscout/db`:
```typescript
export const BRAND_ALIAS_INVALIDATE_CHANNEL = 'brand-alias:invalidate'
```

Import from shared package in both admin and harvester.

### Acceptance Criteria
- [ ] Single source of truth for channel name
- [ ] Both apps import from shared package
- [ ] TypeScript compile error if channel name missing

---

## Issue 3: Add runbook entry for cache invalidation debugging

**Labels:** documentation, on-call
**Timeline:** Before next on-call rotation

### Context
Post-launch follow-up from brand-aliases cache invalidation implementation.

### Problem
On-call needs documentation for debugging "aliases not updating" scenarios.

### Proposed Runbook Entry

**Symptom:** Brand alias activated in admin but not applied to products

**Debug Steps:**
1. Check harvester logs for `Received cache invalidation` - if missing, pub/sub issue
2. Check harvester logs for `Brand alias cache refreshed` - verify aliasCount
3. Check Redis connectivity: `redis-cli PUBSUB CHANNELS "brand-alias:*"`
4. Check feature flag: `RESOLVER_BRAND_ALIASES_ENABLED` must be `true`
5. Force refresh: Restart harvester or wait for periodic refresh (60s max)

**Mitigation:**
- Pub/sub failure is non-critical; periodic refresh is fallback
- If Redis down, aliases still work with 60s staleness max

### Acceptance Criteria
- [ ] Runbook entry added to ops documentation
- [ ] On-call team reviewed and acknowledged

---

## Issue 4: Known Risk - Double subscribe on initial connect (Won't Fix)

**Labels:** wontfix, documentation
**Timeline:** N/A - documenting accepted risk

### Context
The `ready` event fires on initial Redis connect, causing a duplicate `subscribe()` call.

### Why It's Acceptable
- Redis `SUBSCRIBE` is idempotent - duplicate calls are no-ops
- No functional impact
- Adding a "first connect" flag adds complexity for no benefit

### Decision
Accept this behavior. Document in code comments (already done).

**No action required - closing as won't fix.**
