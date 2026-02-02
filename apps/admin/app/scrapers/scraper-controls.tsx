'use client'

import { useState, useTransition } from 'react'
import { Power, AlertOctagon, Play, Loader2 } from 'lucide-react'
import { emergencyStopScraper, enableScraperScheduler } from './actions'

interface ScraperControlsProps {
  enabled: boolean
  runningRuns: number
  pendingJobs: number
}

export function ScraperControls({ enabled, runningRuns, pendingJobs }: ScraperControlsProps) {
  const [isPending, startTransition] = useTransition()
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmCode, setConfirmCode] = useState('')
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handleEmergencyStop = () => {
    if (confirmCode !== 'EMERGENCY_STOP') {
      setResult({ type: 'error', message: 'Type EMERGENCY_STOP to confirm' })
      return
    }

    startTransition(async () => {
      const res = await emergencyStopScraper(confirmCode)
      if (res.success) {
        setResult({
          type: 'success',
          message: `Scraper stopped. ${res.runsAborted} runs aborted, ${res.queuesCleared} queue items cleared.`,
        })
        setShowConfirm(false)
        setConfirmCode('')
      } else {
        setResult({ type: 'error', message: res.error || 'Failed to stop scraper' })
      }
    })
  }

  const handleEnable = () => {
    startTransition(async () => {
      const res = await enableScraperScheduler()
      if (res.success) {
        setResult({ type: 'success', message: 'Scraper scheduler enabled.' })
      } else {
        setResult({ type: 'error', message: res.error || 'Failed to enable scheduler' })
      }
    })
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Power className={`h-5 w-5 ${enabled ? 'text-green-500' : 'text-red-500'}`} />
            <div>
              <h3 className="text-lg font-medium text-gray-900">Scraper Controls</h3>
              <p className="text-sm text-gray-500">
                {enabled ? 'Scheduler is running' : 'Scheduler is disabled'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-gray-600">
              <span className="font-medium">{runningRuns}</span> running
            </div>
            <div className="text-gray-600">
              <span className="font-medium">{pendingJobs}</span> pending
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-6">
        {result && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              result.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {result.message}
          </div>
        )}

        {!enabled ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              The scraper scheduler is currently disabled. No new scrape jobs will be started.
            </p>
            <button
              onClick={handleEnable}
              disabled={isPending}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Enable Scheduler
            </button>
          </div>
        ) : showConfirm ? (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertOctagon className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-800">Emergency Stop</h4>
                  <p className="text-sm text-red-700 mt-1">
                    This will immediately:
                  </p>
                  <ul className="text-sm text-red-700 mt-2 list-disc list-inside space-y-1">
                    <li>Disable the scraper scheduler</li>
                    <li>Abort all running scrape runs</li>
                    <li>Clear all pending scraper queue jobs</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type <code className="bg-gray-100 px-1 rounded">EMERGENCY_STOP</code> to confirm
              </label>
              <input
                type="text"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                placeholder="EMERGENCY_STOP"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleEmergencyStop}
                disabled={isPending || confirmCode !== 'EMERGENCY_STOP'}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <AlertOctagon className="h-4 w-4 mr-2" />
                )}
                Confirm Emergency Stop
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false)
                  setConfirmCode('')
                  setResult(null)
                }}
                disabled={isPending}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              The scraper scheduler is running normally.
            </p>
            <button
              onClick={() => setShowConfirm(true)}
              className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50"
            >
              <AlertOctagon className="h-4 w-4 mr-2" />
              Emergency Stop
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
