/**
 * Feature Flags Module - Server Side
 *
 * Single source of truth for feature flag evaluation on the backend.
 * All premium-related feature checks should use these functions.
 *
 * Environment Variables:
 * - FEATURE_PREMIUM_ENABLED: Master switch for premium features (default: false in production)
 * - FEATURE_PAYWALL_ENABLED: Controls paywall UI/endpoints (inherits from FEATURE_PREMIUM_ENABLED)
 * - FEATURE_PREMIUM_API_ENABLED: Controls premium API endpoints (inherits from FEATURE_PREMIUM_ENABLED)
 *
 * Re-enable Premium:
 * 1. Set FEATURE_PREMIUM_ENABLED=true
 * 2. Ensure STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET are configured
 * 3. Deploy
 */

/**
 * Helper to parse boolean env var with default
 */
function envBool(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key]
  if (value === undefined || value === '') {
    return defaultValue
  }
  return value.toLowerCase() === 'true' || value === '1'
}

/**
 * Check if premium features are enabled globally.
 *
 * When false:
 * - All users are treated as FREE tier for feature access
 * - Premium checkout/billing endpoints return 404
 * - Stripe checkout session creation is blocked
 * - Webhook side effects are short-circuited
 *
 * Default: false in production, can be true in development
 */
export function premiumEnabled(): boolean {
  // Default to false (premium disabled) unless explicitly enabled
  return envBool('FEATURE_PREMIUM_ENABLED', false)
}

/**
 * Check if paywall-related features are enabled.
 * Controls pricing pages, upgrade CTAs, and billing UI.
 *
 * Inherits from premiumEnabled() unless explicitly overridden.
 */
export function paywallEnabled(): boolean {
  if (!premiumEnabled()) {
    return false
  }
  return envBool('FEATURE_PAYWALL_ENABLED', true)
}

/**
 * Check if premium API endpoints are enabled.
 * Controls checkout, billing portal, subscription management endpoints.
 *
 * Inherits from premiumEnabled() unless explicitly overridden.
 */
export function premiumApiEnabled(): boolean {
  if (!premiumEnabled()) {
    return false
  }
  return envBool('FEATURE_PREMIUM_API_ENABLED', true)
}

/**
 * Check if Stripe integration is active.
 * Returns false if:
 * - Premium is disabled
 * - Stripe keys are not configured
 */
export function stripeEnabled(): boolean {
  if (!premiumEnabled()) {
    return false
  }
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)
}

/**
 * Get the effective user tier considering feature flags.
 *
 * When premium is disabled:
 * - All users are treated as FREE regardless of their database tier
 * - This ensures no premium features are accessible
 *
 * @param actualTier - The user's tier from the database
 * @returns The effective tier for feature access
 */
export function getEffectiveTier(actualTier: 'FREE' | 'PREMIUM' | string): 'FREE' | 'PREMIUM' {
  if (!premiumEnabled()) {
    // Force everyone to FREE when premium is disabled
    return 'FREE'
  }
  return actualTier === 'PREMIUM' ? 'PREMIUM' : 'FREE'
}

/**
 * Express middleware to block requests when premium API is disabled.
 * Returns 404 to avoid revealing the existence of premium features.
 */
export function requirePremiumApi() {
  return (req: any, res: any, next: any) => {
    if (!premiumApiEnabled()) {
      return res.status(404).json({ error: 'Not found' })
    }
    next()
  }
}

/**
 * Log feature flag status on startup
 */
export function logFeatureStatus(): void {
  console.log('[Features] Premium enabled:', premiumEnabled())
  console.log('[Features] Paywall enabled:', paywallEnabled())
  console.log('[Features] Premium API enabled:', premiumApiEnabled())
  console.log('[Features] Stripe enabled:', stripeEnabled())
}
