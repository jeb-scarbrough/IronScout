/**
 * Scraper Constants
 *
 * Shared constants for scraper management.
 * Separated from server actions to comply with Next.js "use server" restrictions.
 */

/** Known adapters - must match harvester registry */
export const KNOWN_ADAPTERS = [
  { id: 'sgammo', name: 'SGAmmo', domain: 'sgammo.com' },
  // Add new adapters here as they're implemented
] as const

export type KnownAdapter = (typeof KNOWN_ADAPTERS)[number]
