import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { midwayusaAdapter } from '../adapter.js'

const ctx = {
  sourceId: 'source_test',
  retailerId: 'retailer_test',
  runId: 'run_test',
  targetId: 'target_test',
  now: new Date('2026-01-01T00:00:00Z'),
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, fatal: () => {}, child: () => ctx.logger },
} as const

describe('midwayusa adapter', () => {
  it('extracts in-stock fixture', () => {
    const fixturePath = join(__dirname, 'fixtures', 'in-stock.html')
    const html = readFileSync(fixturePath, 'utf8')

    const extracted = midwayusaAdapter.extract(html, 'https://www.midwayusa.com/product/100155156?pid=186680', ctx)
    if (!extracted.ok) {
      throw new Error(`extract failed: ${extracted.reason} ${extracted.details ?? ''}`)
    }
  })

  it('extracts out-of-stock fixture', () => {
    const fixturePath = join(__dirname, 'fixtures', 'out-of-stock.html')
    const html = readFileSync(fixturePath, 'utf8')

    const extracted = midwayusaAdapter.extract(html, 'https://www.midwayusa.com/product/1023281272?pid=520053', ctx)
    if (!extracted.ok) {
      throw new Error(`extract failed: ${extracted.reason} ${extracted.details ?? ''}`)
    }
  })
})
