import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const contentDir = path.join(rootDir, 'content')

const SECTION_ROUTE_FALLBACKS = {
  ammo: new Set(['handgun', 'rifle', 'rimfire', 'shotgun']),
}

function readMarkdownSlugs(section) {
  const dirPath = path.join(contentDir, section)
  return readdirSync(dirPath)
    .filter((entry) => entry.endsWith('.md'))
    .map((entry) => entry.replace(/\.md$/, ''))
}

function readNestedMarkdownSlugs(section) {
  const dirPath = path.join(contentDir, section)
  const map = new Map()

  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const typeSlugs = readdirSync(path.join(dirPath, entry.name))
      .filter((fileName) => fileName.endsWith('.md'))
      .map((fileName) => fileName.replace(/\.md$/, ''))
    map.set(entry.name, new Set(typeSlugs))
  }

  return map
}

function* iterMarkdownFiles(startDir) {
  for (const entry of readdirSync(startDir, { withFileTypes: true })) {
    const fullPath = path.join(startDir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name.startsWith('_')) {
        continue
      }
      yield* iterMarkdownFiles(fullPath)
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      yield fullPath
    }
  }
}

function normalizeHrefPath(href) {
  const [withoutQuery] = href.split('?')
  const [withoutHash] = withoutQuery.split('#')
  if (withoutHash.length > 1 && withoutHash.endsWith('/')) {
    return withoutHash.slice(0, -1)
  }

  return withoutHash
}

const validAmmoSlugs = new Set([
  ...readMarkdownSlugs('ammo'),
  ...SECTION_ROUTE_FALLBACKS.ammo,
])
const validCaliberSlugs = new Set(readMarkdownSlugs('calibers'))
const validCaliberTypeSlugs = readNestedMarkdownSlugs('caliber-types')
const validBrandSlugs = new Set(readMarkdownSlugs('brands'))
const validRetailerSlugs = new Set(readMarkdownSlugs('retailers'))

const brokenLinks = []
const markdownLinkPattern = /\[[^\]]+\]\((\/[^)\s]+)\)/g

for (const filePath of iterMarkdownFiles(contentDir)) {
  const raw = readFileSync(filePath, 'utf8')
  const lines = raw.split(/\r?\n/)

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    for (const match of line.matchAll(markdownLinkPattern)) {
      const href = normalizeHrefPath(match[1])
      const segments = href.split('/').filter(Boolean)
      if (segments.length === 0) continue

      const [section, slug, type] = segments
      let isValid = true
      let reason = ''

      if (section === 'ammo') {
        isValid = segments.length === 2 && validAmmoSlugs.has(slug)
        reason = isValid ? '' : 'unknown ammo slug'
      } else if (section === 'caliber') {
        if (segments.length === 2) {
          isValid = validCaliberSlugs.has(slug)
          reason = isValid ? '' : 'unknown caliber slug'
        } else if (segments.length === 3) {
          const validTypes = validCaliberTypeSlugs.get(slug)
          isValid = Boolean(validTypes && validTypes.has(type))
          reason = isValid ? '' : 'unknown caliber type route'
        }
      } else if (section === 'brand') {
        isValid = segments.length === 2 && validBrandSlugs.has(slug)
        reason = isValid ? '' : 'unknown brand slug'
      } else if (section === 'retailer') {
        isValid = segments.length === 2 && validRetailerSlugs.has(slug)
        reason = isValid ? '' : 'unknown retailer slug'
      }

      if (!isValid) {
        brokenLinks.push({
          filePath: path.relative(rootDir, filePath),
          line: i + 1,
          href,
          reason,
        })
      }
    }
  }
}

if (brokenLinks.length > 0) {
  console.error(`Broken internal links found: ${brokenLinks.length}`)
  for (const link of brokenLinks) {
    console.error(`- ${link.filePath}:${link.line} -> ${link.href} (${link.reason})`)
  }
  process.exit(1)
}

console.log('Internal markdown links verified: no broken ammo/caliber/brand/retailer links detected.')
