import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { listAdapterStatuses } from '../actions'
import { AdapterStatusTable } from './adapter-table'

export const dynamic = 'force-dynamic'

export default async function AdaptersPage() {
  const result = await listAdapterStatuses()
  const adapters = result.adapters

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
          <h1 className="text-2xl font-semibold text-gray-900">Adapter Status</h1>
          <p className="mt-2 text-sm text-gray-700">
            Monitor and manage scrape adapter health.
          </p>
        </div>
      </div>

      <div className="mt-8 bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Registered Adapters</h3>
          <p className="mt-1 text-sm text-gray-500">
            Enable or disable adapters and view health metrics.
          </p>
        </div>
        <AdapterStatusTable adapters={adapters} />
      </div>

      {/* Info Panel */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-800">About Adapter Auto-Disable</h4>
        <p className="mt-1 text-sm text-blue-700">
          Adapters are automatically disabled after 2 consecutive failed batches (50%+ failure rate).
          This protects against scraping broken pages. Re-enable manually after fixing the issue.
        </p>
      </div>
    </div>
  )
}
