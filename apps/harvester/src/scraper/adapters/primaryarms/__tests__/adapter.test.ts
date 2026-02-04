import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { primaryarmsAdapter } from '../adapter.js'

const ctx = {
  sourceId: 'source_test',
  retailerId: 'retailer_test',
  runId: 'run_test',
  targetId: 'target_test',
  now: new Date('2026-01-01T00:00:00Z'),
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, fatal: () => {}, child: () => ctx.logger },
} as const

describe('primaryarms adapter', () => {
  it('extracts in-stock fixture', () => {
    const fixturePath = join(__dirname, 'fixtures', 'in-stock.html')
    const html = readFileSync(fixturePath, 'utf8')

    const extracted = primaryarmsAdapter.extract(html, 'https://www.primaryarms.com/cci-blazer-brass-9mm-luger-ammo-115-grain-fmj-50-rounds', ctx)
    if (!extracted.ok) {
      throw new Error(`extract failed: ${extracted.reason} ${extracted.details ?? ''}`)
    }
  })

  it('extracts out-of-stock fixture', () => {
    const fixturePath = join(__dirname, 'fixtures', 'out-of-stock.html')
    const html = readFileSync(fixturePath, 'utf8')

    const extracted = primaryarmsAdapter.extract(html, 'https://www.primaryarms.com/federal-syntech-training-match-total-synthetic-jacket-9mm-luger-147-gr-ammo-box-of-50', ctx)
    if (!extracted.ok) {
      throw new Error(`extract failed: ${extracted.reason} ${extracted.details ?? ''}`)
    }
  })
})
