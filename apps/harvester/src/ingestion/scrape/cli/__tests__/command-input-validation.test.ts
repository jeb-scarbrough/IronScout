import { describe, expect, it } from 'vitest'
import { runSmokeCommand } from '../commands/smoke.js'
import { runTestCommand } from '../commands/test.js'

describe('scraper cli command input validation', () => {
  it('rejects invalid siteId in smoke command', async () => {
    const result = await runSmokeCommand({
      siteId: '../bad-id',
      urlFile: 'tmp/urls.txt',
    })

    expect(result).toBe(2)
  })

  it('rejects invalid siteId in test command', async () => {
    const result = await runTestCommand({
      siteId: 'bad;id',
    })

    expect(result).toBe(2)
  })
})
