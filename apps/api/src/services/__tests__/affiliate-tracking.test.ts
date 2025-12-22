import { describe, it, expect } from 'vitest'
import {
  buildTrackingUrl,
  extractAffiliateContext,
  validateTrackingTemplate,
  type AffiliateContext,
} from '../affiliate-tracking'

describe('buildTrackingUrl', () => {
  const productUrl = 'https://retailer.com/product/123?sku=abc'

  const baseContext: AffiliateContext = {
    affiliateNetwork: null,
    affiliateProgramId: null,
    affiliateAdvertiserId: null,
    affiliateCampaignId: null,
    affiliateTrackingTemplate: null,
  }

  describe('when no template configured', () => {
    it('returns the original URL unchanged', () => {
      const context: AffiliateContext = {
        ...baseContext,
        affiliateNetwork: null,
      }

      const result = buildTrackingUrl(productUrl, context)
      expect(result.url).toBe(productUrl)
      expect(result.warning).toBeUndefined()
    })

    it('handles empty template string', () => {
      const context: AffiliateContext = {
        ...baseContext,
        affiliateTrackingTemplate: '',
      }

      // Empty string is falsy, returns original
      const result = buildTrackingUrl(productUrl, context)
      expect(result.url).toBe(productUrl)
    })

    it('warns when network is set but no template', () => {
      const context: AffiliateContext = {
        ...baseContext,
        affiliateNetwork: 'IMPACT',
        affiliateTrackingTemplate: null,
      }

      const result = buildTrackingUrl(productUrl, context)
      expect(result.url).toBe(productUrl)
      expect(result.warning).toBe(
        'Affiliate network IMPACT configured but no tracking template set'
      )
    })
  })

  describe('Impact network template', () => {
    it('substitutes all placeholders correctly', () => {
      const context: AffiliateContext = {
        affiliateNetwork: 'IMPACT',
        affiliateProgramId: 'prog789',
        affiliateAdvertiserId: 'adv123',
        affiliateCampaignId: 'camp456',
        affiliateTrackingTemplate:
          'https://track.impact.com/c/{CAMPAIGN_ID}/a/{ADVERTISER_ID}?url={PRODUCT_URL}',
      }

      const result = buildTrackingUrl(productUrl, context)

      expect(result.url).toBe(
        'https://track.impact.com/c/camp456/a/adv123?url=https%3A%2F%2Fretailer.com%2Fproduct%2F123%3Fsku%3Dabc'
      )
      expect(result.warning).toBeUndefined()
    })

    it('URL-encodes the product URL in {PRODUCT_URL}', () => {
      const context: AffiliateContext = {
        ...baseContext,
        affiliateTrackingTemplate: 'https://track.example.com?url={PRODUCT_URL}',
      }

      const urlWithSpecialChars = 'https://example.com/path?a=1&b=2'
      const result = buildTrackingUrl(urlWithSpecialChars, context)

      expect(result.url).toBe(
        'https://track.example.com?url=https%3A%2F%2Fexample.com%2Fpath%3Fa%3D1%26b%3D2'
      )
    })

    it('does not encode {PRODUCT_URL_RAW}', () => {
      const context: AffiliateContext = {
        ...baseContext,
        affiliateTrackingTemplate: 'https://track.example.com?url={PRODUCT_URL_RAW}',
      }

      const result = buildTrackingUrl(productUrl, context)

      expect(result.url).toBe(`https://track.example.com?url=${productUrl}`)
    })

    it('substitutes {PROGRAM_ID} placeholder', () => {
      const context: AffiliateContext = {
        ...baseContext,
        affiliateProgramId: 'partner123',
        affiliateTrackingTemplate:
          'https://track.example.com/p/{PROGRAM_ID}?url={PRODUCT_URL}',
      }

      const result = buildTrackingUrl(productUrl, context)

      expect(result.url).toContain('/p/partner123?')
    })
  })

  describe('AvantLink network template', () => {
    it('handles AvantLink-style templates', () => {
      const context: AffiliateContext = {
        ...baseContext,
        affiliateNetwork: 'AVANTLINK',
        affiliateAdvertiserId: 'merchant789',
        affiliateTrackingTemplate:
          'https://www.avantlink.com/click.php?p={ADVERTISER_ID}&url={PRODUCT_URL}',
      }

      const result = buildTrackingUrl(productUrl, context)

      expect(result.url).toContain('p=merchant789')
      expect(result.url).toContain('url=https%3A%2F%2F')
    })
  })

  describe('ShareASale network template', () => {
    it('handles ShareASale-style templates', () => {
      const context: AffiliateContext = {
        ...baseContext,
        affiliateNetwork: 'SHAREASALE',
        affiliateAdvertiserId: 'sas123',
        affiliateTrackingTemplate:
          'https://shareasale.com/r.cfm?b={ADVERTISER_ID}&u=affid&m=12345&urllink={PRODUCT_URL}',
      }

      const result = buildTrackingUrl(productUrl, context)

      expect(result.url).toContain('b=sas123')
      expect(result.url).toContain('urllink=https%3A%2F%2F')
    })
  })

  describe('edge cases', () => {
    it('handles null advertiser, program, and campaign IDs', () => {
      const context: AffiliateContext = {
        ...baseContext,
        affiliateTrackingTemplate:
          'https://track.example.com/p/{PROGRAM_ID}/a/{ADVERTISER_ID}/c/{CAMPAIGN_ID}?url={PRODUCT_URL}',
      }

      const result = buildTrackingUrl(productUrl, context)

      // Empty strings where nulls were
      expect(result.url).toBe(
        `https://track.example.com/p//a//c/?url=${encodeURIComponent(productUrl)}`
      )
    })

    it('handles multiple occurrences of same placeholder', () => {
      const context: AffiliateContext = {
        ...baseContext,
        affiliateAdvertiserId: 'adv123',
        affiliateTrackingTemplate:
          'https://example.com/{ADVERTISER_ID}/track/{ADVERTISER_ID}?url={PRODUCT_URL}',
      }

      const result = buildTrackingUrl(productUrl, context)

      expect(result.url).toContain('/adv123/track/adv123?')
    })

    it('preserves template text that is not a placeholder', () => {
      const context: AffiliateContext = {
        ...baseContext,
        affiliateAdvertiserId: 'adv123',
        affiliateTrackingTemplate:
          'https://example.com/static/path?aid={ADVERTISER_ID}&extra=value&url={PRODUCT_URL}',
      }

      const result = buildTrackingUrl(productUrl, context)

      expect(result.url).toContain('static/path')
      expect(result.url).toContain('&extra=value')
    })
  })
})

describe('validateTrackingTemplate', () => {
  describe('valid templates', () => {
    it('accepts null template', () => {
      const result = validateTrackingTemplate(null)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })

    it('accepts template with {PRODUCT_URL}', () => {
      const result = validateTrackingTemplate(
        'https://track.example.com?url={PRODUCT_URL}'
      )
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('accepts template with {PRODUCT_URL_RAW}', () => {
      const result = validateTrackingTemplate(
        'https://track.example.com?url={PRODUCT_URL_RAW}'
      )
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('accepts template with all known placeholders', () => {
      const result = validateTrackingTemplate(
        'https://track.example.com/p/{PROGRAM_ID}/a/{ADVERTISER_ID}/c/{CAMPAIGN_ID}?url={PRODUCT_URL}'
      )
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })
  })

  describe('invalid templates', () => {
    it('rejects template missing product URL placeholder', () => {
      const result = validateTrackingTemplate(
        'https://track.example.com?aid={ADVERTISER_ID}'
      )
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        'Template must contain {PRODUCT_URL} or {PRODUCT_URL_RAW} placeholder'
      )
    })
  })

  describe('warnings', () => {
    it('warns about unknown placeholders', () => {
      const result = validateTrackingTemplate(
        'https://track.example.com?url={PRODUCT_URL}&custom={UNKNOWN_FIELD}'
      )
      expect(result.valid).toBe(true) // Still valid, just warning
      expect(result.warnings).toContain('Unknown placeholder: {UNKNOWN_FIELD}')
    })

    it('warns about multiple unknown placeholders', () => {
      const result = validateTrackingTemplate(
        'https://track.example.com?url={PRODUCT_URL}&a={FOO}&b={BAR}'
      )
      expect(result.valid).toBe(true)
      expect(result.warnings).toContain('Unknown placeholder: {FOO}')
      expect(result.warnings).toContain('Unknown placeholder: {BAR}')
    })
  })
})

describe('extractAffiliateContext', () => {
  it('extracts affiliate fields from a Source-like object', () => {
    const source = {
      id: 'source-123',
      name: 'Test Source',
      url: 'https://feed.example.com',
      affiliateNetwork: 'IMPACT' as const,
      affiliateProgramId: 'prog789',
      affiliateAdvertiserId: 'adv123',
      affiliateCampaignId: 'camp456',
      affiliateTrackingTemplate: 'https://track.example.com?url={PRODUCT_URL}',
      // Other Source fields that should be ignored
      enabled: true,
      interval: 3600,
    }

    const context = extractAffiliateContext(source)

    expect(context).toEqual({
      affiliateNetwork: 'IMPACT',
      affiliateProgramId: 'prog789',
      affiliateAdvertiserId: 'adv123',
      affiliateCampaignId: 'camp456',
      affiliateTrackingTemplate: 'https://track.example.com?url={PRODUCT_URL}',
    })
  })

  it('handles null values', () => {
    const source = {
      affiliateNetwork: null,
      affiliateProgramId: null,
      affiliateAdvertiserId: null,
      affiliateCampaignId: null,
      affiliateTrackingTemplate: null,
    }

    const context = extractAffiliateContext(source)

    expect(context).toEqual({
      affiliateNetwork: null,
      affiliateProgramId: null,
      affiliateAdvertiserId: null,
      affiliateCampaignId: null,
      affiliateTrackingTemplate: null,
    })
  })
})
