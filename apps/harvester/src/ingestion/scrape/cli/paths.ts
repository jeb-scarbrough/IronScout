import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

function hasWorkspaceMarker(path: string): boolean {
  return existsSync(resolve(path, 'pnpm-workspace.yaml'))
}

function findWorkspaceRoot(startPath: string): string | null {
  let current = resolve(startPath)
  for (;;) {
    if (hasWorkspaceMarker(current)) {
      return current
    }

    const parent = resolve(current, '..')
    if (parent === current) {
      return null
    }
    current = parent
  }
}

export function resolveRepoRoot(): string {
  const fromCwd = findWorkspaceRoot(process.cwd())
  if (fromCwd) {
    return fromCwd
  }

  throw new Error('Unable to resolve workspace root from current working directory')
}
