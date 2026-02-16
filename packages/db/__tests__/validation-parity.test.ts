import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function getExportedFunctions(filePath: string): Set<string> {
  const source = readFileSync(filePath, 'utf8')
  const exportFnRegex = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g
  const names = new Set<string>()

  let match: RegExpExecArray | null = null
  while ((match = exportFnRegex.exec(source)) !== null) {
    names.add(match[1])
  }

  return names
}

describe('validation runtime parity', () => {
  it('exports every validation.ts function from validation.js', () => {
    const tsPath = resolve(__dirname, '../validation.ts')
    const jsPath = resolve(__dirname, '../validation.js')

    const tsExports = getExportedFunctions(tsPath)
    const jsExports = getExportedFunctions(jsPath)

    expect(tsExports.size).toBeGreaterThan(0)

    const missing = [...tsExports].filter((name) => !jsExports.has(name))
    expect(missing).toEqual([])
  })
})

