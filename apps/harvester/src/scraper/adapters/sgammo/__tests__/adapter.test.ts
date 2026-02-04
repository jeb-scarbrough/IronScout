import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { sgammoAdapter } from '../adapter.js'

const ctx = {
  sourceId: 'source_test',
  retailerId: 'retailer_test',
  runId: 'run_test',
  targetId: 'target_test',
  now: new Date('2026-01-01T00:00:00Z'),
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, fatal: () => {}, child: () => ctx.logger },
} as const

describe('sgammo adapter', () => {
  it('extracts in-stock fixture', () => {
    const fixturePath = join(__dirname, 'fixtures', 'in-stock.html')
    const html = readFileSync(fixturePath, 'utf8')

    const extracted = sgammoAdapter.extract(html, 'https://sgammo.com/product/9mm-luger-ammo/250-round-case-9mm-luger-p-135-grain-hornady-critical-duty-flexlock-hollow-point-ammo-90226/', ctx)
    if (!extracted.ok) {
      throw new Error(`extract failed: ${extracted.reason} ${extracted.details ?? ''}`)
    }
  })

  it('extracts out-of-stock fixture', () => {
    const fixturePath = join(__dirname, 'fixtures', 'out-of-stock.html')
    const html = readFileSync(fixturePath, 'utf8')

    const extracted = sgammoAdapter.extract(html, 'https://sgammo.com/product/9mm-luger-ammo/250-round-case-9mm-luger-p-124-grain-xtp-hornady-american-gunner-ammo-90224/', ctx)
    if (!extracted.ok) {
      throw new Error(`extract failed: ${extracted.reason} ${extracted.details ?? ''}`)
    }
  })
})
