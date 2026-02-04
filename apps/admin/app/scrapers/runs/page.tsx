import Link from 'next/link'
import { ArrowLeft, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'
import { listScrapeRuns } from '../actions'
import { CancelRunButton } from './cancel-run-button'

export const dynamic = 'force-dynamic'

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'COMPLETED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <CheckCircle className="h-3 w-3" />
          Completed
        </span>
      )
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <XCircle className="h-3 w-3" />
          Failed
        </span>
      )
    case 'RUNNING':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          <Clock className="h-3 w-3" />
          Running
        </span>
      )
    case 'PARTIAL':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
          <AlertTriangle className="h-3 w-3" />
          Partial
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
          {status}
        </span>
      )
  }
}

function TriggerBadge({ trigger }: { trigger: string }) {
  switch (trigger) {
    case 'SCHEDULED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
          Scheduled
        </span>
      )
    case 'MANUAL':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-600">
          Manual
        </span>
      )
    case 'RETRY':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-600">
          Retry
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
          {trigger}
        </span>
      )
  }
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function formatRate(rate: number | null): string {
  if (rate === null) return '-'
  return `${(rate * 100).toFixed(1)}%`
}

export default async function ScrapeRunsPage() {
  const result = await listScrapeRuns({ limit: 100 })
  const runs = result.runs

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link
          href="/scrapers"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Scrapers
        </Link>
      </div>

      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Scrape Runs</h1>
          <p className="mt-2 text-sm text-gray-700">
            History of scrape executions with metrics.
          </p>
        </div>
      </div>

      <div className="mt-8 bg-white shadow rounded-lg overflow-hidden">
        {runs.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            No scrape runs yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Adapter
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trigger
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    URLs
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Offers
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Yield
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className={
                      run.status === 'FAILED'
                        ? 'bg-red-50'
                        : run.status === 'RUNNING'
                        ? 'bg-blue-50'
                        : ''
                    }
                  >
                    <td className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">
                      {formatDate(run.startedAt)}
                    </td>
                    <td className="px-4 py-4 text-sm whitespace-nowrap">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                        {run.adapterId}
                      </code>
                      <span className="ml-1 text-xs text-gray-400">
                        v{run.adapterVersion}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <TriggerBadge trigger={run.trigger} />
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {formatDuration(run.durationMs)}
                    </td>
                    <td className="px-4 py-4 text-sm whitespace-nowrap">
                      <span className="text-green-600">{run.urlsSucceeded}</span>
                      <span className="text-gray-400"> / </span>
                      <span className="text-gray-600">{run.urlsAttempted}</span>
                      {run.urlsFailed > 0 && (
                        <span className="text-red-600 ml-1">
                          ({run.urlsFailed} failed)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm whitespace-nowrap">
                      <span className="text-green-600">{run.offersValid}</span>
                      <span className="text-gray-400"> / </span>
                      <span className="text-gray-600">{run.offersExtracted}</span>
                      {run.offersDropped > 0 && (
                        <span className="text-yellow-600 ml-1">
                          ({run.offersDropped} dropped)
                        </span>
                      )}
                      {run.offersQuarantined > 0 && (
                        <span className="text-red-600 ml-1">
                          ({run.offersQuarantined} quarantined)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm whitespace-nowrap">
                      {run.yieldRate !== null ? (
                        <span
                          className={
                            run.yieldRate >= 0.9
                              ? 'text-green-600 font-medium'
                              : run.yieldRate >= 0.5
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }
                        >
                          {formatRate(run.yieldRate)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm whitespace-nowrap">
                      {run.status === 'RUNNING' ? (
                        <CancelRunButton runId={run.id} />
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
