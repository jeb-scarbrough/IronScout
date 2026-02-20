import { runAddCommand } from './commands/add.js'
import { runValidateCommand } from './commands/validate.js'
import { runTestCommand } from './commands/test.js'
import { runSmokeCommand } from './commands/smoke.js'
import { runDbAddRetailerSourceCommand } from './commands/db-add-retailer-source.js'

function parseFlags(argv: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) {
      continue
    }
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      flags[key] = next
      i++
    } else {
      flags[key] = true
    }
  }
  return flags
}

function asString(value: string | boolean | undefined): string {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: string | boolean | undefined): number | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function printHelp(): void {
  console.log('Scraper CLI')
  console.log('')
  console.log('Commands:')
  console.log('  add --site-id <id> --name "<name>" --mode html|json [--owner "<owner>"] [--force]')
  console.log('  validate --site-id <id>')
  console.log('  test --site-id <id>')
  console.log('  smoke --site-id <id> --url-file <path> [--limit 10]')
  console.log('  db:add-retailer-source --site-id <id> --retailer-name "<name>" --website <url> --source-name "<name>" --source-url <url>')
}

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv
  if (!command || command === '--help' || command === '-h') {
    printHelp()
    process.exit(0)
  }

  const flags = parseFlags(rest)
  if (flags.help === true || flags.h === true) {
    printHelp()
    process.exit(0)
  }

  let exitCode = 2

  switch (command) {
    case 'add':
      exitCode = await runAddCommand({
        siteId: asString(flags['site-id']),
        name: asString(flags.name),
        mode: (asString(flags.mode) as 'html' | 'json') || 'html',
        owner: asString(flags.owner) || 'harvester',
        force: flags.force === true,
      })
      break
    case 'validate':
      exitCode = await runValidateCommand({
        siteId: asString(flags['site-id']),
      })
      break
    case 'test':
      exitCode = await runTestCommand({
        siteId: asString(flags['site-id']),
      })
      break
    case 'smoke':
      exitCode = await runSmokeCommand({
        siteId: asString(flags['site-id']),
        urlFile: asString(flags['url-file']),
        limit: asNumber(flags.limit),
      })
      break
    case 'db:add-retailer-source':
    case 'db-add-retailer-source':
      exitCode = await runDbAddRetailerSourceCommand({
        siteId: asString(flags['site-id']),
        retailerName: asString(flags['retailer-name']),
        website: asString(flags.website),
        sourceName: asString(flags['source-name']),
        sourceUrl: asString(flags['source-url']),
      })
      break
    default:
      console.error(`Unknown command: ${command}`)
      printHelp()
      exitCode = 2
  }

  process.exit(exitCode)
}

main().catch(error => {
  const withCode = error as Error & { exitCode?: number }
  console.error(withCode.message)
  process.exit(withCode.exitCode ?? 1)
})
