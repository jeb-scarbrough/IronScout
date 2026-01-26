#!/usr/bin/env node
/**
 * Build All IronScout Apps
 * Cross-platform Node.js version
 *
 * Usage:
 *   node scripts/build/build-all.mjs                    # Full build + tests
 *   node scripts/build/build-all.mjs --skip-tests       # Build without running tests
 *   node scripts/build/build-all.mjs --only web,api     # Build specific apps
 *   node scripts/build/build-all.mjs --skip-install     # Skip pnpm install
 *   node scripts/build/build-all.mjs --skip-prisma      # Skip Prisma generation
 *   node scripts/build/build-all.mjs --skip-version-check  # Skip library version check
 *   node scripts/build/build-all.mjs --check-versions   # Check versions only (no build)
 */

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { createInterface } from 'readline'
import {
  colors,
  success,
  error,
  info,
  warn,
  header,
  run,
  runCapture,
  parseArgs,
  readJson,
} from '../lib/utils.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../..')

// Apps to build (in dependency order)
const APPS = [
  { name: 'notifications', filter: '@ironscout/notifications', command: 'build' },
  { name: 'api', filter: '@ironscout/api', command: 'build' },
  { name: 'web', filter: '@ironscout/web', command: 'build' },
  { name: 'www', filter: '@ironscout/www', command: 'build' },
  { name: 'admin', filter: '@ironscout/admin', command: 'build' },
  { name: 'merchant', filter: '@ironscout/merchant', command: 'build' },
  { name: 'harvester', filter: '@ironscout/harvester', command: 'build' },
]

// Test suites to run
const TEST_SUITES = [
  {
    name: 'harvester:schema',
    description: 'Schema validation (catches raw SQL bugs)',
    filter: '@ironscout/harvester',
    command: 'test:schema',
    critical: true,
  },
  {
    name: 'harvester:unit',
    description: 'Harvester unit tests',
    filter: '@ironscout/harvester',
    command: 'test:run',
    critical: true,
  },
]

// Key libraries to check for updates
const LIBRARIES_TO_CHECK = [
  'next',
  'react',
  'react-dom',
  'typescript',
  'tailwindcss',
  'postcss',
  'autoprefixer',
  '@types/node',
  '@types/react',
  '@types/react-dom',
  'prisma',
  '@prisma/client',
  'zod',
  'bullmq',
  'ioredis',
]

/**
 * Get the latest version of a package from npm
 */
function getLatestVersion(packageName) {
  const result = runCapture(`npm view ${packageName} version`, { cwd: PROJECT_ROOT })
  if (result.success) {
    return result.output.trim()
  }
  return null
}

/**
 * Parse a version string, removing ^ or ~ prefix
 */
function parseVersion(version) {
  if (!version) return null
  return version.replace(/^[\^~]/, '')
}

/**
 * Compare two semver versions
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0
    if (p1 > p2) return 1
    if (p1 < p2) return -1
  }
  return 0
}

/**
 * Collect all dependencies from workspace package.json files
 */
function collectWorkspaceDependencies() {
  const deps = new Map() // packageName -> { current: version, apps: [app names] }

  // Check root package.json
  const rootPkg = readJson(resolve(PROJECT_ROOT, 'package.json'))
  if (rootPkg) {
    const allDeps = { ...rootPkg.dependencies, ...rootPkg.devDependencies }
    for (const [name, version] of Object.entries(allDeps)) {
      if (LIBRARIES_TO_CHECK.includes(name)) {
        deps.set(name, { current: parseVersion(version), apps: ['root'] })
      }
    }
  }

  // Check apps
  const appsDir = resolve(PROJECT_ROOT, 'apps')
  if (existsSync(appsDir)) {
    for (const app of readdirSync(appsDir)) {
      const pkgPath = resolve(appsDir, app, 'package.json')
      if (existsSync(pkgPath)) {
        const pkg = readJson(pkgPath)
        if (pkg) {
          const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
          for (const [name, version] of Object.entries(allDeps)) {
            if (LIBRARIES_TO_CHECK.includes(name)) {
              const parsed = parseVersion(version)
              if (deps.has(name)) {
                const existing = deps.get(name)
                if (!existing.apps.includes(app)) {
                  existing.apps.push(app)
                }
                // Keep highest version
                if (compareVersions(parsed, existing.current) > 0) {
                  existing.current = parsed
                }
              } else {
                deps.set(name, { current: parsed, apps: [app] })
              }
            }
          }
        }
      }
    }
  }

  // Check packages
  const packagesDir = resolve(PROJECT_ROOT, 'packages')
  if (existsSync(packagesDir)) {
    for (const pkg of readdirSync(packagesDir)) {
      const pkgPath = resolve(packagesDir, pkg, 'package.json')
      if (existsSync(pkgPath)) {
        const pkgJson = readJson(pkgPath)
        if (pkgJson) {
          const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies }
          for (const [name, version] of Object.entries(allDeps)) {
            if (LIBRARIES_TO_CHECK.includes(name)) {
              const parsed = parseVersion(version)
              if (deps.has(name)) {
                const existing = deps.get(name)
                if (!existing.apps.includes(`pkg:${pkg}`)) {
                  existing.apps.push(`pkg:${pkg}`)
                }
                if (compareVersions(parsed, existing.current) > 0) {
                  existing.current = parsed
                }
              } else {
                deps.set(name, { current: parsed, apps: [`pkg:${pkg}`] })
              }
            }
          }
        }
      }
    }
  }

  return deps
}

/**
 * Check for library updates
 * Returns array of { name, current, latest, updateType }
 */
async function checkLibraryUpdates() {
  const deps = collectWorkspaceDependencies()
  const updates = []

  info(`Checking ${deps.size} libraries for updates...`)
  console.log('')

  for (const [name, data] of deps) {
    const latest = getLatestVersion(name)
    if (latest && data.current) {
      const comparison = compareVersions(latest, data.current)
      if (comparison > 0) {
        // Determine update type (major, minor, patch)
        const currentParts = data.current.split('.').map(Number)
        const latestParts = latest.split('.').map(Number)

        let updateType = 'patch'
        if (latestParts[0] > currentParts[0]) {
          updateType = 'major'
        } else if (latestParts[1] > currentParts[1]) {
          updateType = 'minor'
        }

        updates.push({
          name,
          current: data.current,
          latest,
          updateType,
          apps: data.apps,
        })
      }
    }
  }

  return updates
}

/**
 * Display updates in a formatted table
 */
function displayUpdates(updates) {
  if (updates.length === 0) {
    success('All libraries are up to date!')
    return
  }

  // Sort: major first, then minor, then patch
  const order = { major: 0, minor: 1, patch: 2 }
  updates.sort((a, b) => order[a.updateType] - order[b.updateType])

  const majorUpdates = updates.filter(u => u.updateType === 'major')
  const minorUpdates = updates.filter(u => u.updateType === 'minor')
  const patchUpdates = updates.filter(u => u.updateType === 'patch')

  console.log(`${colors.yellow}Found ${updates.length} available updates:${colors.reset}`)
  console.log('')

  // Calculate column widths
  const nameWidth = Math.max(20, ...updates.map(u => u.name.length))
  const versionWidth = 12

  // Header
  console.log(
    `  ${'Package'.padEnd(nameWidth)}  ${'Current'.padEnd(versionWidth)}  ${'Latest'.padEnd(versionWidth)}  Type`
  )
  console.log(`  ${'-'.repeat(nameWidth)}  ${'-'.repeat(versionWidth)}  ${'-'.repeat(versionWidth)}  ------`)

  // Major updates (red)
  for (const u of majorUpdates) {
    console.log(
      `  ${colors.red}${u.name.padEnd(nameWidth)}${colors.reset}  ${u.current.padEnd(versionWidth)}  ${colors.red}${u.latest.padEnd(versionWidth)}${colors.reset}  ${colors.red}MAJOR${colors.reset}`
    )
  }

  // Minor updates (yellow)
  for (const u of minorUpdates) {
    console.log(
      `  ${colors.yellow}${u.name.padEnd(nameWidth)}${colors.reset}  ${u.current.padEnd(versionWidth)}  ${colors.yellow}${u.latest.padEnd(versionWidth)}${colors.reset}  ${colors.yellow}minor${colors.reset}`
    )
  }

  // Patch updates (green)
  for (const u of patchUpdates) {
    console.log(
      `  ${colors.green}${u.name.padEnd(nameWidth)}${colors.reset}  ${u.current.padEnd(versionWidth)}  ${colors.green}${u.latest.padEnd(versionWidth)}${colors.reset}  ${colors.green}patch${colors.reset}`
    )
  }

  console.log('')

  if (majorUpdates.length > 0) {
    warn(`${majorUpdates.length} MAJOR update(s) available - review breaking changes before upgrading`)
  }
}

/**
 * Prompt user to continue or abort
 */
async function promptToContinue(message) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(`${colors.yellow}${message} [y/N]: ${colors.reset}`, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

async function main() {
  const startTime = Date.now()
  const args = parseArgs()

  const skipInstall = args.flags['skip-install']
  const skipPrisma = args.flags['skip-prisma']
  const skipTests = args.flags['skip-tests']
  const skipSchemaValidation = args.flags['skip-schema-validation']
  const skipVersionCheck = args.flags['skip-version-check']
  const checkVersionsOnly = args.flags['check-versions']
  const only = args.flags.only ? args.flags.only.split(',') : null

  const results = {}
  const testResults = {}

  // Step 0: Check for library updates
  if (!skipVersionCheck) {
    header('Checking Library Versions')

    const updates = await checkLibraryUpdates()
    displayUpdates(updates)

    if (checkVersionsOnly) {
      // Just checking versions, exit after displaying
      if (updates.length > 0) {
        console.log(`${colors.cyan}To update, run:${colors.reset}`)
        console.log('  pnpm update <package-name>')
        console.log('')
      }
      process.exit(0)
    }

    if (updates.length > 0) {
      const shouldContinue = await promptToContinue('Continue with build despite outdated libraries?')
      if (!shouldContinue) {
        info('Build aborted. Update libraries and try again.')
        console.log('')
        console.log(`${colors.cyan}To update all libraries:${colors.reset}`)
        console.log('  pnpm update')
        console.log('')
        console.log(`${colors.cyan}To update specific packages:${colors.reset}`)
        for (const u of updates.slice(0, 5)) {
          console.log(`  pnpm update ${u.name}`)
        }
        if (updates.length > 5) {
          console.log(`  ... and ${updates.length - 5} more`)
        }
        console.log('')
        process.exit(1)
      }
      info('Continuing with build...')
    }
  } else {
    info('Skipping library version check')
  }

  // Filter apps if --only specified
  let apps = APPS
  let testSuites = TEST_SUITES
  if (only) {
    apps = APPS.filter((a) => only.includes(a.name))
    testSuites = TEST_SUITES.filter((t) => {
      const suiteName = t.name.split(':')[0]
      return only.includes(suiteName)
    })
    info(`Building only: ${only.join(', ')}`)
  }

  // Step 1: Validate database schema (uses new db package scripts)
  if (!skipSchemaValidation) {
    header('Validating Database Schema')

    // Check 1: Schema drift (schema.prisma vs migrations) - non-destructive using migrate diff
    info('Checking schema drift...')
    const driftResult = run('pnpm --filter @ironscout/db run check:drift', { cwd: PROJECT_ROOT })
    if (!driftResult.success) {
      error('Schema drift detected: schema.prisma differs from migrations')
      console.log('')
      warn('Fix schema drift before building. Run:')
      console.log('  pnpm db:migrate:dev    # Create migration for schema changes')
      console.log('  pnpm db:generate       # Regenerate Prisma client')
      console.log('')
      process.exit(1)
    }
    success('Schema matches migrations')

    // Check 2: Prisma client freshness (fast timestamp check)
    info('Checking Prisma client freshness...')
    const clientResult = run('pnpm --filter @ironscout/db run check:client', { cwd: PROJECT_ROOT })
    if (!clientResult.success) {
      error('Prisma client is stale')
      console.log('')
      warn('Regenerate Prisma client before building. Run:')
      console.log('  pnpm db:generate')
      console.log('')
      process.exit(1)
    }
    success('Prisma client is current')
  } else {
    info('Skipping database schema validation')
  }

  // Step 2: Install dependencies
  if (!skipInstall) {
    header('Installing Dependencies')
    const result = run('pnpm install --frozen-lockfile', { cwd: PROJECT_ROOT })
    if (result.success) {
      success('Dependencies installed')
    } else {
      error('Dependency installation failed')
      process.exit(1)
    }
  } else {
    info('Skipping dependency installation')
  }

  // Step 3: Generate Prisma client
  if (!skipPrisma) {
    header('Generating Prisma Client')

    // Prisma generate requires DATABASE_URL but doesn't connect
    const hadDatabaseUrl = !!process.env.DATABASE_URL
    if (!hadDatabaseUrl) {
      process.env.DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/dummy'
    }

    const result = run('pnpm prisma generate', {
      cwd: resolve(PROJECT_ROOT, 'packages/db'),
    })

    if (!hadDatabaseUrl) {
      delete process.env.DATABASE_URL
    }

    if (result.success) {
      success('Prisma client generated')
    } else {
      error('Prisma generation failed')
      process.exit(1)
    }
  } else {
    info('Skipping Prisma generation')
  }

  // Step 4: Build each app
  header('Building Apps')

  for (const app of apps) {
    const buildStart = Date.now()
    info(`Building ${app.name}...`)

    const result = run(`pnpm --filter ${app.filter} run ${app.command}`, {
      cwd: PROJECT_ROOT,
    })

    const duration = ((Date.now() - buildStart) / 1000).toFixed(1)

    if (result.success) {
      success(`${app.name} built successfully (${duration}s)`)
      results[app.name] = { success: true, duration }
    } else {
      error(`${app.name} build failed`)
      results[app.name] = { success: false, duration }
    }
  }

  // Step 5: Run tests
  if (!skipTests && testSuites.length > 0) {
    header('Running Tests')

    for (const suite of testSuites) {
      const testStart = Date.now()
      info(`Running ${suite.name} (${suite.description})...`)

      const result = run(`pnpm --filter ${suite.filter} run ${suite.command}`, {
        cwd: PROJECT_ROOT,
      })

      const duration = ((Date.now() - testStart) / 1000).toFixed(1)

      if (result.success) {
        success(`${suite.name} passed (${duration}s)`)
        testResults[suite.name] = { success: true, duration, critical: suite.critical }
      } else {
        error(`${suite.name} FAILED`)
        testResults[suite.name] = { success: false, duration, critical: suite.critical }
      }
    }
  } else {
    info('Skipping tests (use without --skip-tests to run)')
  }

  // Summary
  header('Build Summary')

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  const successCount = Object.values(results).filter((r) => r.success).length
  const failCount = Object.values(results).filter((r) => !r.success).length

  console.log(`${colors.cyan}Builds:${colors.reset}`)
  for (const app of apps) {
    if (results[app.name]) {
      const r = results[app.name]
      if (r.success) {
        success(`  ${app.name} - ${r.duration}s`)
      } else {
        error(`  ${app.name} - FAILED`)
      }
    }
  }

  // Test summary
  const testSuccessCount = Object.values(testResults).filter((r) => r.success).length
  const testFailCount = Object.values(testResults).filter((r) => !r.success).length
  const criticalTestsFailed = Object.values(testResults).filter(
    (r) => !r.success && r.critical
  ).length

  if (Object.keys(testResults).length > 0) {
    console.log('')
    console.log(`${colors.cyan}Tests:${colors.reset}`)
    for (const [name, r] of Object.entries(testResults)) {
      if (r.success) {
        success(`  ${name} - ${r.duration}s`)
      } else {
        const criticalTag = r.critical ? ' [CRITICAL]' : ''
        error(`  ${name} - FAILED${criticalTag}`)
      }
    }
  }

  console.log('')
  const buildStatus = failCount === 0 ? colors.green : colors.red
  const testStatus = testFailCount === 0 ? colors.green : colors.red

  console.log(`${buildStatus}Builds: ${successCount} passed, ${failCount} failed${colors.reset}`)
  if (Object.keys(testResults).length > 0) {
    console.log(`${testStatus}Tests:  ${testSuccessCount} passed, ${testFailCount} failed${colors.reset}`)
  }
  console.log(`${colors.white}Total time: ${totalTime}s${colors.reset}`)

  // Check for failures
  let hasFailures = false
  const failureReasons = []

  if (failCount > 0) {
    hasFailures = true
    failureReasons.push('Failed builds:')
    for (const app of apps) {
      if (results[app.name] && !results[app.name].success) {
        failureReasons.push(`  - ${app.name}`)
      }
    }
  }

  if (criticalTestsFailed > 0) {
    hasFailures = true
    failureReasons.push('Failed critical tests:')
    for (const [name, r] of Object.entries(testResults)) {
      if (!r.success && r.critical) {
        failureReasons.push(`  - ${name}`)
      }
    }
  }

  if (hasFailures) {
    console.log('')
    for (const line of failureReasons) {
      console.log(`${colors.red}${line}${colors.reset}`)
    }
    console.log('')
    warn('Fix the errors above before pushing to production.')
    process.exit(1)
  }

  console.log('')
  console.log(`${colors.green}All builds and tests passed! Safe to push to Render.${colors.reset}`)
  process.exit(0)
}

main().catch((e) => {
  error(e.message)
  process.exit(1)
})
