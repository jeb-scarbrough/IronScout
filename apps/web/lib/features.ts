/**
 * Feature Flags Module - Client Side
 *
 * Single source of truth for feature flag evaluation on the frontend.
 * All premium-related UI decisions should use these functions.
 *
 * Environment Variables (must be prefixed with NEXT_PUBLIC_ for client access):
 * - NEXT_PUBLIC_FEATURE_PREMIUM_ENABLED: Master switch for premium features
 *
 * Re-enable Premium:
 * 1. Set NEXT_PUBLIC_FEATURE_PREMIUM_ENABLED=true
 * 2. Ensure backend FEATURE_PREMIUM_ENABLED is also true
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
 * - Hide all premium-related UI (upgrade banners, pricing links, etc.)
 * - Hide billing nav item
 * - Don't show premium tier badges
 * - Redirect premium routes to home
 *
 * Default: false (premium disabled)
 */
export function premiumEnabled(): boolean {
  return envBool('NEXT_PUBLIC_FEATURE_PREMIUM_ENABLED', false)
}

/**
 * Check if paywall-related UI should be shown.
 * Controls pricing pages, upgrade CTAs, and billing UI.
 *
 * Inherits from premiumEnabled() unless explicitly overridden.
 */
export function paywallEnabled(): boolean {
  if (!premiumEnabled()) {
    return false
  }
  return envBool('NEXT_PUBLIC_FEATURE_PAYWALL_ENABLED', true)
}

/**
 * Get the effective user tier considering feature flags.
 *
 * When premium is disabled:
 * - All users are displayed as "Free" regardless of their actual tier
 * - This ensures consistency with backend behavior
 *
 * @param actualTier - The user's tier from the session/database
 * @returns The effective tier for UI display
 */
export function getEffectiveTier(actualTier: 'FREE' | 'PREMIUM' | string | undefined): 'FREE' | 'PREMIUM' {
  if (!premiumEnabled()) {
    return 'FREE'
  }
  return actualTier === 'PREMIUM' ? 'PREMIUM' : 'FREE'
}

/**
 * Check if the user should be shown as premium.
 * Combines tier check with feature flag.
 */
export function isEffectivelyPremium(actualTier: 'FREE' | 'PREMIUM' | string | undefined): boolean {
  return getEffectiveTier(actualTier) === 'PREMIUM'
}

/**
 * Routes that should redirect to home when premium is disabled
 */
export const PREMIUM_ROUTES = [
  '/pricing',
  '/pricing/success',
  '/dashboard/billing',
]

/**
 * Check if a route should be accessible based on premium status
 */
export function isPremiumRouteAccessible(pathname: string): boolean {
  if (premiumEnabled()) {
    return true
  }
  return !PREMIUM_ROUTES.some(route => pathname.startsWith(route))
}
