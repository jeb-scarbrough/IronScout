import type { ScrapeSitePlugin } from '../../types.js'
import { manifest } from './manifest.js'
import { fetchRaw } from './fetch.js'
import { extractRaw } from './extract.js'
import { normalizeRaw } from './normalize.js'

export const plugin: ScrapeSitePlugin = {
  manifest,
  fetchRaw: async input => fetchRaw(input.url),
  extractRaw,
  normalizeRaw,
}
