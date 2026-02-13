#!/usr/bin/env node

/**
 * Outbound Link Surface Audit
 *
 * Ensures all retailer outbound links in apps/web route through /out.
 * Detects direct external retailer links that bypass HMAC-signed URLs.
 *
 * Checks for:
 * - window.open() calls not using out_url or retailerOutUrl
 * - <a href={...url}> patterns using raw retailer URLs instead of out_url
 *
 * Exit codes:
 *   0 = no direct retailer links found
 *   1 = violations found
 *
 * @see context/specs/outbound-redirect-v1.md (Surface Audit Requirement)
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = process.cwd()

// Only scan consumer app UI code
const SCAN_DIRS = [
  'apps/web/components',
  'apps/web/app',
]

// Files to exclude (test files, the /out handler itself)
const EXCLUDE_PATTERNS = [
  /__tests__/,
  /\.test\./,
  /\.spec\./,
  /app\/out\/route\.ts/,
]

const VIOLATIONS = []

/**
 * Recursively find all .tsx and .ts files
 */
function findFiles(dir, ext = ['.tsx', '.ts']) {
  const results = []
  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        results.push(...findFiles(fullPath, ext))
      } else if (ext.some(e => entry.endsWith(e))) {
        results.push(fullPath)
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return results
}

/**
 * Check a file for direct external link patterns
 */
function checkFile(filePath) {
  const relPath = relative(ROOT, filePath)

  // Skip excluded files
  if (EXCLUDE_PATTERNS.some(p => p.test(relPath))) return

  const content = readFileSync(filePath, 'utf8')
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    // Pattern 1: window.open with a raw URL variable (not out_url or retailerOutUrl)
    // Match: window.open(item.url, ...) or window.open(retailerUrl, ...)
    // Skip: window.open(item.out_url, ...) or window.open(retailerOutUrl, ...)
    const windowOpenMatch = line.match(/window\.open\(([^,)]+)/)
    if (windowOpenMatch) {
      const arg = windowOpenMatch[1].trim()
      // Allow: out_url, retailerOutUrl, any variable/expression containing 'out_url' or 'OutUrl'
      if (!arg.includes('out_url') && !arg.includes('OutUrl')) {
        // Also allow string literals (internal links like '/dashboard')
        if (!arg.startsWith("'") && !arg.startsWith('"') && !arg.startsWith('`')) {
          VIOLATIONS.push({
            file: relPath,
            line: lineNum,
            pattern: 'window.open() without out_url',
            code: line.trim(),
          })
        }
      }
    }

    // Pattern 2: href={...url} where the variable is a raw retailer URL
    // Match: href={price.url} or href={lowestPrice.url} or href={retailerUrl}
    // Skip: href={price.out_url} or href={lowestPrice.out_url}
    const hrefMatch = line.match(/href=\{([^}]+)\}/)
    if (hrefMatch) {
      const expr = hrefMatch[1].trim()
      // Skip internal links (starting with / or template literals with /)
      if (expr.startsWith("'/") || expr.startsWith('"/') || expr.startsWith('`/')) continue
      // Skip Next.js Link-style internal routes
      if (expr.includes('/products/') || expr.includes('/dashboard/') || expr.includes('/search')) continue
      // Flag raw .url references that aren't out_url
      if (expr.endsWith('.url') || expr.endsWith('.url}')) {
        if (!expr.includes('out_url')) {
          VIOLATIONS.push({
            file: relPath,
            line: lineNum,
            pattern: 'href={} with raw retailer URL',
            code: line.trim(),
          })
        }
      }
    }
  }
}

// Run
console.log('Outbound link surface audit...\n')

for (const dir of SCAN_DIRS) {
  const fullDir = join(ROOT, dir)
  const files = findFiles(fullDir)
  for (const file of files) {
    checkFile(file)
  }
}

if (VIOLATIONS.length === 0) {
  console.log('✓ No direct retailer outbound links found. All links route through /out.')
  process.exit(0)
} else {
  console.error(`✗ Found ${VIOLATIONS.length} potential direct retailer link(s):\n`)
  for (const v of VIOLATIONS) {
    console.error(`  ${v.file}:${v.line}`)
    console.error(`    Pattern: ${v.pattern}`)
    console.error(`    Code:    ${v.code}\n`)
  }
  console.error('All retailer outbound links must use out_url (signed via /out).')
  console.error('See: context/specs/outbound-redirect-v1.md')
  process.exit(1)
}
