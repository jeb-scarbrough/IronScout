import { isSummaryAvailable, type MarketSnapshotArtifact } from '@/lib/market-snapshots'

export interface ObservedMarketContextBlockProps {
  caliberLabel: string
  snapshot: MarketSnapshotArtifact | null
}

const formatValue = (value: number) => value.toFixed(3)

export function ObservedMarketContextBlock({
  caliberLabel,
  snapshot,
}: ObservedMarketContextBlockProps) {
  const summary = isSummaryAvailable(snapshot) ? snapshot : null
  const hasSummary = summary !== null
  const hasInsufficientData = snapshot !== null
    && snapshot.dataStatus !== 'UNAVAILABLE'
    && !hasSummary

  return (
    <section className="rounded-lg border border-iron-800 bg-iron-900/40 p-5 sm:p-6">
      <div className="space-y-4 text-sm sm:text-base text-iron-300">
        <p className="text-iron-200 leading-relaxed">
          IronScout provides observed price and availability data for {caliberLabel} ammunition across tracked online retailers. Data reflects historical price observations and does not include purchase recommendations.
        </p>
        {hasSummary ? (
          <p className="leading-relaxed">
            Observed 30-Day Price Range (Per Round): median: {formatValue(summary.pricePerRound.median)}, lowest: {formatValue(summary.pricePerRound.min)}, highest: {formatValue(summary.pricePerRound.max)}, sample size: {summary.counts.sampleCount}.
          </p>
        ) : hasInsufficientData ? (
          <>
            <p className="leading-relaxed">
              At this time, there are not yet enough recent observations to summarize a reliable 30-day price range for this caliber.
            </p>
            <p className="leading-relaxed">
              Market context summaries appear automatically once sufficient observations are available.
            </p>
            <p className="leading-relaxed">
              Coverage is partial and integration depth varies by retailer and source. Absence of listings does not imply absence of inventory in the broader market.
            </p>
          </>
        ) : (
          <>
            <p className="leading-relaxed">
              Market context is currently unavailable for this caliber.
            </p>
            <p className="leading-relaxed">
              Snapshot data will appear here once the next static update is published.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
