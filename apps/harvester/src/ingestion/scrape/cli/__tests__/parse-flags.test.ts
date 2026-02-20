import { describe, expect, it } from 'vitest'
import { parseFlags } from '../parse-flags.js'

describe('parseFlags', () => {
  it('parses standard single-token values', () => {
    const flags = parseFlags(['--site-id', 'brownells', '--mode', 'html'])
    expect(flags['site-id']).toBe('brownells')
    expect(flags.mode).toBe('html')
  })

  it('preserves multi-token flag values', () => {
    const flags = parseFlags([
      '--source-name',
      'Brownells',
      'Scraper',
      'Source',
      '--dry-run',
    ])

    expect(flags['source-name']).toBe('Brownells Scraper Source')
    expect(flags['dry-run']).toBe(true)
  })

  it('ignores non-flag positional tokens', () => {
    const flags = parseFlags(['db:add-retailer-source', '--site-id', 'brownells'])
    expect(flags['site-id']).toBe('brownells')
  })
})
