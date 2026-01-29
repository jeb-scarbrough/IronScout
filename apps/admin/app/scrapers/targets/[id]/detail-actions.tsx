'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Pause, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  pauseScrapeTarget,
  resumeScrapeTarget,
  deleteScrapeTarget,
  triggerManualScrape,
} from '../../actions'
import type { ScrapeTargetDTO } from '../../actions'

interface TargetDetailActionsProps {
  target: ScrapeTargetDTO
}

export function TargetDetailActions({ target }: TargetDetailActionsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleToggleEnabled = async () => {
    setIsLoading(true)
    try {
      const action = target.enabled ? pauseScrapeTarget : resumeScrapeTarget
      const result = await action(target.id)
      if (!result.success) {
        toast.error(result.error || 'Action failed')
      } else {
        toast.success(target.enabled ? 'Target paused' : 'Target resumed')
        router.refresh()
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTriggerScrape = async () => {
    setIsLoading(true)
    try {
      const result = await triggerManualScrape(target.id)
      if (!result.success) {
        toast.error(result.error || 'Failed to trigger scrape')
      } else {
        toast.success('Scrape job queued')
        router.refresh()
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    setIsLoading(true)
    try {
      const result = await deleteScrapeTarget(target.id)
      if (!result.success) {
        toast.error(result.error || 'Failed to delete target')
      } else {
        toast.success('Target deleted')
        router.push('/scrapers')
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
      setShowDeleteDialog(false)
    }
  }

  return (
    <>
      <div className="flex gap-3">
        <button
          onClick={handleTriggerScrape}
          disabled={isLoading || !target.enabled || target.status === 'BROKEN'}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Scrape Now
        </button>

        <button
          onClick={handleToggleEnabled}
          disabled={isLoading}
          className={`inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium disabled:opacity-50 ${
            target.enabled
              ? 'border-yellow-300 text-yellow-700 bg-yellow-50 hover:bg-yellow-100'
              : 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
          }`}
        >
          {target.enabled ? (
            <>
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Resume
            </>
          )}
        </button>

        <button
          onClick={() => setShowDeleteDialog(true)}
          disabled={isLoading}
          className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </button>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-medium text-gray-900">Delete Scrape Target</h3>
            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to delete this target? This action cannot be undone.
            </p>
            <p className="mt-2 text-sm text-gray-700 font-mono bg-gray-100 p-2 rounded break-all">
              {target.url}
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {isLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
