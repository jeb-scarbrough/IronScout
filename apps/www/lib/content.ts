import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const CONTENT_ROOT = (() => {
  const cwd = process.cwd()
  const direct = join(cwd, 'content')
  if (existsSync(direct)) {
    return direct
  }

  return join(cwd, 'apps', 'www', 'content')
})()

export interface MarkdownContent {
  frontmatter: Record<string, string>
  body: string
}

function parseFrontmatter(raw: string): MarkdownContent {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    return { frontmatter: {}, body: raw }
  }

  const frontmatterLines = match[1]?.split(/\r?\n/) ?? []
  const frontmatter: Record<string, string> = {}

  for (const line of frontmatterLines) {
    const index = line.indexOf(':')
    if (index === -1) continue
    const key = line.slice(0, index).trim()
    const value = line.slice(index + 1).trim()
    if (key) {
      // Strip surrounding quotes from frontmatter values
      frontmatter[key] = value.replace(/^["'](.+)["']$/, '$1')
    }
  }

  return { frontmatter, body: match[2] ?? '' }
}

export function getContentSlugs(section: string): string[] {
  const directory = join(CONTENT_ROOT, section)
  if (!existsSync(directory)) return []

  return readdirSync(directory)
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.replace(/\.md$/, ''))
}

/**
 * Get all nested content paths for a section with subdirectories.
 * Returns arrays of [parent, child] slug pairs.
 * E.g., content/caliber-types/9mm/fmj.md → { parent: '9mm', child: 'fmj' }
 */
export function getNestedContentSlugs(section: string): Array<{ parent: string; child: string }> {
  const directory = join(CONTENT_ROOT, section)
  if (!existsSync(directory)) return []

  const results: Array<{ parent: string; child: string }> = []
  const entries = readdirSync(directory, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subDir = join(directory, entry.name)
      const files = readdirSync(subDir).filter((f) => f.endsWith('.md'))
      for (const file of files) {
        results.push({ parent: entry.name, child: file.replace(/\.md$/, '') })
      }
    }
  }

  return results
}

/**
 * Read markdown content from a nested path: section/parent/child.md
 */
export function readNestedMarkdownContent(
  section: string,
  parent: string,
  child: string
): MarkdownContent | null {
  const filePath = join(CONTENT_ROOT, section, parent, `${child}.md`)
  if (!existsSync(filePath)) {
    return null
  }

  const raw = readFileSync(filePath, 'utf8')
  return parseFrontmatter(raw)
}

export function readMarkdownContent(section: string, slug: string): MarkdownContent | null {
  const filePath = join(CONTENT_ROOT, section, `${slug}.md`)
  if (!existsSync(filePath)) {
    return null
  }

  const raw = readFileSync(filePath, 'utf8')
  return parseFrontmatter(raw)
}
