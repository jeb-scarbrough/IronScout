'use client'

import { useEffect, useState } from 'react'

// ADR-025: Slug-to-CaliberValue mapping for www caliber pages.
// Matches CALIBER_SLUG_MAP in packages/db/calibers.ts.
// Inlined here to avoid build issues with packages/db in static export.
const CALIBER_SLUG_MAP: Record<string, string> = {
  '9mm': '9mm',
  '556-nato': '.223/5.56',
  '308-winchester': '.308/7.62x51',
  '22-lr': '.22 LR',
  '45-acp': '.45 ACP',
  '300-blackout': '.300 AAC Blackout',
  '30-06-springfield': '.30-06',
  '65-creedmoor': '6.5 Creedmoor',
  '223-remington': '.223/5.56',
  '762x39': '7.62x39',
  '380-acp': '.380 ACP',
  '40-sw': '.40 S&W',
  '10mm-auto': '10mm Auto',
  '12-gauge': '12ga',
}

export interface ObservedMarketContextBlockProps {
  caliberLabel: string
  caliberSlug: string
  apiBaseUrl: string
}

interface SnapshotData {
  median: number | null
  min: number | null
  max: number | null
  sampleCount: number
  computedAt: string
}

const formatValue = (value: number) => value.toFixed(3)

export function ObservedMarketContextBlock({
  caliberLabel,
  caliberSlug,
  apiBaseUrl,
}: ObservedMarketContextBlockProps) {
  const [data, setData] = useState<SnapshotData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const caliberValue = CALIBER_SLUG_MAP[caliberSlug]
    if (!caliberValue) {
      setLoading(false)
      return
    }

    fetch(`${apiBaseUrl}/api/market-snapshots/calibers/${encodeURIComponent(caliberValue)}`)
      .then(res => {
        if (!res.ok) return null
        return res.json()
      })
      .then(snapshot => {
        if (snapshot && typeof snapshot.sampleCount === 'number') {
          setData(snapshot)
        }
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [caliberSlug, apiBaseUrl])

  const hasSummary = data !== null
    && data.sampleCount >= 15
    && typeof data.median === 'number'
    && typeof data.min === 'number'
    && typeof data.max === 'number'

  return (
    <section className="rounded-lg border border-iron-800 bg-iron-900/40 p-5 sm:p-6">
      <div className="space-y-4 text-sm sm:text-base text-iron-300">
        <p className="text-iron-200 leading-relaxed">
          IronScout provides observed price and availability data for {caliberLabel} ammunition across tracked online retailers. Data reflects historical price observations and does not include purchase recommendations.
        </p>
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-iron-800 rounded w-3/4" />
            <div className="h-4 bg-iron-800 rounded w-1/2" />
          </div>
        ) : hasSummary ? (
          <p className="leading-relaxed">
            Observed 30-Day Price Range (Per Round): median: {formatValue(data!.median!)}, lowest: {formatValue(data!.min!)}, highest: {formatValue(data!.max!)}, sample size: {data!.sampleCount}.
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
