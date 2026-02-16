/**
 * Quarantine Worker Upsert Tests (#224)
 *
 * Verifies that the quarantine worker's source_product UPDATE uses
 * conditional field inclusion to prevent null-overwrite of existing values.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const workerSource = readFileSync(
  resolve(__dirname, '..', 'worker.ts'),
  'utf-8'
)

// Extract the section between "Update existing" comment and "Create new" comment
// This captures the full update block without regex greediness issues
function extractUpdateSection(): string {
  const startIdx = workerSource.indexOf('// Update existing')
  const endIdx = workerSource.indexOf('// Create new source_product')
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('Could not find update/create section markers in worker.ts')
  }
  return workerSource.slice(startIdx, endIdx)
}

// Extract the section from "Create new source_product" to end of the else block
function extractCreateSection(): string {
  const startIdx = workerSource.indexOf('// Create new source_product')
  if (startIdx === -1) {
    throw new Error('Could not find create section marker in worker.ts')
  }
  // Grab enough to cover the create call (next 500 chars is plenty)
  return workerSource.slice(startIdx, startIdx + 500)
}

describe('quarantine worker source_product update shape', () => {
  const updateSection = extractUpdateSection()

  it('uses conditional spread for title (truthy check)', () => {
    expect(updateSection).toMatch(/\.\.\.\(rawData\.name && \{ title: rawData\.name \}\)/)
  })

  it('uses conditional spread for imageUrl (null check)', () => {
    expect(updateSection).toMatch(
      /\.\.\.\(rawData\.imageUrl != null && \{ imageUrl: rawData\.imageUrl \}\)/
    )
  })

  it('uses conditional spread for brand (null check)', () => {
    expect(updateSection).toMatch(
      /\.\.\.\(rawData\.brand != null && \{ brand: rawData\.brand \}\)/
    )
  })

  it('uses conditional spread for caliber (null check)', () => {
    expect(updateSection).toMatch(
      /\.\.\.\(rawData\.caliber != null && \{ caliber: rawData\.caliber \}\)/
    )
  })

  it('uses conditional spread for grainWeight (null check)', () => {
    expect(updateSection).toMatch(
      /\.\.\.\(rawData\.grainWeight != null && \{ grainWeight: rawData\.grainWeight \}\)/
    )
  })

  it('uses conditional spread for roundCount (null check)', () => {
    expect(updateSection).toMatch(
      /\.\.\.\(rawData\.roundCount != null && \{ roundCount: rawData\.roundCount \}\)/
    )
  })

  it('does NOT unconditionally set title to rawData.name || Unknown', () => {
    expect(updateSection).not.toMatch(/title:\s*rawData\.name\s*\|\|\s*'Unknown'/)
  })

  it('always sets lastUpdatedByRunId and updatedAt unconditionally', () => {
    expect(updateSection).toMatch(/lastUpdatedByRunId:\s*reprocessRunId/)
    expect(updateSection).toMatch(/updatedAt:\s*now/)
  })
})

describe('quarantine worker source_product create shape', () => {
  const createSection = extractCreateSection()

  it('uses rawData.name || Unknown for title on create path', () => {
    expect(createSection).toMatch(/title:\s*rawData\.name\s*\|\|\s*'Unknown'/)
  })
})
