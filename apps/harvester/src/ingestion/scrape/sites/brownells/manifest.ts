import type { ScrapePluginManifest } from '../../types.js'

export const manifest: ScrapePluginManifest = {
  id: 'brownells',
  name: 'Brownells',
  owner: 'harvester',
  version: '1.0.0',
  mode: 'html',
  baseUrls: ['https://www.brownells.com'],
  rateLimit: {
    requestsPerSecond: 0.5,
    minDelayMs: 500,
    maxConcurrent: 1,
  },
}
