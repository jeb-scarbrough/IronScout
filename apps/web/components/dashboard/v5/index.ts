/**
 * Dashboard v5 Types
 *
 * @deprecated The v5 dashboard has been replaced by the My Loadout system.
 * These types are retained only for backwards compatibility with:
 * - apps/web/hooks/use-dashboard-v5.ts (deprecated)
 * - apps/web/lib/api.ts getDashboardV5() function (deprecated)
 *
 * These will be removed in a future cleanup (Issue #60).
 */

export type {
  SignalAge,
  BadgeType,
  WatchlistStatus,
  SpotlightSignalType,
  SpotlightData,
  WatchlistItem,
  AlertItem,
  GunLockerMatchItem,
  DashboardV5Data,
} from './types'
