'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Save } from 'lucide-react'
import { toast } from 'sonner'
import { updateScrapeTarget } from '../../actions'
import type { ScrapeTargetDTO } from '../../actions'

interface EditTargetFormProps {
  target: ScrapeTargetDTO
  onClose: () => void
}

export function EditTargetForm({ target, onClose }: EditTargetFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [schedule, setSchedule] = useState(target.schedule || '')
  const [priority, setPriority] = useState(target.priority)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await updateScrapeTarget(target.id, {
        schedule: schedule.trim() || undefined,
        priority,
      })

      if (!result.success) {
        toast.error(result.error || 'Failed to update target')
      } else {
        toast.success('Target updated')
        router.refresh()
        onClose()
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Edit Scrape Target</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* URL (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              URL
            </label>
            <p className="mt-1 text-sm text-gray-500 font-mono bg-gray-50 p-2 rounded break-all">
              {target.url}
            </p>
          </div>

          {/* Schedule */}
          <div>
            <label htmlFor="schedule" className="block text-sm font-medium text-gray-700">
              Schedule (Cron Expression)
            </label>
            <input
              type="text"
              id="schedule"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="0 0,4,8,12,16,20 * * *"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm font-mono"
            />
            <p className="mt-1 text-xs text-gray-500">
              Leave empty for default (every 4 hours). All schedules are in UTC.
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Examples: <code className="bg-gray-100 px-1 rounded">0 */6 * * *</code> (every 6h),
              <code className="bg-gray-100 px-1 rounded ml-1">0 8,20 * * *</code> (8am & 8pm UTC)
            </p>
          </div>

          {/* Priority */}
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
              Priority
            </label>
            <input
              type="number"
              id="priority"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
              min={0}
              max={100}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              0-100. Higher priority targets are scraped first.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
