import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

interface SmokeCommandArgs {
  siteId: string
  urlFile: string
  limit?: number
}

export async function runSmokeCommand(args: SmokeCommandArgs): Promise<number> {
  if (!args.siteId) {
    console.error('Missing --site-id <siteId>')
    return 2
  }
  if (!args.urlFile) {
    console.error('Missing --url-file <path>')
    return 2
  }

  const repoRoot = process.cwd()
  const urlFilePath = resolve(repoRoot, args.urlFile)
  if (!existsSync(urlFilePath)) {
    console.error(`URL file not found: ${urlFilePath}`)
    return 2
  }

  const limitArg = args.limit ? ` --limit ${args.limit}` : ''
  try {
    execSync(
      `node scripts/scraper/dry-run.mjs --adapter-id ${args.siteId} --url-file "${urlFilePath}"${limitArg}`,
      {
        cwd: repoRoot,
        stdio: 'inherit',
      }
    )
    return 0
  } catch {
    return 2
  }
}
