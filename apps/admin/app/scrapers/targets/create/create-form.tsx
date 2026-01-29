'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createScrapeTarget } from '../../actions'

interface Source {
  id: string
  name: string
  adapterId: string | null
  scrapeEnabled: boolean
}

// Known adapters (could be fetched from API in the future)
const KNOWN_ADAPTERS = [
  { id: 'sgammo', name: 'SGAmmo', domain: 'sgammo.com' },
]

export function CreateTargetForm() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [adapterId, setAdapterId] = useState('')
  const [priority, setPriority] = useState(0)
  const [schedule, setSchedule] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [isLoadingSources, setIsLoadingSources] = useState(true)

  // Fetch sources on mount
  useEffect(() => {
    async function fetchSources() {
      try {
        const response = await fetch('/api/sources?scrapeEnabled=true')
        if (response.ok) {
          const data = await response.json()
          setSources(data.sources || [])
        }
      } catch {
        console.error('Failed to fetch sources')
      } finally {
        setIsLoadingSources(false)
      }
    }
    fetchSources()
  }, [])

  // Auto-select adapter based on URL domain
  useEffect(() => {
    if (!url) return
    try {
      const parsed = new URL(url)
      const domain = parsed.hostname.replace(/^www\./, '')
      const matchingAdapter = KNOWN_ADAPTERS.find((a) => domain.includes(a.domain))
      if (matchingAdapter && !adapterId) {
        setAdapterId(matchingAdapter.id)
      }
    } catch {
      // Invalid URL, ignore
    }
  }, [url, adapterId])

  // Auto-select source if only one source uses the selected adapter
  useEffect(() => {
    if (!adapterId || sourceId) return
    const matchingSources = sources.filter((s) => s.adapterId === adapterId)
    if (matchingSources.length === 1) {
      setSourceId(matchingSources[0]!.id)
    }
  }, [adapterId, sourceId, sources])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const result = await createScrapeTarget({
        url: url.trim(),
        sourceId,
        adapterId,
        priority,
        schedule: schedule.trim() || undefined,
        enabled,
      })

      if (!result.success) {
        setError(result.error || 'Failed to create target')
      } else {
        router.push('/scrapers')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* URL */}
      <div>
        <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
          Product URL <span className="text-red-500">*</span>
        </label>
        <input
          type="url"
          id="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://sgammo.com/product/..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          required
        />
        <p className="mt-1 text-sm text-gray-500">
          The full URL of the product page to scrape.
        </p>
      </div>

      {/* Adapter */}
      <div>
        <label htmlFor="adapter" className="block text-sm font-medium text-gray-700 mb-2">
          Adapter <span className="text-red-500">*</span>
        </label>
        <select
          id="adapter"
          value={adapterId}
          onChange={(e) => setAdapterId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          required
        >
          <option value="">Select an adapter...</option>
          {KNOWN_ADAPTERS.map((adapter) => (
            <option key={adapter.id} value={adapter.id}>
              {adapter.name} ({adapter.domain})
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-gray-500">
          The scraping adapter to use for this URL.
        </p>
      </div>

      {/* Source */}
      <div>
        <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-2">
          Source <span className="text-red-500">*</span>
        </label>
        <select
          id="source"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          required
          disabled={isLoadingSources}
        >
          <option value="">
            {isLoadingSources ? 'Loading sources...' : 'Select a source...'}
          </option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
              {source.adapterId ? ` (${source.adapterId})` : ''}
              {!source.scrapeEnabled && ' [scraping disabled]'}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-gray-500">
          The data source this target belongs to.
        </p>
      </div>

      {/* Priority */}
      <div>
        <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
          Priority
        </label>
        <input
          type="number"
          id="priority"
          value={priority}
          onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
          min={0}
          max={100}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="mt-1 text-sm text-gray-500">
          Higher priority targets are scraped first (0-100).
        </p>
      </div>

      {/* Schedule */}
      <div>
        <label htmlFor="schedule" className="block text-sm font-medium text-gray-700 mb-2">
          Schedule (Cron)
        </label>
        <input
          type="text"
          id="schedule"
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
          placeholder="0 0,4,8,12,16,20 * * *"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
        />
        <p className="mt-1 text-sm text-gray-500">
          Optional cron expression (UTC). Leave blank for default 4-hour interval.
        </p>
      </div>

      {/* Enabled */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <label htmlFor="enabled" className="ml-2 text-sm text-gray-700">
          Enable scraping immediately
        </label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={() => router.push('/scrapers')}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating...' : 'Create Target'}
        </button>
      </div>
    </form>
  )
}
