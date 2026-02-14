/**
 * Caliber Market Snapshot Module (ADR-025)
 *
 * Precomputed caliber-level market statistics.
 * Exports worker, scheduler, and computation utilities.
 */

export {
  startCaliberSnapshotWorker,
  stopCaliberSnapshotWorker,
  getCaliberSnapshotWorkerMetrics,
} from './worker'

export {
  startCaliberSnapshotScheduler,
  stopCaliberSnapshotScheduler,
  isCaliberSnapshotSchedulerRunning,
  getCaliberSnapshotSchedulerStatus,
  triggerCaliberSnapshotManual,
} from './scheduler'

export {
  computeCaliberSnapshots,
} from './compute'

export type { ComputeSnapshotsResult, CaliberSnapshotResult } from './compute'
