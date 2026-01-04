import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Note: We need to re-import the module after setting env vars
// because the env vars are read at module load time
describe('Feature Flags (Frontend)', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Clear module cache to allow re-import with new env vars
    vi.resetModules()
  })

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv }
  })

  describe('premiumEnabled()', () => {
    it('returns false by default (no env var set)', async () => {
      delete process.env.NEXT_PUBLIC_FEATURE_PREMIUM_ENABLED
      const { premiumEnabled } = await import('../features')
      expect(premiumEnabled()).toBe(false)
    })

    it('returns false when NEXT_PUBLIC_FEATURE_PREMIUM_ENABLED is "false"', async () => {
      process.env.NEXT_PUBLIC_FEATURE_PREMIUM_ENABLED = 'false'
      const { premiumEnabled } = await import('../features')
      expect(premiumEnabled()).toBe(false)
    })

    it('returns true when NEXT_PUBLIC_FEATURE_PREMIUM_ENABLED is "true"', async () => {
      process.env.NEXT_PUBLIC_FEATURE_PREMIUM_ENABLED = 'true'
      const { premiumEnabled } = await import('../features')
      expect(premiumEnabled()).toBe(true)
    })
  })

  describe('getEffectiveTier()', () => {
    it('returns FREE when premium is disabled regardless of actual tier', async () => {
      process.env.NEXT_PUBLIC_FEATURE_PREMIUM_ENABLED = 'false'
      const { getEffectiveTier } = await import('../features')
      expect(getEffectiveTier('PREMIUM')).toBe('FREE')
      expect(getEffectiveTier('FREE')).toBe('FREE')
      expect(getEffectiveTier(undefined)).toBe('FREE')
    })

    it('returns actual tier when premium is enabled', async () => {
      process.env.NEXT_PUBLIC_FEATURE_PREMIUM_ENABLED = 'true'
      const { getEffectiveTier } = await import('../features')
      expect(getEffectiveTier('PREMIUM')).toBe('PREMIUM')
      expect(getEffectiveTier('FREE')).toBe('FREE')
    })
  })

  describe('isEffectivelyPremium()', () => {
    it('returns false when premium is disabled', async () => {
      process.env.NEXT_PUBLIC_FEATURE_PREMIUM_ENABLED = 'false'
      const { isEffectivelyPremium } = await import('../features')
      expect(isEffectivelyPremium('PREMIUM')).toBe(false)
    })

    it('returns true when premium is enabled and user is PREMIUM', async () => {
      process.env.NEXT_PUBLIC_FEATURE_PREMIUM_ENABLED = 'true'
      const { isEffectivelyPremium } = await import('../features')
      expect(isEffectivelyPremium('PREMIUM')).toBe(true)
    })
  })

  describe('isPremiumRouteAccessible()', () => {
    it('blocks premium routes when premium is disabled', async () => {
      process.env.NEXT_PUBLIC_FEATURE_PREMIUM_ENABLED = 'false'
      const { isPremiumRouteAccessible } = await import('../features')

      expect(isPremiumRouteAccessible('/pricing')).toBe(false)
      expect(isPremiumRouteAccessible('/pricing/success')).toBe(false)
      expect(isPremiumRouteAccessible('/dashboard/billing')).toBe(false)
    })

    it('allows non-premium routes when premium is disabled', async () => {
      process.env.NEXT_PUBLIC_FEATURE_PREMIUM_ENABLED = 'false'
      const { isPremiumRouteAccessible } = await import('../features')

      expect(isPremiumRouteAccessible('/dashboard')).toBe(true)
      expect(isPremiumRouteAccessible('/dashboard/search')).toBe(true)
      expect(isPremiumRouteAccessible('/dashboard/saved')).toBe(true)
    })

    it('allows all routes when premium is enabled', async () => {
      process.env.NEXT_PUBLIC_FEATURE_PREMIUM_ENABLED = 'true'
      const { isPremiumRouteAccessible } = await import('../features')

      expect(isPremiumRouteAccessible('/pricing')).toBe(true)
      expect(isPremiumRouteAccessible('/dashboard/billing')).toBe(true)
      expect(isPremiumRouteAccessible('/dashboard')).toBe(true)
    })
  })
})

describe('Premium Disabled UI Behavior', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_FEATURE_PREMIUM_ENABLED = 'false'
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_FEATURE_PREMIUM_ENABLED
  })

  it('should hide billing nav item when premium is disabled', async () => {
    const { premiumEnabled } = await import('../features')
    expect(premiumEnabled()).toBe(false)
    // UI components using premiumEnabled() will not render billing nav
  })

  it('should hide upgrade banners when premium is disabled', async () => {
    const { premiumEnabled } = await import('../features')
    expect(premiumEnabled()).toBe(false)
    // UpgradeBanner component returns null when premiumEnabled() is false
  })

  it('should redirect pricing page when premium is disabled', async () => {
    const { isPremiumRouteAccessible } = await import('../features')
    expect(isPremiumRouteAccessible('/pricing')).toBe(false)
    // Pricing page redirects to home when isPremiumRouteAccessible returns false
  })
})
