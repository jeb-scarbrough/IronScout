import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

function stripQuotes(value) {
  if (!value) return value
  const first = value[0]
  const last = value[value.length - 1]
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1)
  }
  return value
}

function unescapeValue(value) {
  if (!value) return value
  return value
    .replaceAll('\\n', '\n')
    .replaceAll('\\r', '\r')
    .replaceAll('\\t', '\t')
    .replaceAll('\\"', '"')
    .replaceAll("\\'", "'")
}

function parseEnvLine(line) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null

  const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed
  const eqIndex = normalized.indexOf('=')
  if (eqIndex <= 0) return null

  const key = normalized.slice(0, eqIndex).trim()
  let value = normalized.slice(eqIndex + 1).trim()
  if (!key) return null

  value = stripQuotes(value)
  value = unescapeValue(value)
  return { key, value }
}

function applyEnvFile(filePath, override) {
  if (!existsSync(filePath)) return false
  const raw = readFileSync(filePath, 'utf8')
  const lines = raw.split(/\r?\n/)
  for (const line of lines) {
    const parsed = parseEnvLine(line)
    if (!parsed) continue
    if (!override && Object.prototype.hasOwnProperty.call(process.env, parsed.key)) {
      continue
    }
    process.env[parsed.key] = parsed.value
  }
  return true
}

export function loadEnv({ rootDir = process.cwd(), overrideLocal = true } = {}) {
  const envPath = resolve(rootDir, '.env')
  const envLocalPath = resolve(rootDir, '.env.local')

  applyEnvFile(envPath, false)
  applyEnvFile(envLocalPath, overrideLocal)
}

