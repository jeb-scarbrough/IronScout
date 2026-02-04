#!/usr/bin/env node
/**
 * Start All IronScout Services
 * Cross-platform Node.js version
 *
 * Usage: node scripts/dev/start-all.mjs [options]
 *
 * Options:
 *   --terminals, -t   Open each service in its own terminal window (Windows)
 *   --skip-build      Skip building before starting
 *   --dev             Use dev mode (hot reload) instead of production builds
 *   --only <services> Start only specific services (comma-separated)
 */

import { spawn } from 'child_process'
import { createWriteStream } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  colors,
  success,
  error,
  info,
  header,
  run,
  parseArgs,
  healthCheck,
  sleep,
  ensureDir,
  isWindows,
} from '../lib/utils.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../..')

// Caddy CA certificate for internal HTTPS (needed for server-side fetch in Next.js apps)
const CADDY_CA_CERT = process.platform === 'win32'
  ? resolve(process.env.APPDATA || '', 'Caddy', 'pki', 'authorities', 'local', 'root.crt')
  : resolve(process.env.HOME || '', '.local/share/caddy/pki/authorities/local/root.crt')

// Service definitions
// Note: Using 127.0.0.1 instead of localhost for reliable health checks on Windows
// Caddy is started LAST so all apps are ready before the reverse proxy starts
const SERVICES = [
  {
    name: 'api',
    port: 8000,
    devCommand: 'pnpm --filter @ironscout/api dev',
    prodCommand: 'pnpm --filter @ironscout/api start',
    healthCheck: 'http://127.0.0.1:8000/health',
  },
  {
    name: 'web',
    port: 3000,
    devCommand: 'pnpm --filter @ironscout/web dev',
    prodCommand: 'pnpm --filter @ironscout/web start',
    healthCheck: 'http://127.0.0.1:3000',
  },
  {
    name: 'www',
    port: 3004,
    devCommand: 'pnpm --filter @ironscout/www dev',
    prodCommand: null, // Static site - served by CDN in production
    healthCheck: 'http://127.0.0.1:3004',
  },
  {
    name: 'admin',
    port: 3002,
    devCommand: 'pnpm --filter @ironscout/admin dev',
    prodCommand: 'pnpm --filter @ironscout/admin start',
    healthCheck: 'http://127.0.0.1:3002',
  },
  {
    name: 'merchant',
    port: 3003,
    devCommand: 'pnpm --filter @ironscout/merchant dev',
    prodCommand: 'pnpm --filter @ironscout/merchant start',
    healthCheck: 'http://127.0.0.1:3003',
  },
  {
    name: 'harvester',
    port: null, // Background worker
    devCommand: 'pnpm --filter @ironscout/harvester worker:dev',
    prodCommand: 'pnpm --filter @ironscout/harvester worker',
    healthCheck: null,
  },
  {
    name: 'bullboard',
    port: 3939,
    devCommand: 'pnpm --filter @ironscout/harvester bullboard:dev',
    prodCommand: 'pnpm --filter @ironscout/harvester bullboard',
    healthCheck: 'http://127.0.0.1:3939/health',
  },
  {
    name: 'caddy',
    port: 443,
    // Use full path on Windows since Chocolatey may not be in Git Bash PATH
    devCommand: process.platform === 'win32'
      ? 'C:\\ProgramData\\chocolatey\\bin\\caddy.exe run'
      : 'caddy run',
    prodCommand: process.platform === 'win32'
      ? 'C:\\ProgramData\\chocolatey\\bin\\caddy.exe run'
      : 'caddy run',
    healthCheck: null, // Caddy doesn't have a simple health endpoint
    optional: false, // Required for local HTTPS domains
  },
]

const childProcesses = []

/**
 * Start a service in a new terminal window (Windows)
 */
function startServiceInTerminal(service, devMode) {
  const command = devMode ? service.devCommand : service.prodCommand
  const title = `IronScout - ${service.name}`
  const safeTitle = title.replace(/["^]/g, '')
  const cmdBody = `title ${safeTitle} & cd /d ${PROJECT_ROOT} && set NODE_EXTRA_CA_CERTS=${CADDY_CA_CERT} && ${command}`

  info(`Starting ${service.name} in new terminal...`)
  if (service.port) {
    console.log(`${colors.gray}  Port: ${service.port}${colors.reset}`)
  }

  const startCmd = `start "${title}" cmd /k "${cmdBody}"`

  const child = spawn(startCmd, [], {
    cwd: PROJECT_ROOT,
    shell: true,
    stdio: 'ignore',
    detached: true,
  })

  child.unref()

  // We can't track these processes easily since they're in separate windows
  childProcesses.push({ name: service.name, process: null, service, exited: false, terminal: true })

  return child
}

/**
 * Start a service as a background process
 */
function startService(service, devMode, logsDir, useTerminals = false) {
  if (useTerminals && isWindows()) {
    return startServiceInTerminal(service, devMode)
  }

  const command = devMode ? service.devCommand : service.prodCommand
  const logFile = resolve(logsDir, `${service.name}.log`)

  info(`Starting ${service.name}...`)
  if (service.port) {
    console.log(`${colors.gray}  Port: ${service.port}${colors.reset}`)
  } else {
    console.log(`${colors.gray}  (Background worker - no port)${colors.reset}`)
  }
  console.log(`${colors.gray}  Logs: ${logFile}${colors.reset}`)

  const logStream = createWriteStream(logFile, { flags: 'w' })

  const child = spawn(command, [], {
    cwd: PROJECT_ROOT,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_EXTRA_CA_CERTS: CADDY_CA_CERT },
  })

  child.stdout.pipe(logStream)
  child.stderr.pipe(logStream)

  child.on('error', (err) => {
    error(`${service.name} failed to start: ${err.message}`)
  })

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      error(`${service.name} exited with code ${code}`)
    }
  })

  childProcesses.push({ name: service.name, process: child, service, exited: false })

  // Track when process exits
  child.on('exit', () => {
    const svc = childProcesses.find(s => s.process === child)
    if (svc) svc.exited = true
  })

  return child
}

/**
 * Wait for services to be ready
 */
async function waitForServices(services, timeout = 60000) {
  const startTime = Date.now()

  for (const svc of services) {
    if (!svc.service.healthCheck) {
      info(`${svc.name} is a background worker (no health check)`)
      continue
    }

    process.stdout.write(`Checking ${svc.name} at ${svc.service.healthCheck}...`)

    let ready = false
    while (!ready && Date.now() - startTime < timeout) {
      ready = await healthCheck(svc.service.healthCheck)
      if (ready) {
        console.log(`${colors.green} Ready!${colors.reset}`)
      } else {
        process.stdout.write('.')
        await sleep(2000)
      }
    }

    if (!ready) {
      console.log(`${colors.red} Timeout${colors.reset}`)
    }
  }
}

/**
 * Display service status
 * For terminal-launched services, we check health endpoints since we don't have process refs
 */
async function displayStatus(services) {
  console.log('')
  console.log(
    `${colors.white}Service          Port      Status     URL${colors.reset}`
  )
  console.log(
    `${colors.gray}-------          ----      ------     ---${colors.reset}`
  )

  for (const svc of services) {
    const name = svc.name.padEnd(16)
    const port = svc.service.port ? String(svc.service.port).padEnd(10) : 'N/A'.padEnd(10)
    const url = svc.service.healthCheck || '(worker)'

    let running = false

    if (svc.terminal || svc.external) {
      // For terminal-launched or externally running services, check health endpoint
      if (svc.service.healthCheck) {
        running = await healthCheck(svc.service.healthCheck, 1000)
      } else {
        // Background worker in terminal - assume running (can't verify)
        running = true
      }
    } else {
      // For managed processes, check exitCode
      // exitCode is null while process is running, set to a number once it exits
      running = svc.process && svc.process.exitCode === null
    }

    const status = running ? 'Running' : 'Stopped'
    const statusColor = running ? colors.green : colors.red

    console.log(`${name} ${port} ${statusColor}${status.padEnd(10)}${colors.reset} ${url}`)
  }
}

/**
 * Cleanup on exit
 */
function cleanup() {
  header('Stopping All Services')
  for (const svc of childProcesses) {
    if (svc.process && !svc.process.killed) {
      info(`Stopping ${svc.name}...`)
      svc.process.kill('SIGTERM')
    }
  }
  success('All services stopped')
}

async function main() {
  const args = parseArgs()
  const skipBuild = args.flags['skip-build']
  const devMode = args.flags.dev ?? true // Default to dev mode
  const only = args.flags.only ? args.flags.only.split(',') : null
  const useTerminals = args.flags.terminals || args.flags.t

  // Filter services if --only specified
  let services = SERVICES
  if (only) {
    services = SERVICES.filter((s) => only.includes(s.name))
    info(`Starting only: ${only.join(', ')}`)
  }

  // Build if not skipped and not in dev mode
  if (!skipBuild && !devMode) {
    header('Building All Services')
    const buildResult = run('node scripts/build/build-all.mjs', { cwd: PROJECT_ROOT })
    if (!buildResult.success) {
      error('Build failed. Fix errors before starting services.')
      process.exit(1)
    }
  }

  header('Starting Services')

  if (useTerminals) {
    info('Opening services in separate terminal windows...')
    console.log('')
  }

  // Create logs directory
  const logsDir = resolve(PROJECT_ROOT, 'logs')
  ensureDir(logsDir)

  // Start each service
  for (const service of services) {
    // Check if optional service (like Caddy) is available
    if (service.name === 'caddy') {
      try {
        const { execSync } = await import('child_process')
        // Try full path on Windows first, then fallback to PATH
        const caddyCmd = process.platform === 'win32'
          ? 'C:\\ProgramData\\chocolatey\\bin\\caddy.exe version'
          : 'caddy version'
        execSync(caddyCmd, { stdio: 'ignore' })
      } catch {
        error('Caddy not installed - HTTPS is required for local dev')
        info('Install Caddy for https://*.local.ironscout.ai domains')
        process.exit(1)
      }
    }

    startService(service, devMode, logsDir, useTerminals)
    await sleep(useTerminals ? 500 : 2000) // Shorter delay for terminals
  }

  header('Waiting for Services to Start')

  await waitForServices(childProcesses)

  header('Service Status')

  await displayStatus(childProcesses)

  console.log('')

  info('Local HTTPS URLs (via Caddy):')
  console.log(`${colors.gray}  https://app.local.ironscout.ai      - Web App${colors.reset}`)
  console.log(`${colors.gray}  https://api.local.ironscout.ai      - API${colors.reset}`)
  console.log(`${colors.gray}  https://admin.local.ironscout.ai    - Admin${colors.reset}`)
  console.log(`${colors.gray}  https://merchant.local.ironscout.ai - Merchant${colors.reset}`)
  console.log(`${colors.gray}  https://www.local.ironscout.ai      - Marketing${colors.reset}`)
  console.log('')

  info('Bull Board (Queue Monitor): http://localhost:3939/admin/queues')
  console.log(`${colors.gray}  Auth: admin / ironscout2024${colors.reset}`)
  console.log('')

  if (useTerminals) {
    success('All services started in separate terminal windows')
    info('Close the terminal windows to stop services, or run: pnpm stop:all --all')
    return
  }

  info('Press Ctrl+C to stop all services')
  console.log('')

  // Handle cleanup on exit
  process.on('SIGINT', () => {
    cleanup()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    cleanup()
    process.exit(0)
  })

  // Keep the process running
  await new Promise(() => {})
}

main().catch((e) => {
  error(e.message)
  process.exit(1)
})
