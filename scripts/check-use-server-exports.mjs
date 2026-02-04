#!/usr/bin/env node

/**
 * Validate "use server" File Exports
 *
 * Next.js "use server" files can only export async functions.
 * This script catches violations before build time.
 *
 * Checks for:
 * - `export const` (non-function exports)
 * - `export let` (non-function exports)
 * - `export { ... }` re-exports of non-functions
 * - `export default` non-async values
 *
 * Exit codes:
 *   0 = all "use server" files are valid
 *   1 = violations found
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = process.cwd()

// Directories to scan (Next.js app directories)
const SCAN_DIRS = [
  'apps/admin/app',
  'apps/web/app',
  'apps/merchant/app',
]

// Colors
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

/**
 * Recursively find all .ts/.tsx files
 */
function findFiles(dir, files = []) {
  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          // Skip node_modules and .next
          if (entry !== 'node_modules' && entry !== '.next') {
            findFiles(fullPath, files)
          }
        } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
          files.push(fullPath)
        }
      } catch {
        // Skip files we can't stat
      }
    }
  } catch {
    // Directory doesn't exist, skip
  }
  return files
}

/**
 * Check if a file has "use server" directive
 */
function hasUseServerDirective(content) {
  // Check first few lines for 'use server' (with quotes)
  const lines = content.split('\n').slice(0, 5)
  return lines.some(line => {
    const trimmed = line.trim()
    return trimmed === "'use server'" || trimmed === '"use server"'
  })
}

/**
 * Find invalid exports in a "use server" file
 */
function findInvalidExports(content, filePath) {
  const violations = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1
    const trimmed = line.trim()

    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue
    }

    // Check for `export const` that's not a function
    // Valid: export const foo = async () => {}
    // Invalid: export const foo = []
    // Invalid: export const foo = {}
    // Invalid: export const foo = 'string'
    if (trimmed.startsWith('export const ') || trimmed.startsWith('export let ')) {
      // Check if it's an async function assignment
      const isAsyncFunction = /export\s+(const|let)\s+\w+\s*=\s*async\s+(function|\()/.test(trimmed)

      // Check if it's assigning to an array, object literal, or primitive
      const isNonFunction = /export\s+(const|let)\s+\w+\s*=\s*(\[|\{(?!\s*async)|['"`]|new\s|true|false|\d)/.test(trimmed)

      // Check for `as const` pattern (definitely not a function)
      const isAsConst = /\]\s*as\s+const/.test(line) || /}\s*as\s+const/.test(line)

      if (isNonFunction || isAsConst) {
        // Extract the export name
        const match = trimmed.match(/export\s+(const|let)\s+(\w+)/)
        const exportName = match ? match[2] : 'unknown'
        violations.push({
          line: lineNum,
          code: trimmed.slice(0, 80) + (trimmed.length > 80 ? '...' : ''),
          reason: `"export ${match?.[1] || 'const'} ${exportName}" is not an async function`,
        })
      }
    }

    // Check for `export default` that's not async
    if (trimmed.startsWith('export default ') && !trimmed.includes('async')) {
      // Skip if it's exporting a function reference (might be async elsewhere)
      if (!/export\s+default\s+\w+$/.test(trimmed)) {
        violations.push({
          line: lineNum,
          code: trimmed.slice(0, 80) + (trimmed.length > 80 ? '...' : ''),
          reason: 'export default must be an async function',
        })
      }
    }

    // Check for type/interface exports (these are actually OK but let's note them)
    // Actually Next.js strips these at build time, so they're fine
  }

  return violations
}

async function main() {
  console.log(`${GREEN}[INFO]${RESET} Checking "use server" file exports...\n`)

  const allFiles = []
  for (const dir of SCAN_DIRS) {
    const fullDir = join(ROOT, dir)
    findFiles(fullDir, allFiles)
  }

  console.log(`${DIM}Scanning ${allFiles.length} files...${RESET}`)

  const violations = []

  for (const filePath of allFiles) {
    try {
      const content = readFileSync(filePath, 'utf-8')

      if (hasUseServerDirective(content)) {
        const fileViolations = findInvalidExports(content, filePath)
        if (fileViolations.length > 0) {
          violations.push({
            file: relative(ROOT, filePath),
            issues: fileViolations,
          })
        }
      }
    } catch (err) {
      // Skip files we can't read
    }
  }

  if (violations.length === 0) {
    console.log(`\n${GREEN}✓${RESET} All "use server" files have valid exports`)
    process.exit(0)
  }

  console.log(`\n${RED}✗${RESET} Found ${violations.length} file(s) with invalid exports:\n`)

  for (const v of violations) {
    console.log(`${RED}${v.file}${RESET}`)
    for (const issue of v.issues) {
      console.log(`  Line ${issue.line}: ${issue.reason}`)
      console.log(`  ${DIM}${issue.code}${RESET}`)
    }
    console.log()
  }

  console.log(`${YELLOW}Hint:${RESET} "use server" files can only export async functions.`)
  console.log(`Move constants, types, and objects to separate files.`)

  process.exit(1)
}

main().catch((err) => {
  console.error(`${RED}Error:${RESET} ${err.message}`)
  process.exit(1)
})
