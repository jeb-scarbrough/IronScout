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
      frontmatter[key] = value
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

export function readMarkdownContent(section: string, slug: string): MarkdownContent | null {
  const filePath = join(CONTENT_ROOT, section, `${slug}.md`)
  if (!existsSync(filePath)) {
    return null
  }

  const raw = readFileSync(filePath, 'utf8')
  return parseFrontmatter(raw)
}
