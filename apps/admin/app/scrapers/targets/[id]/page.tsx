import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react'
import { getScrapeTarget, listScrapeRuns } from '../../actions'
import { TargetDetailActions } from './detail-actions'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

function StatusBadge({ status, enabled }: { status: string; enabled: boolean }) {
  if (!enabled) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
        Paused
      </span>
    )
  }

  switch (status) {
    case 'ACTIVE':
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
          Active
        </span>
      )
    case 'BROKEN':
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
          Broken
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
          {status}
        </span>
      )
  }
}

function formatDate(date: Date | null): string {
  if (!date) return 'Never'
  return new Date(date).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function RunStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'FAILED':
      return <XCircle className="h-4 w-4 text-red-500" />
    case 'RUNNING':
      return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
    default:
      return <Clock className="h-4 w-4 text-gray-400" />
  }
}

export default async function TargetDetailPage({ params }: Props) {
  const { id } = await params
  const [targetResult, runsResult] = await Promise.all([
    getScrapeTarget(id),
    listScrapeRuns({ limit: 20 }),
  ])

  if (!targetResult.success || !targetResult.target) {
    notFound()
  }

  const target = targetResult.target
  // Filter runs for this target's adapter (approximation - would need target-level filtering)
  const runs = runsResult.runs.filter((r) => r.adapterId === target.adapterId).slice(0, 10)

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

      {/* Header */}
      <div className="sm:flex sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">Scrape Target</h1>
            <StatusBadge status={target.status} enabled={target.enabled} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <a
              href={target.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-500 flex items-center gap-1"
            >
              {target.url}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
        <div className="mt-4 sm:mt-0">
          <TargetDetailActions target={target} />
        </div>
      </div>

      {/* Details Grid */}
      <div className="mt-8 bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Configuration</h3>
        </div>
        <div className="px-4 py-5 sm:px-6">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Source</dt>
              <dd className="mt-1 text-sm text-gray-900">{target.sourceName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Adapter</dt>
              <dd className="mt-1">
                <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">
                  {target.adapterId}
                </code>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Priority</dt>
              <dd className="mt-1 text-sm text-gray-900">{target.priority}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Schedule</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">
                {target.schedule || 'Default (every 4 hours)'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Scraped</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {formatDate(target.lastScrapedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Status</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {target.lastStatus || 'N/A'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Consecutive Failures</dt>
              <dd className="mt-1 text-sm">
                {target.consecutiveFailures > 0 ? (
                  <span className="text-red-600 font-medium">{target.consecutiveFailures}</span>
                ) : (
                  <span className="text-gray-900">0</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(target.createdAt)}</dd>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="text-sm font-medium text-gray-500">Canonical URL</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded">
                {target.canonicalUrl}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Recent Runs */}
      <div className="mt-8 bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Runs</h3>
          <p className="mt-1 text-sm text-gray-500">
            Scrape runs for the {target.adapterId} adapter.
          </p>
        </div>
        {runs.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            No runs yet for this adapter.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {runs.map((run) => (
              <li key={run.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <RunStatusIcon status={run.status} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(run.startedAt)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {run.trigger} • v{run.adapterVersion}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-900">
                      {run.urlsSucceeded}/{run.urlsAttempted} URLs
                    </p>
                    <p className="text-xs text-gray-500">
                      {run.offersValid} valid offers
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <Link
            href="/scrapers/runs"
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            View all runs →
          </Link>
        </div>
      </div>
    </div>
  )
}
