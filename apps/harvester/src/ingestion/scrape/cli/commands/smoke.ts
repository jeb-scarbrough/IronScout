import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveRepoRoot } from '../paths.js'

interface SmokeCommandArgs {
  siteId: string
  urlFile: string
  limit?: number
}

const SITE_ID_PATTERN = /^[a-z0-9_]+$/

export async function runSmokeCommand(args: SmokeCommandArgs): Promise<number> {
  if (!args.siteId) {
    console.error('Missing --site-id <siteId>')
    return 2
  }
  if (!SITE_ID_PATTERN.test(args.siteId)) {
    console.error('siteId must match /^[a-z0-9_]+$/')
    return 2
  }
  if (!args.urlFile) {
    console.error('Missing --url-file <path>')
    return 2
  }

  const repoRoot = resolveRepoRoot()
  const urlFilePath = resolve(repoRoot, args.urlFile)
  if (!existsSync(urlFilePath)) {
    console.error(`URL file not found: ${urlFilePath}`)
    return 2
  }

  try {
    const cliArgs = [
      'scripts/scraper/dry-run.mjs',
      '--adapter-id',
      args.siteId,
      '--url-file',
      urlFilePath,
    ]
    if (args.limit !== undefined) {
      cliArgs.push('--limit', String(args.limit))
    }

    const result = spawnSync(process.execPath, cliArgs, {
      cwd: repoRoot,
      stdio: 'inherit',
    })
    return result.status === 0 ? 0 : 2
  } catch {
    return 2
  }
}
