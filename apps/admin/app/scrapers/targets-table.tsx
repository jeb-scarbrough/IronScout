'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { ScrapeTargetActions } from './target-actions'
import type { ScrapeTargetDTO } from './actions'

interface ScrapeTargetsTableProps {
  targets: ScrapeTargetDTO[]
}

function StatusBadge({ status, enabled }: { status: string; enabled: boolean }) {
  if (!enabled) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
        Paused
      </span>
    )
  }

  switch (status) {
    case 'ACTIVE':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          Active
        </span>
      )
    case 'BROKEN':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
          Broken
        </span>
      )
    case 'STALE':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
          Stale
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

function formatDate(date: Date | null): string {
  if (!date) return 'Never'
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function truncateUrl(url: string, maxLength = 50): string {
  if (url.length <= maxLength) return url
  return url.substring(0, maxLength - 3) + '...'
}

export function ScrapeTargetsTable({ targets }: ScrapeTargetsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (targets.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-gray-500">
        No scrape targets configured yet.{' '}
        <Link href="/scrapers/targets/create" className="text-blue-600 hover:text-blue-500">
          Add one
        </Link>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="w-8 px-3 py-3"></th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              URL
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Source
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Adapter
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Scraped
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Failures
            </th>
            <th className="w-12 px-3 py-3"></th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {targets.map((target) => {
            const isExpanded = expandedId === target.id
            const rowClass = target.status === 'BROKEN'
              ? 'bg-red-50'
              : !target.enabled
              ? 'bg-gray-50'
              : ''

            return (
              <>
                <tr key={target.id} className={`${rowClass} hover:bg-gray-50`}>
                  <td className="px-3 py-4">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : target.id)}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center">
                      <Link
                        href={`/scrapers/targets/${target.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-500"
                        title={target.url}
                      >
                        {truncateUrl(target.url)}
                      </Link>
                      <a
                        href={target.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-gray-400 hover:text-gray-500"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900">
                    {target.sourceName}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500">
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                      {target.adapterId}
                    </code>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={target.status} enabled={target.enabled} />
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500">
                    {formatDate(target.lastScrapedAt)}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    {target.consecutiveFailures > 0 ? (
                      <span className="text-red-600 font-medium">
                        {target.consecutiveFailures}
                      </span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <ScrapeTargetActions target={target} />
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${target.id}-details`}>
                    <td colSpan={8} className="px-6 py-4 bg-gray-50">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Priority:</span>
                          <span className="ml-2 font-medium">{target.priority}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Schedule:</span>
                          <span className="ml-2 font-medium">
                            {target.schedule || 'Default (4h)'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Last Status:</span>
                          <span className="ml-2 font-medium">
                            {target.lastStatus || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Created:</span>
                          <span className="ml-2 font-medium">
                            {formatDate(target.createdAt)}
                          </span>
                        </div>
                        <div className="col-span-2 md:col-span-4">
                          <span className="text-gray-500">Canonical URL:</span>
                          <code className="ml-2 text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                            {target.canonicalUrl}
                          </code>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
