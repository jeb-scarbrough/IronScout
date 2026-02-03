'use client'

import { useState } from 'react'
import { XCircle } from 'lucide-react'
import { cancelScrapeRun } from '../actions'

interface CancelRunButtonProps {
  runId: string
}

export function CancelRunButton({ runId }: CancelRunButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCancel() {
    if (!confirm('Cancel this stuck run? This will mark it as FAILED so the scheduler can pick up new work.')) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await cancelScrapeRun(runId)
      if (!result.success) {
        setError(result.error || 'Failed to cancel run')
      }
      // Page will revalidate automatically
    } catch (err) {
      setError('Failed to cancel run')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCancel}
        disabled={isLoading}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Cancel stuck run"
      >
        <XCircle className="h-3 w-3" />
        {isLoading ? 'Cancelling...' : 'Cancel'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
