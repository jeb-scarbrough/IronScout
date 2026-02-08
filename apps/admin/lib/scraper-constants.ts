/**
 * Scraper Constants
 *
 * Shared constants for scraper management.
 * Separated from server actions to comply with Next.js "use server" restrictions.
 */

/** Known adapters - must match harvester registry */
export { KNOWN_ADAPTERS } from '@ironscout/scraper-registry'
export type { KnownAdapter } from '@ironscout/scraper-registry'

/** Schedule presets for adapter-level scheduling */
export const SCHEDULE_PRESETS = {
  'EVERY_30_MIN': { label: 'Every 30 min', cron: '*/30 * * * *' },
  'EVERY_HOUR': { label: 'Every hour', cron: '0 * * * *' },
  'EVERY_4_HOURS': { label: 'Every 4 hours', cron: '0 0,4,8,12,16,20 * * *' },
  'EVERY_6_HOURS': { label: 'Every 6 hours', cron: '0 0,6,12,18 * * *' },
  'DAILY': { label: 'Daily', cron: '0 0 * * *' },
} as const

export type SchedulePresetKey = keyof typeof SCHEDULE_PRESETS
