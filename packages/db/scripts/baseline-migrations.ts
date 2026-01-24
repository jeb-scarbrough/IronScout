#!/usr/bin/env tsx
/**
 * Baseline Migrations Script
 *
 * Marks all existing migrations as applied WITHOUT running them.
 * Use this when the database schema already exists but has no migration history.
 *
 * Usage: pnpm baseline
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MIGRATIONS_DIR = path.join(__dirname, '../migrations')

async function main() {
  console.log('=== Prisma Migration Baseline ===')
  console.log('This will mark all migrations as applied WITHOUT running them.')
  console.log('Only use this if your database schema already matches the migrations.')
  console.log('')

  // Get all migration directories
  const migrations = fs.readdirSync(MIGRATIONS_DIR)
    .filter(d => fs.statSync(path.join(MIGRATIONS_DIR, d)).isDirectory())
    .sort()

  console.log(`Found ${migrations.length} migrations to baseline.\n`)

  let success = 0
  let failed = 0

  for (const migration of migrations) {
    process.stdout.write(`Marking as applied: ${migration}... `)
    try {
      execSync(`npx prisma migrate resolve --applied "${migration}"`, {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      })
      console.log('✓')
      success++
    } catch (error: any) {
      // Check if it's already applied
      if (error.stderr?.toString().includes('already been applied')) {
        console.log('(already applied)')
        success++
      } else {
        console.log('✗')
        console.error(`  Error: ${error.stderr?.toString() || error.message}`)
        failed++
      }
    }
  }

  console.log('')
  console.log('=== Baseline complete ===')
  console.log(`Success: ${success}, Failed: ${failed}`)
  console.log('')
  console.log("Run 'pnpm db:migrate:status' to verify.")

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => {
  console.error('Baseline failed:', e)
  process.exit(1)
})
