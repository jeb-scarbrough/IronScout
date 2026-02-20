import { fetchWithPolicy } from '../../kit/http.js'
import { manifest } from './manifest.js'

export async function fetchRaw(url: string) {
  // Note: bridge mode uses legacy fetcher during migration.
  // This fetch is used by plugin-native runtime and scraper smoke.
  return fetchWithPolicy({
    url,
    mode: manifest.mode,
    baseUrls: manifest.baseUrls,
    rateLimit: manifest.rateLimit,
  })
}
