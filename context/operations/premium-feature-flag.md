# Premium Feature Flag

> **Status:** Premium features are currently **disabled** by default.
>
> This document explains how the premium feature flag works and how to re-enable premium when ready.

## Overview

IronScout uses a feature flag system to soft-disable all premium features. This allows:
- Clean user acquisition experience without premium references
- Easy re-enablement with a single config change
- No code deletion - all premium code remains in place
- Stripe integration preserved but gated

## Environment Variables

### Backend (apps/api)

```bash
# Master switch - controls all premium functionality
FEATURE_PREMIUM_ENABLED=false   # Default: false in production

# Optional granular overrides (inherit from master if not set)
FEATURE_PAYWALL_ENABLED=true    # Controls paywall endpoints
FEATURE_PREMIUM_API_ENABLED=true # Controls premium API endpoints
```

### Frontend (apps/web)

```bash
# Client-side master switch - must match backend setting
NEXT_PUBLIC_FEATURE_PREMIUM_ENABLED=false   # Default: false
NEXT_PUBLIC_FEATURE_PAYWALL_ENABLED=true    # Optional override
```

## What Gets Gated

### When Premium is DISABLED (default)

**Backend:**
- `POST /api/payments/create-checkout` → returns 404
- `POST /api/payments/merchant/create-checkout` → returns 404
- `POST /api/payments/merchant/create-portal-session` → returns 404
- `GET /api/payments/plans` → returns 404
- `GET /api/payments/merchant/plans` → returns 404
- Webhook handler verifies signature but skips all side effects
- `getTierConfig()` returns FREE tier config for all users
- `getEffectiveTier('PREMIUM')` returns `'FREE'`

**Frontend:**
- `/pricing` → redirects to `/`
- `/pricing/success` → redirects to `/`
- `/dashboard/billing` → redirects to `/dashboard`
- Sidebar: "Billing" nav item hidden
- Sidebar: Tier badges (Premium/Free) hidden
- `<UpgradeBanner>` → renders nothing
- `<PremiumPrompt>` → renders nothing
- All upgrade CTAs hidden

### When Premium is ENABLED

All features work normally:
- Checkout endpoints active
- Billing portal accessible
- Webhooks process normally and update entitlements
- Premium tier features available
- Upgrade UI visible

## Re-Enable Premium Runbook

### Prerequisites

1. Stripe account configured
2. Stripe products and prices created
3. Webhook endpoint registered in Stripe Dashboard

### Steps

1. **Set Backend Environment Variables:**
   ```bash
   FEATURE_PREMIUM_ENABLED=true
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_ID_PREMIUM_MONTHLY=price_...
   STRIPE_PRICE_ID_PREMIUM_ANNUALLY=price_...
   ```

2. **Set Frontend Environment Variables:**
   ```bash
   NEXT_PUBLIC_FEATURE_PREMIUM_ENABLED=true
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   ```

3. **Deploy:**
   - Deploy API with new environment variables
   - Deploy Web app with new environment variables
   - Verify health check: `GET /api/payments/health`

4. **Verify:**
   - [ ] `/pricing` page loads
   - [ ] Checkout flow works
   - [ ] Billing portal accessible
   - [ ] Premium badge shows for upgraded users
   - [ ] Tier features work correctly

## Testing Premium Flag

### With Flag OFF (default):
```bash
# Verify no premium UI
curl http://localhost:3000/pricing
# Should redirect to /

# Verify endpoints return 404
curl http://localhost:8000/api/payments/plans
# Should return { "error": "Not found" }

# Verify tier config
# All users should see FREE tier limits
```

### With Flag ON:
```bash
# Set env vars
export FEATURE_PREMIUM_ENABLED=true
export NEXT_PUBLIC_FEATURE_PREMIUM_ENABLED=true

# Verify pricing page loads
curl http://localhost:3000/pricing
# Should return pricing page HTML

# Verify plans endpoint
curl http://localhost:8000/api/payments/plans
# Should return plans JSON
```

## Code Locations

### Features Module
- **Backend:** `apps/api/src/lib/features.ts`
- **Frontend:** `apps/web/lib/features.ts`

### Gated Components
- `apps/web/components/layout/sidebar-nav.tsx` - Billing nav item
- `apps/web/components/premium/upgrade-banner.tsx` - Upgrade banners
- `apps/web/components/dashboard/organisms/premium-prompt.tsx` - Dashboard prompt

### Gated Routes
- `apps/web/app/pricing/page.tsx`
- `apps/web/app/pricing/success/page.tsx`
- `apps/web/app/dashboard/billing/page.tsx`

### Gated Endpoints
- `apps/api/src/routes/payments.ts` - All checkout/billing endpoints

### Tier Logic
- `apps/api/src/config/tiers.ts` - Uses `getEffectiveTier()` for config

## Troubleshooting

### Premium UI Still Showing

1. Check `NEXT_PUBLIC_FEATURE_PREMIUM_ENABLED` is `false`
2. Rebuild the web app (env vars are baked at build time)
3. Clear browser cache

### Checkout Still Working

1. Check `FEATURE_PREMIUM_ENABLED` is `false` on API server
2. Restart API server
3. Verify with health check

### Webhooks Failing

Webhooks should still verify signatures even when premium is disabled.
Check logs for `webhook_premium_disabled` action - this indicates correct behavior.

## Related ADRs

- ADR-002: Server-side tier enforcement
- ADR-007: Premium information density
