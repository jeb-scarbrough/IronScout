'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Play, Pause, Trash2, RefreshCw, Eye } from 'lucide-react'
import { toast } from 'sonner'
import {
  pauseScrapeTarget,
  resumeScrapeTarget,
  deleteScrapeTarget,
  triggerManualScrape,
} from './actions'
import type { ScrapeTargetDTO } from './actions'

interface ScrapeTargetActionsProps {
  target: ScrapeTargetDTO
}

export function ScrapeTargetActions({ target }: ScrapeTargetActionsProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setMenuPosition({
        top: rect.bottom + 4,
        left: Math.max(rect.right - 192, 8),
      })
    }
  }, [isOpen])

  const handleAction = async (
    action: () => Promise<{ success: boolean; error?: string }>,
    successMessage: string
  ) => {
    setIsLoading(true)
    try {
      const result = await action()
      if (!result.success) {
        toast.error(result.error || 'Action failed')
      } else {
        toast.success(successMessage)
        router.refresh()
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
      setIsOpen(false)
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
        router.refresh()
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
      setShowDeleteDialog(false)
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
      setIsOpen(false)
    }
  }

  return (
    <>
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
        >
          <MoreHorizontal className="h-5 w-5 text-gray-500" />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div
              className="fixed z-50 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5"
              style={{ top: menuPosition.top, left: menuPosition.left }}
            >
              <div className="py-1">
                <button
                  onClick={() => {
                    setIsOpen(false)
                    router.push(`/scrapers/targets/${target.id}`)
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Eye className="h-4 w-4" />
                  View Details
                </button>

                <button
                  onClick={handleTriggerScrape}
                  disabled={!target.enabled || target.status === 'BROKEN'}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="h-4 w-4" />
                  Scrape Now
                </button>

                <div className="border-t border-gray-100 my-1" />

                {target.enabled ? (
                  <button
                    onClick={() =>
                      handleAction(
                        () => pauseScrapeTarget(target.id),
                        'Target paused'
                      )
                    }
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Pause className="h-4 w-4" />
                    Pause
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      handleAction(
                        () => resumeScrapeTarget(target.id),
                        'Target resumed'
                      )
                    }
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Play className="h-4 w-4" />
                    Resume
                  </button>
                )}

                <div className="border-t border-gray-100 my-1" />

                <button
                  onClick={() => {
                    setIsOpen(false)
                    setShowDeleteDialog(true)
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-medium text-gray-900">Delete Scrape Target</h3>
            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to delete this target? This action cannot be undone.
            </p>
            <p className="mt-2 text-sm text-gray-700 font-mono bg-gray-100 p-2 rounded">
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
