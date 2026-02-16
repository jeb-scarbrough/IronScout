/**
 * Processor Upsert SQL Shape Tests (#224)
 *
 * Structural assertions verifying the batch UPDATE SQL uses COALESCE
 * for optional fields to prevent null-overwrite of existing values.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Read the actual processor source to verify SQL shape
const processorSource = readFileSync(
  resolve(__dirname, '..', 'processor.ts'),
  'utf-8'
)

// Extract the UPDATE SQL block (between the UPDATE and WHERE sp.id = u.id)
function extractUpdateSql(): string {
  const match = processorSource.match(
    /UPDATE source_products AS sp SET[\s\S]*?WHERE sp\.id = u\.id/
  )
  if (!match) throw new Error('Could not find UPDATE SQL in processor.ts')
  return match[0]
}

describe('processor batch UPDATE SQL shape', () => {
  const updateSql = extractUpdateSql()

  const coalesceFields = [
    'imageUrl',
    'brand',
    'description',
    'category',
    'caliber',
    'grainWeight',
    'roundCount',
  ]

  const nonCoalesceFields = ['title', 'url', 'normalizedUrl']

  it.each(coalesceFields)(
    'wraps optional field "%s" in COALESCE',
    (field) => {
      // Match patterns like COALESCE(u."imageUrl", sp."imageUrl") or COALESCE(u.brand, sp.brand)
      const quoted = field.match(/[A-Z]/) ? `"${field}"` : field
      const pattern = new RegExp(
        `COALESCE\\(u\\.${quoted},\\s*sp\\.${quoted}\\)`
      )
      expect(updateSql).toMatch(pattern)
    }
  )

  it.each(nonCoalesceFields)(
    'does NOT wrap required field "%s" in COALESCE',
    (field) => {
      const quoted = field.match(/[A-Z]/) ? `"${field}"` : field
      const pattern = new RegExp(
        `COALESCE\\(u\\.${quoted},\\s*sp\\.${quoted}\\)`
      )
      expect(updateSql).not.toMatch(pattern)
    }
  )

  it('sets all 7 optional fields with COALESCE', () => {
    const coalesceCount = (updateSql.match(/COALESCE\(/g) || []).length
    expect(coalesceCount).toBe(7)
  })
})
