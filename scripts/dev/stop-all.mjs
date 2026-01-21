#!/usr/bin/env node
/**
 * Stop All IronScout Services
 * Cross-platform Node.js version
 *
 * Usage: node scripts/dev/stop-all.mjs [--force] [--verbose]
 */

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  colors,
  success,
  error,
  info,
  warn,
  header,
  debug,
  isWindows,
  runCapture,
  killProcess,
  parseArgs,
  sleep,
  readJson,
} from '../lib/utils.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../..')
const PID_FILE = resolve(PROJECT_ROOT, '.ironscout', 'pids.json')

// Service ports to check
const SERVICE_PORTS = [
  { name: 'API', port: 8000 },
  { name: 'Web', port: 3000 },
  { name: 'Web (alt)', port: 3001 },
  { name: 'Admin', port: 3002 },
  { name: 'Merchant', port: 3003 },
  { name: 'WWW (marketing)', port: 3004 },
  { name: 'Bull Board', port: 3939 },
]

/**
 * Find PIDs listening on a port
 */
function findPidsOnPort(port) {
  const pids = new Set()

  if (isWindows()) {
    const result = runCapture(`netstat -ano`)
    if (result.success && result.output) {
      const lines = result.output.split('\n')
      for (const line of lines) {
        // Match lines like "TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    12345"
        // Be careful to match exact port (not 30001 when looking for 3000)
        const regex = new RegExp(`:${port}\\s+.*LISTENING\\s+(\\d+)`, 'i')
        const match = line.match(regex)
        if (match) {
          pids.add(parseInt(match[1], 10))
        }
      }
    }
  } else {
    const result = runCapture(`lsof -t -i:${port}`)
    if (result.success && result.output) {
      result.output.split('\n').forEach((p) => {
        const pid = parseInt(p, 10)
        if (pid) pids.add(pid)
      })
    }
  }

  return Array.from(pids)
}

/**
 * Get process name by PID
 */
function getProcessName(pid) {
  if (isWindows()) {
    const result = runCapture(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`)
    if (result.success && result.output) {
      const match = result.output.match(/"([^"]+)"/)
      return match ? match[1] : 'unknown'
    }
  } else {
    const result = runCapture(`ps -p ${pid} -o comm=`)
    if (result.success && result.output) {
      return result.output.trim()
    }
  }
  return 'unknown'
}

/**
 * Find IronScout Node processes
 */
function findIronScoutProcesses(verbose) {
  const processes = []

  if (isWindows()) {
    const psResult = runCapture(
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,CommandLine | ConvertTo-Json -Depth 2"'
    )
    if (psResult.success && psResult.output) {
      try {
        const parsed = JSON.parse(psResult.output)
        const rows = Array.isArray(parsed) ? parsed : [parsed]
        for (const row of rows) {
          const pid = Number(row.ProcessId)
          const cmdLine = row.CommandLine || ''
          if (!pid || !cmdLine) continue

          debug(`PID ${pid}: ${cmdLine}`, verbose)

          if (
            cmdLine.includes('IronScout') ||
            cmdLine.includes('ironscout') ||
            cmdLine.includes('@ironscout') ||
            cmdLine.match(/apps[\\/](web|api|admin|merchant|harvester)/) ||
            cmdLine.includes('dist\\index.js') ||
            cmdLine.includes('dist/index.js') ||
            cmdLine.includes('dist\\worker.js') ||
            cmdLine.includes('dist/worker.js')
          ) {
            let appName = 'Node'
            if (cmdLine.includes('harvester') || cmdLine.includes('worker.js')) appName = 'Harvester'
            else if (cmdLine.includes('apps/web') || cmdLine.includes('apps\\web')) appName = 'Web'
            else if (cmdLine.includes('apps/api') || cmdLine.includes('apps\\api')) appName = 'API'
            else if (cmdLine.includes('apps/admin') || cmdLine.includes('apps\\admin')) appName = 'Admin'
            else if (cmdLine.includes('apps/merchant') || cmdLine.includes('apps\\merchant')) appName = 'Merchant'

            processes.push({ pid, name: appName, cmdLine })
          }
        }
      } catch {
        // Fall back to WMIC parsing if JSON output fails
      }
    }
    if (processes.length === 0) {
      const result = runCapture('wmic process where "name=\'node.exe\'" get ProcessId,CommandLine /format:csv')
      if (result.success && result.output) {
        const lines = result.output.split('\n').filter((l) => l.trim())
        for (const line of lines) {
          const parts = line.split(',')
          if (parts.length >= 3) {
            const cmdLine = parts.slice(1, -1).join(',')
            const pid = parseInt(parts[parts.length - 1], 10)

            debug(`PID ${pid}: ${cmdLine}`, verbose)

            if (
              cmdLine &&
              pid &&
              (cmdLine.includes('IronScout') ||
                cmdLine.includes('ironscout') ||
                cmdLine.includes('@ironscout') ||
                cmdLine.match(/apps[\\/](web|api|admin|merchant|harvester)/) ||
                cmdLine.includes('dist\\index.js') ||
                cmdLine.includes('dist/index.js') ||
                cmdLine.includes('dist\\worker.js') ||
                cmdLine.includes('dist/worker.js'))
            ) {
              let appName = 'Node'
              if (cmdLine.includes('harvester') || cmdLine.includes('worker.js')) appName = 'Harvester'
              else if (cmdLine.includes('apps/web') || cmdLine.includes('apps\\web')) appName = 'Web'
              else if (cmdLine.includes('apps/api') || cmdLine.includes('apps\\api')) appName = 'API'
              else if (cmdLine.includes('apps/admin') || cmdLine.includes('apps\\admin')) appName = 'Admin'
              else if (cmdLine.includes('apps/merchant') || cmdLine.includes('apps\\merchant')) appName = 'Merchant'

              processes.push({ pid, name: appName, cmdLine })
            }
          }
        }
      }
    }
  } else {
    // Use pgrep and ps on Unix
    const result = runCapture("pgrep -f 'node.*ironscout|node.*@ironscout' || true")
    if (result.success && result.output) {
      const pids = result.output.split('\n').filter((p) => p.trim())
      for (const pidStr of pids) {
        const pid = parseInt(pidStr, 10)
        if (pid) {
          const cmdResult = runCapture(`ps -p ${pid} -o args=`)
          const cmdLine = cmdResult.success ? cmdResult.output : ''

          debug(`PID ${pid}: ${cmdLine}`, verbose)

          let appName = 'Node'
          if (cmdLine.includes('harvester') || cmdLine.includes('worker.js')) appName = 'Harvester'
          else if (cmdLine.includes('apps/web')) appName = 'Web'
          else if (cmdLine.includes('apps/api')) appName = 'API'
          else if (cmdLine.includes('apps/admin')) appName = 'Admin'
          else if (cmdLine.includes('apps/merchant')) appName = 'Merchant'

          processes.push({ pid, name: appName, cmdLine })
        }
      }
    }
  }

  return processes
}

/**
 * Kill all node processes matching IronScout patterns (Windows-specific)
 */
function killAllNodeProcessesWindows() {
  // Use taskkill to kill all node processes - aggressive but effective
  const result = runCapture('taskkill /F /IM node.exe')
  return result.success
}

async function main() {
  const args = parseArgs()
  const force = args.flags.force || args.flags.f
  const verbose = args.flags.verbose || args.flags.v
  const killAll = args.flags.all || args.flags.a

  header('Stopping All Services')

  if (force) {
    warn('Force mode enabled - killing immediately')
  }

  // On Windows with --all flag, just kill all node processes
  if (isWindows() && killAll) {
    info('Killing all Node.js processes...')
    killAllNodeProcessesWindows()
    success('Killed all Node.js processes')
    console.log('')
    info('Note: Terminal windows may still be open - close them manually.')
    return
  }

  let stoppedCount = 0
  const myPid = process.pid

  debug(`My PID: ${myPid} (will not kill self)`, verbose)

  const pidData = readJson(PID_FILE)
  if (pidData?.services?.length) {
    info('Stopping tracked processes...')
    for (const svc of pidData.services) {
      if (!svc.pid || svc.pid === myPid) continue
      info(`Stopping ${svc.name} (PID: ${svc.pid})...`)
      if (killProcess(svc.pid)) {
        await sleep(300)
        success(`  Stopped ${svc.name}`)
        stoppedCount++
      }
    }
  }

  // Method 1: Stop by port
  info('Checking ports...')

  for (const service of SERVICE_PORTS) {
    const pids = findPidsOnPort(service.port)
    debug(`Port ${service.port} (${service.name}): ${pids.length} process(es)`, verbose)

    for (const pid of pids) {
      if (pid === myPid) {
        debug(`Skipping own PID ${pid}`, verbose)
        continue
      }

      const procName = getProcessName(pid)
      info(`Stopping ${service.name} (PID: ${pid}, Process: ${procName})...`)

      if (killProcess(pid)) {
        await sleep(300)
        // Verify it's stopped
        const stillRunning = findPidsOnPort(service.port).includes(pid)
        if (!stillRunning) {
          success(`  Stopped ${service.name} on port ${service.port}`)
          stoppedCount++
        } else {
          error(`  Failed to stop PID ${pid}`)
        }
      } else {
        error(`  Error stopping PID ${pid}`)
      }
    }
  }

  // Method 2: Find IronScout Node processes
  info('Checking Node.js processes...')

  const processes = findIronScoutProcesses(verbose)
  const stoppedPids = new Set()

  for (const proc of processes) {
    if (proc.pid === myPid || stoppedPids.has(proc.pid)) {
      continue
    }

    info(`Stopping ${proc.name} process (PID: ${proc.pid})...`)

    if (killProcess(proc.pid)) {
      await sleep(300)
      success(`  Stopped ${proc.name}`)
      stoppedCount++
      stoppedPids.add(proc.pid)
    } else {
      error(`  Error stopping PID ${proc.pid}`)
    }
  }

  // Summary
  header('Summary')

  if (stoppedCount > 0) {
    success(`Stopped ${stoppedCount} process(es)`)
  } else {
    info('No running services found')
  }

  // Verify ports are free
  console.log('')
  info('Port status:')
  for (const service of SERVICE_PORTS) {
    const pids = findPidsOnPort(service.port)
    if (pids.length > 0) {
      warn(`  Port ${service.port} (${service.name}) - STILL IN USE`)
    } else {
      console.log(`${colors.gray}  Port ${service.port} (${service.name}) - free${colors.reset}`)
    }
  }

  console.log('')
}

main().catch((e) => {
  error(e.message)
  process.exit(1)
})
