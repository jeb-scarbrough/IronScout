import { describe, expect, it } from 'vitest'
import { runAddCommand } from '../commands/add.js'
import { runSmokeCommand } from '../commands/smoke.js'
import { runTestCommand } from '../commands/test.js'
import { runValidateCommand } from '../commands/validate.js'

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

  it('rejects invalid siteId in add command', async () => {
    await expect(
      runAddCommand({
        siteId: 'bad-id',
        name: 'Bad Site',
        mode: 'html',
        owner: 'harvester',
        force: false,
      })
    ).rejects.toMatchObject({ exitCode: 2 })
  })

  it('rejects missing siteId in validate command', async () => {
    const result = await runValidateCommand({
      siteId: '',
    })

    expect(result).toBe(2)
  })
})
