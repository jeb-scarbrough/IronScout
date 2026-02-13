export interface ObservedMarketContextBlockProps {
  caliberLabel: string
  lastUpdated?: string | null
  sampleCount?: number | null
  median?: number | null
  min?: number | null
  max?: number | null
}

const formatValue = (value: number) => value.toFixed(3)

export function ObservedMarketContextBlock({
  caliberLabel,
  lastUpdated,
  sampleCount,
  median,
  min,
  max,
}: ObservedMarketContextBlockProps) {
  const resolvedSampleCount = typeof sampleCount === 'number' ? sampleCount : null
  const hasSummary = resolvedSampleCount !== null
    && resolvedSampleCount >= 15
    && typeof median === 'number'
    && typeof min === 'number'
    && typeof max === 'number'
  const summary = hasSummary
    ? {
        median,
        min,
        max,
        sampleCount: resolvedSampleCount,
        lastUpdated,
      }
    : null
  const lastUpdatedSuffix = summary?.lastUpdated ? ` Last updated: ${summary.lastUpdated}.` : ''

  return (
    <section className="rounded-lg border border-iron-800 bg-iron-900/40 p-5 sm:p-6">
      <div className="space-y-4 text-sm sm:text-base text-iron-300">
        <p className="text-iron-200 leading-relaxed">
          IronScout provides observed price and availability data for {caliberLabel} ammunition across tracked online retailers. Data reflects historical price observations and does not include purchase recommendations.
        </p>
        {summary ? (
          <p className="leading-relaxed">
            Observed 30-Day Price Range (Per Round): median: {formatValue(summary.median)}, lowest: {formatValue(summary.min)}, highest: {formatValue(summary.max)}, sample size: {summary.sampleCount}.{lastUpdatedSuffix}
          </p>
        ) : (
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
        )}
      </div>
    </section>
  )
}
