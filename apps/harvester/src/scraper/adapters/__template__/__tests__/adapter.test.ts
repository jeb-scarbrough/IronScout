import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { templateAdapter } from '../adapter.js'

describe.skip('adapter template (replace with retailer tests)', () => {
  it('extracts and normalizes a basic product page', () => {
    const fixturePath = join(__dirname, 'fixtures', 'product-page.html')
    const html = readFileSync(fixturePath, 'utf8')

    const ctx = {
      sourceId: 'source_test',
      retailerId: 'retailer_test',
      runId: 'run_test',
      targetId: 'target_test',
      now: new Date('2026-01-01T00:00:00Z'),
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as any,
    }

    const extracted = templateAdapter.extract(html, 'https://example.com/product/1', ctx)
    expect(extracted.ok).toBe(true)
    if (!extracted.ok) return

    const normalized = templateAdapter.normalize(extracted.offer, ctx)
    expect(normalized.status).toBe('ok')
  })
})
