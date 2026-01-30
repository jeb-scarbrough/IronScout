import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const configPath = path.resolve(__dirname, '../../../next.config.js')
const configText = readFileSync(configPath, 'utf8')

describe('next.config.js secret exposure', () => {
  it('does not inline NEXTAUTH_SECRET', () => {
    expect(configText).not.toMatch(/NEXTAUTH_SECRET/)
  })
})
