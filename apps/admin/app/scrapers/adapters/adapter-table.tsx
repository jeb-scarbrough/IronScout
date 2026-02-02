'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, AlertTriangle, Power, Pencil, PauseCircle, PlayCircle } from 'lucide-react'
import { toast } from 'sonner'
import { toggleAdapterEnabled } from '../actions'
import type { AdapterStatusDTO } from '../actions'
import { AdapterEditDialog } from './adapter-edit-dialog'

interface AdapterStatusTableProps {
  adapters: AdapterStatusDTO[]
}

function StatusIndicator({ enabled, disabledReason }: { enabled: boolean; disabledReason: string | null }) {
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

function IngestionIndicator({ paused }: { paused: boolean }) {
  if (paused) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <PauseCircle className="h-3 w-3" />
        Paused
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      <PlayCircle className="h-3 w-3" />
      Active
    </span>
  )
}

function formatDate(date: Date | null): string {
  if (!date) return 'Never'
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRate(rate: number | null): string {
  if (rate === null) return '-'
  return `${(rate * 100).toFixed(1)}%`
}

export function AdapterStatusTable({ adapters }: AdapterStatusTableProps) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [editingAdapter, setEditingAdapter] = useState<string | null>(null)

  const handleToggle = async (adapterId: string, currentEnabled: boolean) => {
    setLoadingId(adapterId)
    try {
      const result = await toggleAdapterEnabled(adapterId, !currentEnabled)
      if (!result.success) {
        toast.error(result.error || 'Failed to toggle adapter')
      } else {
        toast.success(currentEnabled ? 'Adapter disabled' : 'Adapter enabled')
        router.refresh()
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setLoadingId(null)
    }
  }

  if (adapters.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-gray-500">
        No adapters registered. Adapters are registered when the harvester starts.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Adapter
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Ingestion
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Run
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Runs (30d)
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Success Rate
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Failed Batches
            </th>
            <th className="w-24 px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {adapters.map((adapter) => (
            <tr
              key={adapter.adapterId}
              className={
                !adapter.enabled && adapter.disabledReason === 'AUTO_DISABLED'
                  ? 'bg-red-50'
                  : !adapter.enabled
                  ? 'bg-gray-50'
                  : ''
              }
            >
              <td className="px-4 py-4">
                <code className="text-sm font-medium bg-gray-100 px-2 py-1 rounded">
                  {adapter.adapterId}
                </code>
              </td>
              <td className="px-4 py-4">
                <StatusIndicator
                  enabled={adapter.enabled}
                  disabledReason={adapter.disabledReason}
                />
              </td>
              <td className="px-4 py-4">
                <IngestionIndicator paused={adapter.ingestionPaused} />
              </td>
              <td className="px-4 py-4 text-sm text-gray-500">
                {formatDate(adapter.lastRunAt)}
              </td>
              <td className="px-4 py-4 text-sm text-gray-900">
                {adapter.totalRuns}
              </td>
              <td className="px-4 py-4 text-sm">
                {adapter.successRate !== null ? (
                  <span
                    className={
                      adapter.successRate >= 0.9
                        ? 'text-green-600 font-medium'
                        : adapter.successRate >= 0.5
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }
                  >
                    {formatRate(adapter.successRate)}
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="px-4 py-4 text-sm">
                {adapter.consecutiveFailedBatches > 0 ? (
                  <span className="text-red-600 font-medium">
                    {adapter.consecutiveFailedBatches}
                  </span>
                ) : (
                  <span className="text-gray-400">0</span>
                )}
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingAdapter(adapter.adapterId)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggle(adapter.adapterId, adapter.enabled)}
                    disabled={loadingId === adapter.adapterId}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md disabled:opacity-50 ${
                      adapter.enabled
                        ? 'text-red-700 bg-red-100 hover:bg-red-200'
                        : 'text-green-700 bg-green-100 hover:bg-green-200'
                    }`}
                  >
                    <Power className="h-3 w-3" />
                    {loadingId === adapter.adapterId
                      ? '...'
                      : adapter.enabled
                      ? 'Disable'
                      : 'Enable'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Edit Dialog */}
      {editingAdapter && (
        <AdapterEditDialog
          adapterId={editingAdapter}
          onClose={() => setEditingAdapter(null)}
        />
      )}
    </div>
  )
}
