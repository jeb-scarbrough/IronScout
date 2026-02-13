import { describe, it, expect } from 'vitest'
import { scrapeVisibilityPriceWhere } from '../tiers'

describe('Scrape Visibility Guardrails', () => {
  it('keeps non-scrape prices visible', () => {
    const where = scrapeVisibilityPriceWhere() as any

    expect(where.OR).toEqual(expect.arrayContaining([
      { ingestionRunType: null },
      { ingestionRunType: { not: 'SCRAPE' } },
    ]))
  })

  it('requires allowlist + robots + ToS + adapter enabled for SCRAPE visibility', () => {
    const where = scrapeVisibilityPriceWhere() as any

    const scrapeClause = where.OR.find((clause: any) =>
      Array.isArray(clause.AND) && clause.AND.some((c: any) => c.ingestionRunType === 'SCRAPE')
    )

    expect(scrapeClause).toBeDefined()

    const sourceClause = scrapeClause.AND.find((c: any) => c.sources)?.sources?.is

    expect(sourceClause).toMatchObject({
      adapterId: { not: null },
      robotsCompliant: true,
      tosReviewedAt: { not: null },
      tosApprovedBy: { not: null },
      scrape_adapter_status: {
        is: {
          enabled: true,
        },
      },
    })

    // scrapeEnabled is an ingestion control and must not hide existing visible prices.
    expect(sourceClause).not.toHaveProperty('scrapeEnabled')
  })
})
