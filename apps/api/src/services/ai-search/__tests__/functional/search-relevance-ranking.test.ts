import { describe, expect, it, vi } from 'vitest'
import type { PremiumSearchIntent } from '../../intent-parser'
import type { ProductForRanking } from '../../premium-ranking'
import { applyPremiumRanking } from '../../premium-ranking'

vi.mock('../../price-signal-index', () => ({
  calculatePriceSignalIndex: vi.fn().mockResolvedValue({
    relativePricePct: 0,
    positionInRange: 0.5,
    contextBand: 'TYPICAL',
    meta: {
      windowDays: 30,
      sampleCount: 10,
      asOf: new Date().toISOString(),
    },
  }),
}))

function createProduct(overrides: Partial<ProductForRanking>): ProductForRanking {
  return {
    id: 'p-base',
    name: 'Base Product',
    caliber: '9mm',
    grainWeight: 124,
    brand: 'Federal',
    purpose: 'Target',
    roundCount: 50,
    bulletType: 'FMJ',
    pressureRating: 'STANDARD',
    muzzleVelocityFps: 1120,
    isSubsonic: false,
    shortBarrelOptimized: false,
    suppressorSafe: false,
    lowFlash: false,
    lowRecoil: false,
    controlledExpansion: false,
    matchGrade: false,
    factoryNew: true,
    dataSource: 'PARSED',
    dataConfidence: 0.8,
    _relevanceScore: 50,
    prices: [
      {
        price: 0.5,
        inStock: true,
        retailer: {
          id: 'r1',
          tier: 'STANDARD',
        },
      },
    ],
    ...overrides,
  }
}

async function rankForPurpose(products: ProductForRanking[], userPurpose: string): Promise<string[]> {
  const ranked = await applyPremiumRanking(products, {
    userPurpose,
    includePriceSignal: false,
  })
  return ranked.map(p => p.id)
}

describe('Search Relevance Ranking Contract', () => {
  it('prioritizes defensive loads over FMJ for defense intent', async () => {
    const ids = await rankForPurpose([
      createProduct({ id: 'fmj-training', name: 'FMJ Training', bulletType: 'FMJ' }),
      createProduct({
        id: 'jhp-defense',
        name: 'JHP Defense',
        bulletType: 'JHP',
        controlledExpansion: true,
        lowFlash: true,
        shortBarrelOptimized: true,
      }),
    ], 'home defense')

    expect(ids[0]).toBe('jhp-defense')
  })

  it('prioritizes FMJ for target practice intent', async () => {
    const ids = await rankForPurpose([
      createProduct({ id: 'jhp-defense', bulletType: 'JHP', controlledExpansion: true }),
      createProduct({ id: 'fmj-target', bulletType: 'FMJ' }),
    ], 'target practice')

    expect(ids[0]).toBe('fmj-target')
  })

  it('prioritizes suppressor-safe/subsonic loads for suppressor intent', async () => {
    const ids = await rankForPurpose([
      createProduct({ id: 'standard-load', bulletType: 'FMJ', isSubsonic: false, suppressorSafe: false }),
      createProduct({ id: 'supp-load', bulletType: 'FMJ', isSubsonic: true, suppressorSafe: true }),
    ], 'suppressor use')

    expect(ids[0]).toBe('supp-load')
  })

  it('applies safety constraint boosts for low-overpenetration intent', async () => {
    const premiumIntent: PremiumSearchIntent = {
      explanation: 'Prefer loads with lower overpenetration risk',
      safetyConstraints: ['low-overpenetration'],
    }

    const ranked = await applyPremiumRanking([
      createProduct({ id: 'fmj', bulletType: 'FMJ', controlledExpansion: false }),
      createProduct({ id: 'frangible', bulletType: 'FRANGIBLE', controlledExpansion: false }),
      createProduct({ id: 'jhp', bulletType: 'JHP', controlledExpansion: true }),
    ], {
      premiumIntent,
      userPurpose: 'home defense',
      includePriceSignal: false,
    })

    const ids = ranked.map(p => p.id)
    expect(ids[0]).toBe('jhp')
    expect(ids.indexOf('frangible')).toBeLessThan(ids.indexOf('fmj'))
  })

  it('keeps explanation language non-prescriptive', async () => {
    const ranked = await applyPremiumRanking([
      createProduct({
        id: 'defense-load',
        name: 'Defense Load',
        bulletType: 'BJHP',
        controlledExpansion: true,
        lowFlash: true,
      }),
    ], {
      userPurpose: 'home defense',
      includePriceSignal: false,
    })

    const explanation = ranked[0].premiumRanking.explanation?.toLowerCase() ?? ''
    expect(explanation).not.toContain('buy now')
    expect(explanation).not.toContain('you should buy')
    expect(explanation).not.toContain('deal score')
    expect(explanation).not.toContain('guaranteed')
  })
})
