#!/usr/bin/env tsx
/**
 * CI Gate: Comprehensive schema and database validation
 *
 * This script validates:
 * 1. Schema.prisma is syntactically valid
 * 2. Schema.prisma has no uncommitted changes (prevents accidental overwrites)
 * 3. All migrations have been applied to the database
 * 4. Database schema actually matches schema.prisma (via migrate diff)
 * 5. Generated Prisma client is up-to-date
 *
 * Exit codes:
 *   0 = all checks pass
 *   1 = validation failed
 *
 * This would have caught:
 * - Accidental `prisma db pull --force` overwriting schema
 * - Missing columns in database
 * - Stale Prisma client after schema changes
 */

import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env files (local package first, then root)
config({ path: resolve(__dirname, '..', '.env') })
config({ path: resolve(__dirname, '..', '..', '..', '.env') })

const DB_PACKAGE_ROOT = resolve(__dirname, '..')
const REPO_ROOT = resolve(__dirname, '..', '..', '..')
const SCHEMA_PATH = resolve(DB_PACKAGE_ROOT, 'schema.prisma')
const GENERATED_PATH = resolve(DB_PACKAGE_ROOT, 'generated', 'prisma')

// Colors for terminal output
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

function log(color: string, prefix: string, msg: string) {
  console.error(`${color}[${prefix}]${RESET} ${msg}`)
}

function fatal(msg: string, hint?: string): never {
  log(RED, 'FAIL', msg)
  if (hint) {
    console.error(`\n${YELLOW}Hint:${RESET} ${hint}`)
  }
  process.exit(1)
}

function success(msg: string) {
  log(GREEN, 'OK', msg)
}

function warn(msg: string) {
  log(YELLOW, 'WARN', msg)
}

function info(msg: string) {
  log(GREEN, 'INFO', msg)
}

async function main() {
  const args = process.argv.slice(2)
  const skipGitCheck = args.includes('--skip-git-check')

  // Verify schema exists
  if (!existsSync(SCHEMA_PATH)) {
    fatal(`schema.prisma not found at ${SCHEMA_PATH}`)
  }

  // Step 1: Validate schema syntax
  info('Validating schema syntax...')

  const validateResult = spawnSync('prisma', ['validate'], {
    cwd: DB_PACKAGE_ROOT,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  })

  if (validateResult.status !== 0) {
    console.error(validateResult.stderr)
    fatal('Schema validation failed')
  }

  success('Schema syntax is valid')

  // Step 2: Check for uncommitted schema changes (prevents accidental db pull --force)
  if (!skipGitCheck) {
    info('Checking for uncommitted schema changes...')

    const gitDiff = spawnSync(
      'git',
      ['diff', '--name-only', 'packages/db/schema.prisma'],
      {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      }
    )

    if (gitDiff.stdout.trim().includes('schema.prisma')) {
      fatal(
        'schema.prisma has uncommitted changes',
        'This could indicate accidental `prisma db pull --force`. ' +
          'Review changes with `git diff packages/db/schema.prisma` and either commit or restore.'
      )
    }

    success('Schema has no uncommitted changes')
  } else {
    warn('Skipping git check (--skip-git-check)')
  }

  // Step 3: Check migration status (only if DATABASE_URL is set)
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    warn('No DATABASE_URL set, skipping database checks')
    process.exit(0)
  }

  info('Checking migration status...')

  const statusResult = spawnSync('prisma', ['migrate', 'status'], {
    cwd: DB_PACKAGE_ROOT,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  })

  const statusOutput = statusResult.stdout + statusResult.stderr

  if (
    statusOutput.includes('Following migration') ||
    statusOutput.includes('not yet applied')
  ) {
    console.error(statusOutput)
    fatal(
      'Pending migrations detected',
      'Run `pnpm db:migrate:deploy` to apply migrations'
    )
  }

  if (statusOutput.includes('Database schema is up to date')) {
    success('All migrations applied')
  } else if (statusResult.status !== 0) {
    console.error(statusOutput)
    fatal('Migration status check failed')
  } else {
    success('Migrations in sync')
  }

  // Step 4: Check actual schema-to-DB diff (catches real drift even if migrations say "up to date")
  info('Checking schema-to-database diff...')

  const diffResult = spawnSync(
    'prisma',
    [
      'migrate',
      'diff',
      '--from-config-datasource',
      '--to-schema',
      'schema.prisma',
      '--exit-code',
    ],
    {
      cwd: DB_PACKAGE_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    }
  )

  // exit-code flag: 0 = empty (no diff), 2 = has diff, 1 = error
  if (diffResult.status === 2) {
    const diffOutput = diffResult.stdout || ''

    // Known drift allowlist: GIN trigram indexes and generated columns created via raw SQL
    // that Prisma cannot represent natively (see prisma/prisma#17516, #16275).
    // These are intentional and managed outside Prisma's migration system.
    const KNOWN_DRIFT_PATTERNS = [
      // GIN trigram indexes on products (migration 20260208220000)
      /Removed index on columns \((brand|caliberNorm|caseMaterial|description|embedding|name|purpose|search_vector)\)/,
      // Generated tsvector column default (Prisma can't represent GENERATED ALWAYS AS)
      /Altered column `search_vector` \(default changed/,
      // FK index on prices.affiliateFeedRunId added via raw SQL (migration 20260212000000)
      /Removed index on columns \(affiliateFeedRunId\)/,
    ]

    // Strip known drift lines and check if any unknown drift remains
    const diffLines = diffOutput.split('\n')
    const unknownDrift = diffLines.filter(line => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('[*] Changed') || trimmed === '') return false
      if (trimmed.startsWith('[+]') || trimmed.startsWith('[-]') || trimmed.startsWith('[*]')) {
        return !KNOWN_DRIFT_PATTERNS.some(pattern => pattern.test(trimmed))
      }
      return false
    })

    if (unknownDrift.length > 0) {
      console.error('\n' + diffOutput)
      fatal(
        'Database schema does not match schema.prisma',
        'Run `pnpm db:push` to sync database or `pnpm db:migrate:dev` to create a migration'
      )
    }

    warn('Known drift detected (GIN trigram indexes / generated columns) — allowed')
    if (args.includes('--verbose')) {
      console.error(DIM + diffOutput + RESET)
    }
  } else if (diffResult.status === 1) {
    console.error(diffResult.stderr)
    fatal('Schema diff check failed')
  }

  success('Database schema matches schema.prisma (or only known drift)')

  // Step 5: Check if Prisma client is up-to-date
  info('Checking Prisma client freshness...')

  const generatedIndexPath = resolve(GENERATED_PATH, 'index.js')
  if (!existsSync(generatedIndexPath)) {
    fatal(
      'Generated Prisma client not found',
      'Run `pnpm db:generate` to generate the client'
    )
  }

  // Check if schema.prisma was modified after the generated client
  // Note: Prisma reformats the schema during generation, so we can't compare content
  const { statSync } = await import('fs')
  const schemaMtime = statSync(SCHEMA_PATH).mtimeMs
  const generatedMtime = statSync(generatedIndexPath).mtimeMs

  if (schemaMtime > generatedMtime) {
    fatal(
      'Prisma client may be stale (schema.prisma modified after last generate)',
      'Run `pnpm db:generate` to regenerate the client'
    )
  }

  success('Prisma client is up-to-date')

  console.error(`\n${GREEN}✓${RESET} All schema checks passed`)
}

main().catch((err) => {
  fatal(`Unexpected error: ${err.message}`)
})
