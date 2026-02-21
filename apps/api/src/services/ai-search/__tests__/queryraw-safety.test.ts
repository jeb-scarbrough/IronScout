/**
 * $queryRawUnsafe Safety Guardrail
 *
 * $queryRawUnsafe is needed when SQL structure is dynamic (conditional WHERE
 * clauses, variable column lists). Values must ALWAYS use $N positional
 * parameters and be passed via the spread args — never interpolated into
 * the SQL string.
 *
 * This test scans every $queryRawUnsafe call site in the repo and flags
 * template expressions inside the SQL string that look like value
 * interpolation (e.g. `${userId}`, `${price}`).
 *
 * Allowed interpolations:
 *   - SQL fragment variables (whereClause, scopeFilter, etc.)
 *   - Positional parameter index references ($${paramIdx})
 *
 * If this test fails, you likely interpolated a value directly into SQL.
 * Use a $N positional parameter instead.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..')

/**
 * Template expressions inside $queryRawUnsafe SQL strings that are known-safe
 * because they contain SQL fragments (not user values).
 */
const ALLOWED_INTERPOLATIONS = [
  // search-service.ts: dynamic WHERE clause + positional param index refs
  'whereClause',
  'embeddingParamIdx',
  'limitParamIdx',
  'offsetParamIdx',
  // search-service.ts: static column list fragment (pre-built outside SQL template)
  'selectColumns',
  // recompute.ts: scope filter fragment (static SQL with $N params)
  'scopeFilter',
]

describe('$queryRawUnsafe — SQL injection guardrail', () => {
  it('all_call_sites_use_positional_parameters_not_value_interpolation', () => {
    // Find all TypeScript/JavaScript files containing $queryRawUnsafe
    const grepResult = execSync(
      'git grep -l "\\$queryRawUnsafe" -- "*.ts" "*.js" ":!*.test.ts" ":!*.test.js" ":!node_modules"',
      { cwd: REPO_ROOT, encoding: 'utf-8' }
    ).trim()

    const files = grepResult.split('\n').filter(Boolean)
    expect(files.length).toBeGreaterThan(0)

    const violations: string[] = []

    for (const relPath of files) {
      const absPath = path.join(REPO_ROOT, relPath)
      const source = fs.readFileSync(absPath, 'utf-8')

      // Find all template literal expressions (${...}) inside $queryRawUnsafe calls
      // We look for the pattern: $queryRawUnsafe<...>(`...${expr}...`, ...params)
      // and extract each ${expr} interpolation

      // Match template expressions: ${someVariable} or ${some.expression}
      const templateExprPattern = /\$\{([^}]+)\}/g
      let match: RegExpExecArray | null

      // Find regions that are inside $queryRawUnsafe SQL strings
      const unsafeCallPattern = /\$queryRawUnsafe[^`]*`([\s\S]*?)`/g
      let callMatch: RegExpExecArray | null

      while ((callMatch = unsafeCallPattern.exec(source)) !== null) {
        const sqlTemplate = callMatch[1]

        while ((match = templateExprPattern.exec(sqlTemplate)) !== null) {
          const expr = match[1].trim()

          // Check if this interpolation is in the allowed list
          const isAllowed = ALLOWED_INTERPOLATIONS.some(
            allowed => expr === allowed || expr.startsWith(`${allowed}`)
          )

          if (!isAllowed) {
            violations.push(
              `${relPath}: unsafe interpolation \${${expr}} in $queryRawUnsafe SQL string`
            )
          }
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `$queryRawUnsafe SQL injection risk detected:\n\n${violations.join('\n')}\n\n` +
          'Use $N positional parameters instead of interpolating values into SQL strings.\n' +
          'If this is a safe SQL fragment (not a value), add it to ALLOWED_INTERPOLATIONS.'
      )
    }
  })
})
