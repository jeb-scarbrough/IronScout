import Link from 'next/link'
import { Target, Activity, AlertTriangle, CheckCircle, XCircle, Pause } from 'lucide-react'
import { listScrapeTargets, getScrapeStats, getScraperStatus } from './actions'
import { ScrapeTargetsTable } from './targets-table'
import { TargetFilters } from './target-filters'
import { ScraperControls } from './scraper-controls'
import { ImportTargetsButton } from './targets/import-targets'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    status?: string
    adapter?: string
    source?: string
    search?: string
    enabled?: string
    page?: string
  }>
}

const PAGE_SIZE = 50

export default async function ScrapersPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  const [targetsResult, statsResult, statusResult] = await Promise.all([
    listScrapeTargets({
      status: params.status,
      adapterId: params.adapter,
      sourceId: params.source,
      search: params.search,
      enabledOnly: params.enabled === 'true' ? true : undefined,
      disabledOnly: params.enabled === 'false' ? true : undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    getScrapeStats(),
    getScraperStatus(),
  ])

  const targets = targetsResult.targets
  const total = targetsResult.total
  const stats = statsResult.stats
  const scraperStatus = statusResult
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Build base URL for pagination links
  const buildPageUrl = (pageNum: number) => {
    const urlParams = new URLSearchParams()
    if (params.status) urlParams.set('status', params.status)
    if (params.adapter) urlParams.set('adapter', params.adapter)
    if (params.source) urlParams.set('source', params.source)
    if (params.search) urlParams.set('search', params.search)
    if (params.enabled) urlParams.set('enabled', params.enabled)
    urlParams.set('page', pageNum.toString())
    return `/scrapers?${urlParams.toString()}`
  }

  // Check if any filters are active
  const hasFilters = params.status || params.adapter || params.source || params.search || params.enabled

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Scraper Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage scrape targets, view runs, and monitor adapter health.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-3">
          <Link
            href="/scrapers/adapters"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Activity className="h-4 w-4 mr-2" />
            Adapters
          </Link>
          <Link
            href="/scrapers/runs"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Activity className="h-4 w-4 mr-2" />
            Runs
          </Link>
          <ImportTargetsButton />
          <Link
            href="/scrapers/targets/create"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Target className="h-4 w-4 mr-2" />
            Add Target
          </Link>
        </div>
      </div>

      {/* Scraper Controls */}
      {scraperStatus.success && (
        <div className="mt-6">
          <ScraperControls
            enabled={scraperStatus.enabled ?? true}
            runningRuns={scraperStatus.runningRuns ?? 0}
            pendingJobs={scraperStatus.pendingJobs ?? 0}
          />
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Target className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Targets</dt>
                    <dd className="text-lg font-semibold text-gray-900">{stats.totalTargets}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Active Targets</dt>
                    <dd className="text-lg font-semibold text-gray-900">{stats.activeTargets}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Activity className="h-6 w-6 text-blue-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Runs (24h)</dt>
                    <dd className="text-lg font-semibold text-gray-900">{stats.recentRuns}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-red-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Failures (24h)</dt>
                    <dd className="text-lg font-semibold text-gray-900">{stats.recentFailures}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts - clickable to filter */}
      {stats && stats.brokenTargets > 0 && (
        <Link href="/scrapers?status=BROKEN" className="block mt-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 hover:bg-red-100 transition-colors cursor-pointer">
            <div className="flex">
              <XCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  {stats.brokenTargets} broken target{stats.brokenTargets > 1 ? 's' : ''}
                </h3>
                <p className="mt-1 text-sm text-red-700">
                  These targets have failed multiple times and need attention. Click to view.
                </p>
              </div>
            </div>
          </div>
        </Link>
      )}

      {stats && stats.pausedTargets > 0 && (
        <Link href="/scrapers?enabled=false" className="block mt-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 hover:bg-yellow-100 transition-colors cursor-pointer">
            <div className="flex">
              <Pause className="h-5 w-5 text-yellow-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  {stats.pausedTargets} paused target{stats.pausedTargets > 1 ? 's' : ''}
                </h3>
                <p className="mt-1 text-sm text-yellow-700">
                  These targets are disabled and will not be scraped. Click to view.
                </p>
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Targets Table */}
      <div className="mt-8 bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Scrape Targets</h3>
              <p className="mt-1 text-sm text-gray-500">
                {hasFilters ? (
                  <>Showing {targets.length} of {total} filtered results</>
                ) : (
                  <>Showing {targets.length} of {total} targets</>
                )}
              </p>
            </div>
            {hasFilters && (
              <Link
                href="/scrapers"
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Clear filters
              </Link>
            )}
          </div>
        </div>

        {/* Filters */}
        <TargetFilters
          currentStatus={params.status}
          currentAdapter={params.adapter}
          currentSearch={params.search}
          currentEnabled={params.enabled}
        />

        <ScrapeTargetsTable targets={targets} />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Page {page} of {totalPages} ({total} total)
              </div>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={buildPageUrl(page - 1)}
                    className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50"
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={buildPageUrl(page + 1)}
                    className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
