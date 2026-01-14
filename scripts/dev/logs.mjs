#!/usr/bin/env node
/**
 * View Logs from IronScout Services
 * Cross-platform Node.js version
 *
 * Usage:
 *   node scripts/dev/logs.mjs              # List available services
 *   node scripts/dev/logs.mjs web          # Tail web logs
 *   node scripts/dev/logs.mjs api          # Tail api logs
 *   node scripts/dev/logs.mjs --all        # Show recent logs from all services
 *   node scripts/dev/logs.mjs web -n 100   # Show last 100 lines
 */

import { existsSync, statSync, createReadStream } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createInterface } from 'readline'
import { colors, success, error, info, header, parseArgs } from '../lib/utils.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../..')
const LOGS_DIR = resolve(PROJECT_ROOT, 'logs')

const SERVICES = ['api', 'web', 'admin', 'merchant', 'harvester', 'bullboard']

/**
 * Get log file info for a service
 */
function getLogInfo(service) {
  const logFile = resolve(LOGS_DIR, `${service}.log`)
  if (!existsSync(logFile)) {
    return null
  }

  const stats = statSync(logFile)
  const size = stats.size

  let sizeStr
  if (size > 1024 * 1024) {
    sizeStr = `${(size / (1024 * 1024)).toFixed(2)} MB`
  } else if (size > 1024) {
    sizeStr = `${(size / 1024).toFixed(2)} KB`
  } else {
    sizeStr = `${size} B`
  }

  return { path: logFile, size: sizeStr, bytes: size }
}

/**
 * Read last N lines from a file
 */
async function tailFile(filePath, lines = 50) {
  return new Promise((resolve, reject) => {
    const result = []

    const rl = createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity,
    })

    rl.on('line', (line) => {
      result.push(line)
      if (result.length > lines) {
        result.shift()
      }
    })

    rl.on('close', () => {
      resolve(result)
    })

    rl.on('error', reject)
  })
}

/**
 * Watch a file for changes (simple polling approach)
 */
async function watchFile(filePath) {
  let lastSize = 0
  let lastContent = ''

  const checkFile = async () => {
    try {
      const stats = statSync(filePath)
      if (stats.size > lastSize) {
        const stream = createReadStream(filePath, { start: lastSize })
        const rl = createInterface({ input: stream, crlfDelay: Infinity })

        rl.on('line', (line) => {
          console.log(line)
        })

        await new Promise((resolve) => rl.on('close', resolve))
        lastSize = stats.size
      }
    } catch (e) {
      // File might have been truncated
      lastSize = 0
    }
  }

  // Initial read of last 50 lines
  const initialLines = await tailFile(filePath, 50)
  for (const line of initialLines) {
    console.log(line)
  }
  lastSize = statSync(filePath).size

  // Poll for changes
  const interval = setInterval(checkFile, 500)

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    clearInterval(interval)
    process.exit(0)
  })

  // Keep running
  await new Promise(() => {})
}

async function main() {
  const args = parseArgs()
  const service = args._[0]
  const showAll = args.flags.all || args.flags.a
  const lines = parseInt(args.flags.n || args.flags.lines || '50', 10)

  if (!service && !showAll) {
    header('Available Services')

    for (const svc of SERVICES) {
      const logInfo = getLogInfo(svc)
      const name = svc.padEnd(12)

      if (logInfo) {
        process.stdout.write(`  ${name} `)
        console.log(`${colors.green}Log file (${logInfo.size})${colors.reset}`)
      } else {
        console.log(`  ${name} ${colors.gray}Not running${colors.reset}`)
      }
    }

    console.log('')
    info('Usage: node scripts/dev/logs.mjs <service>')
    info('       node scripts/dev/logs.mjs --all')
    return
  }

  if (showAll) {
    for (const svc of SERVICES) {
      const logInfo = getLogInfo(svc)
      if (logInfo) {
        header(`${svc} Logs (last ${lines} lines)`)
        const logLines = await tailFile(logInfo.path, lines)
        for (const line of logLines) {
          console.log(line)
        }
      }
    }
    return
  }

  // Single service
  if (!SERVICES.includes(service)) {
    error(`Unknown service: ${service}`)
    info(`Available services: ${SERVICES.join(', ')}`)
    process.exit(1)
  }

  const logInfo = getLogInfo(service)
  if (!logInfo) {
    error(`Service '${service}' not found or not running`)
    info('Start services with: node scripts/dev/start-all.mjs')
    process.exit(1)
  }

  header(`${service} Logs`)
  info(`Tailing ${logInfo.path} (Ctrl+C to stop)`)
  console.log('')

  await watchFile(logInfo.path)
}

main().catch((e) => {
  error(e.message)
  process.exit(1)
})
