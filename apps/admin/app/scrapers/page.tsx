import Link from 'next/link'
import { Target, Activity, AlertTriangle, CheckCircle, XCircle, Pause } from 'lucide-react'
import { listScrapeTargets, getScrapeStats } from './actions'
import { ScrapeTargetsTable } from './targets-table'

export const dynamic = 'force-dynamic'

export default async function ScrapersPage() {
  const [targetsResult, statsResult] = await Promise.all([
    listScrapeTargets({ limit: 100 }),
    getScrapeStats(),
  ])

  const targets = targetsResult.targets
  const stats = statsResult.stats

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
          <Link
            href="/scrapers/targets/create"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Target className="h-4 w-4 mr-2" />
            Add Target
          </Link>
        </div>
      </div>

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

      {/* Alerts */}
      {stats && stats.brokenTargets > 0 && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <XCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                {stats.brokenTargets} broken target{stats.brokenTargets > 1 ? 's' : ''}
              </h3>
              <p className="mt-1 text-sm text-red-700">
                These targets have failed multiple times and need attention.
              </p>
            </div>
          </div>
        </div>
      )}

      {stats && stats.pausedTargets > 0 && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <Pause className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                {stats.pausedTargets} paused target{stats.pausedTargets > 1 ? 's' : ''}
              </h3>
              <p className="mt-1 text-sm text-yellow-700">
                These targets are disabled and will not be scraped.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Targets Table */}
      <div className="mt-8 bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Scrape Targets</h3>
          <p className="mt-1 text-sm text-gray-500">
            URLs configured for price scraping.
          </p>
        </div>
        <ScrapeTargetsTable targets={targets} />
      </div>
    </div>
  )
}
