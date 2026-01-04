import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  premiumEnabled,
  paywallEnabled,
  premiumApiEnabled,
  stripeEnabled,
  getEffectiveTier,
  requirePremiumApi,
} from '../features'

describe('Feature Flags', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Reset env before each test
    vi.resetModules()
  })

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv }
  })

  describe('premiumEnabled()', () => {
    it('returns false by default (no env var set)', () => {
      delete process.env.FEATURE_PREMIUM_ENABLED
      expect(premiumEnabled()).toBe(false)
    })

    it('returns false when FEATURE_PREMIUM_ENABLED is "false"', () => {
      process.env.FEATURE_PREMIUM_ENABLED = 'false'
      expect(premiumEnabled()).toBe(false)
    })

    it('returns true when FEATURE_PREMIUM_ENABLED is "true"', () => {
      process.env.FEATURE_PREMIUM_ENABLED = 'true'
      expect(premiumEnabled()).toBe(true)
    })

    it('returns true when FEATURE_PREMIUM_ENABLED is "1"', () => {
      process.env.FEATURE_PREMIUM_ENABLED = '1'
      expect(premiumEnabled()).toBe(true)
    })
  })

  describe('paywallEnabled()', () => {
    it('returns false when premium is disabled', () => {
      process.env.FEATURE_PREMIUM_ENABLED = 'false'
      process.env.FEATURE_PAYWALL_ENABLED = 'true'
      expect(paywallEnabled()).toBe(false)
    })

    it('returns true when premium is enabled and paywall flag is not set', () => {
      process.env.FEATURE_PREMIUM_ENABLED = 'true'
      delete process.env.FEATURE_PAYWALL_ENABLED
      expect(paywallEnabled()).toBe(true)
    })
  })

  describe('premiumApiEnabled()', () => {
    it('returns false when premium is disabled', () => {
      process.env.FEATURE_PREMIUM_ENABLED = 'false'
      expect(premiumApiEnabled()).toBe(false)
    })

    it('returns true when premium is enabled', () => {
      process.env.FEATURE_PREMIUM_ENABLED = 'true'
      expect(premiumApiEnabled()).toBe(true)
    })
  })

  describe('stripeEnabled()', () => {
    it('returns false when premium is disabled even if Stripe keys are set', () => {
      process.env.FEATURE_PREMIUM_ENABLED = 'false'
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_xxx'
      expect(stripeEnabled()).toBe(false)
    })

    it('returns false when premium is enabled but Stripe keys are missing', () => {
      process.env.FEATURE_PREMIUM_ENABLED = 'true'
      delete process.env.STRIPE_SECRET_KEY
      delete process.env.STRIPE_WEBHOOK_SECRET
      expect(stripeEnabled()).toBe(false)
    })

    it('returns true when premium is enabled and Stripe keys are set', () => {
      process.env.FEATURE_PREMIUM_ENABLED = 'true'
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_xxx'
      expect(stripeEnabled()).toBe(true)
    })
  })

  describe('getEffectiveTier()', () => {
    it('returns FREE when premium is disabled regardless of actual tier', () => {
      process.env.FEATURE_PREMIUM_ENABLED = 'false'
      expect(getEffectiveTier('PREMIUM')).toBe('FREE')
      expect(getEffectiveTier('FREE')).toBe('FREE')
    })

    it('returns actual tier when premium is enabled', () => {
      process.env.FEATURE_PREMIUM_ENABLED = 'true'
      expect(getEffectiveTier('PREMIUM')).toBe('PREMIUM')
      expect(getEffectiveTier('FREE')).toBe('FREE')
    })

    it('treats unknown tiers as FREE', () => {
      process.env.FEATURE_PREMIUM_ENABLED = 'true'
      expect(getEffectiveTier('UNKNOWN')).toBe('FREE')
    })
  })

  describe('requirePremiumApi() middleware', () => {
    it('returns 404 when premium API is disabled', () => {
      process.env.FEATURE_PREMIUM_ENABLED = 'false'

      const middleware = requirePremiumApi()
      const mockReq = {}
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }
      const mockNext = vi.fn()

      middleware(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Not found' })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('calls next() when premium API is enabled', () => {
      process.env.FEATURE_PREMIUM_ENABLED = 'true'

      const middleware = requirePremiumApi()
      const mockReq = {}
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }
      const mockNext = vi.fn()

      middleware(mockReq, mockRes, mockNext)

      expect(mockRes.status).not.toHaveBeenCalled()
      expect(mockNext).toHaveBeenCalled()
    })
  })
})

describe('Premium Disabled Behavior', () => {
  beforeEach(() => {
    process.env.FEATURE_PREMIUM_ENABLED = 'false'
  })

  afterEach(() => {
    delete process.env.FEATURE_PREMIUM_ENABLED
  })

  it('should not allow checkout session creation when premium disabled', async () => {
    // This verifies the requirePremiumApi middleware blocks the route
    expect(premiumApiEnabled()).toBe(false)

    const middleware = requirePremiumApi()
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    }
    const mockNext = vi.fn()

    middleware({}, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(404)
    expect(mockNext).not.toHaveBeenCalled()
  })

  it('should force all users to FREE tier when premium disabled', () => {
    expect(getEffectiveTier('PREMIUM')).toBe('FREE')
  })
})
