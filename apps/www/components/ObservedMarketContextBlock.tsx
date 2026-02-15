'use client'

import { useEffect, useState } from 'react'
import { CALIBER_SLUG_MAP } from '@ironscout/db/calibers.js'

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
  const [hasFetchError, setHasFetchError] = useState(false)
  const [hasUnknownCaliber, setHasUnknownCaliber] = useState(false)

  useEffect(() => {
    let isCancelled = false
    setLoading(true)
    setHasFetchError(false)
    setHasUnknownCaliber(false)

    const caliberValue = CALIBER_SLUG_MAP[caliberSlug]
    if (!caliberValue) {
      if (!isCancelled) {
        setLoading(false)
        setHasUnknownCaliber(true)
      }
      return
    }

    fetch(`${apiBaseUrl}/api/market-snapshots/calibers/${encodeURIComponent(caliberValue)}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Snapshot API request failed with status ${res.status}`)
        }
        return res.json()
      })
      .then(snapshot => {
        if (isCancelled) return

        if (snapshot && typeof snapshot.sampleCount === 'number') {
          setData(snapshot as SnapshotData)
        } else {
          setData(null)
        }
        setLoading(false)
        setHasFetchError(false)
        setHasUnknownCaliber(false)
      })
      .catch(() => {
        if (isCancelled) return
        setData(null)
        setHasFetchError(true)
        setHasUnknownCaliber(false)
        setLoading(false)
      })

    return () => {
      isCancelled = true
    }
  }, [caliberSlug, apiBaseUrl])

  const hasSummary = data !== null
    && data.sampleCount >= 15
    && typeof data.median === 'number'
    && typeof data.min === 'number'
    && typeof data.max === 'number'
  const hasInsufficientData = data !== null && !hasSummary

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
        ) : hasUnknownCaliber ? (
          <p className="leading-relaxed">
            Market context is not configured for this caliber page.
          </p>
        ) : hasFetchError ? (
          <>
            <p className="leading-relaxed">
              Market context is temporarily unavailable for this caliber right now.
            </p>
            <p className="leading-relaxed">
              Please check back shortly while we refresh observed pricing data.
            </p>
          </>
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
              Market context is temporarily unavailable for this caliber right now.
            </p>
            <p className="leading-relaxed">
              Please check back shortly while we refresh observed pricing data.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
