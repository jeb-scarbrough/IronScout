import type { Prisma } from './generated/prisma/client.js'

export declare const CALIBER_SNAPSHOT_COMPUTATION_VERSION: 'snapshot/2026-02-16.1'

export interface CaliberSnapshotStatsQueryArgs {
  caliberAliases: ReadonlyArray<string>
  windowStart: Date
  windowEnd: Date
}

export declare function buildCaliberSnapshotStatsQuery(
  args: CaliberSnapshotStatsQueryArgs
): Prisma.Sql

export interface ProductMedianPriceQueryArgs {
  productIds: ReadonlyArray<string>
  windowStart: Date
  windowEnd: Date
  inStockOnly?: boolean
}

export declare function buildProductMedianPriceQuery(
  args: ProductMedianPriceQueryArgs
): Prisma.Sql

export interface CaliberPriceCheckStatsQueryArgs {
  caliberAliases: ReadonlyArray<string>
  windowStart: Date
  windowEnd: Date
  brandPattern?: string | null
  grainValue?: number | null
  roundCountValue?: number | null
  caseMaterialPattern?: string | null
  bulletTypeValue?: string | null
}

export declare function buildCaliberPriceCheckStatsQuery(
  args: CaliberPriceCheckStatsQueryArgs
): Prisma.Sql
