'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, RefreshCw, ExternalLink, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { getAdapterDetail, resetAdapterFailures, toggleAdapterEnabled } from '../actions'
import type { AdapterDetailDTO } from '../actions'

interface AdapterEditDialogProps {
  adapterId: string
  onClose: () => void
}

function formatDate(date: Date | null): string {
  if (!date) return 'Never'
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRate(rate: number | null): string {
  if (rate === null) return '-'
  return `${(rate * 100).toFixed(1)}%`
}

function StatusBadge({ enabled, disabledReason }: { enabled: boolean; disabledReason: string | null }) {
  if (enabled) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <CheckCircle className="h-3 w-3" />
        Enabled
      </span>
    )
  }

  if (disabledReason === 'AUTO_DISABLED') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <AlertTriangle className="h-3 w-3" />
        Auto-Disabled
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
      <XCircle className="h-3 w-3" />
      Disabled
    </span>
  )
}

export function AdapterEditDialog({ adapterId, onClose }: AdapterEditDialogProps) {
  const router = useRouter()
  const [adapter, setAdapter] = useState<AdapterDetailDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    async function loadAdapter() {
      const result = await getAdapterDetail(adapterId)
      if (result.success && result.adapter) {
        setAdapter(result.adapter)
      } else {
        toast.error(result.error || 'Failed to load adapter')
        onClose()
      }
      setLoading(false)
    }
    loadAdapter()
  }, [adapterId, onClose])

  const handleToggle = async () => {
    if (!adapter) return
    setToggling(true)
    try {
      const result = await toggleAdapterEnabled(adapterId, !adapter.enabled)
      if (result.success) {
        toast.success(adapter.enabled ? 'Adapter disabled' : 'Adapter enabled')
        // Reload adapter data
        const updated = await getAdapterDetail(adapterId)
        if (updated.success && updated.adapter) {
          setAdapter(updated.adapter)
        }
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to toggle adapter')
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setToggling(false)
    }
  }

  const handleResetFailures = async () => {
    setResetting(true)
    try {
      const result = await resetAdapterFailures(adapterId)
      if (result.success) {
        toast.success('Failure tracking reset')
        // Reload adapter data
        const updated = await getAdapterDetail(adapterId)
        if (updated.success && updated.adapter) {
          setAdapter(updated.adapter)
        }
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to reset failures')
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Adapter Details</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-600 rounded-full mx-auto" />
            <p className="mt-2 text-sm text-gray-500">Loading adapter details...</p>
          </div>
        ) : adapter ? (
          <div className="px-6 py-4 space-y-6">
            {/* Adapter ID and Status */}
            <div className="flex items-center justify-between">
              <code className="text-sm font-medium bg-gray-100 px-3 py-1.5 rounded">
                {adapter.adapterId}
              </code>
              <StatusBadge enabled={adapter.enabled} disabledReason={adapter.disabledReason} />
            </div>

            {/* Disabled info */}
            {!adapter.enabled && adapter.disabledAt && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  <strong>Disabled:</strong> {formatDate(adapter.disabledAt)}
                </p>
                {adapter.disabledReason && (
                  <p className="text-sm text-red-700 mt-1">
                    <strong>Reason:</strong> {adapter.disabledReason === 'AUTO_DISABLED' ? 'Auto-disabled due to consecutive failures' : adapter.disabledReason}
                  </p>
                )}
                {adapter.disabledBy && (
                  <p className="text-sm text-red-700 mt-1">
                    <strong>By:</strong> {adapter.disabledBy}
                  </p>
                )}
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Last Run</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{formatDate(adapter.lastRunAt)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Runs (30d)</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{adapter.totalRuns}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Success Rate (7d)</p>
                <p className={`text-sm font-medium mt-1 ${
                  adapter.successRate === null ? 'text-gray-400' :
                  adapter.successRate >= 0.9 ? 'text-green-600' :
                  adapter.successRate >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {formatRate(adapter.successRate)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Targets</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{adapter.targetCount}</p>
              </div>
            </div>

            {/* Failure Tracking */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Failure Tracking</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Consecutive Failed Batches</span>
                  <span className={`text-sm font-medium ${adapter.consecutiveFailedBatches > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {adapter.consecutiveFailedBatches}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Last Batch Failure Rate</span>
                  <span className="text-sm font-medium text-gray-900">{formatRate(adapter.lastBatchFailureRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Last Run Had Zero Price</span>
                  <span className={`text-sm font-medium ${adapter.lastRunHadZeroPrice ? 'text-red-600' : 'text-gray-900'}`}>
                    {adapter.lastRunHadZeroPrice ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              {adapter.consecutiveFailedBatches > 0 && (
                <button
                  onClick={handleResetFailures}
                  disabled={resetting}
                  className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${resetting ? 'animate-spin' : ''}`} />
                  {resetting ? 'Resetting...' : 'Reset Failure Count'}
                </button>
              )}
            </div>

            {/* Baseline Metrics */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Baseline Metrics (7-day rolling)</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Baseline Failure Rate</span>
                  <span className="text-sm font-medium text-gray-900">{formatRate(adapter.baselineFailureRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Baseline Yield Rate</span>
                  <span className="text-sm font-medium text-gray-900">{formatRate(adapter.baselineYieldRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Sample Size</span>
                  <span className="text-sm font-medium text-gray-900">{adapter.baselineSampleSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Last Updated</span>
                  <span className="text-sm font-medium text-gray-900">{formatDate(adapter.baselineUpdatedAt)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleToggle}
                disabled={toggling}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50 ${
                  adapter.enabled
                    ? 'text-red-700 bg-red-100 hover:bg-red-200'
                    : 'text-green-700 bg-green-100 hover:bg-green-200'
                }`}
              >
                {toggling ? 'Processing...' : adapter.enabled ? 'Disable Adapter' : 'Enable Adapter'}
              </button>

              <Link
                href={`/scrapers?adapter=${adapterId}`}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                <ExternalLink className="h-4 w-4" />
                View Targets ({adapter.targetCount})
              </Link>
            </div>
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-gray-500">
            Adapter not found
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
