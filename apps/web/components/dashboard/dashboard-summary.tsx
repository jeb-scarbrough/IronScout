'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, LayoutDashboard } from 'lucide-react'
import { DashboardOverview } from './dashboard-overview'
import { RecentAlerts } from './recent-alerts'
import { QuickActions } from './quick-actions'

interface DashboardSummaryProps {
  defaultExpanded?: boolean
}

export function DashboardSummary({ defaultExpanded = false }: DashboardSummaryProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="border-t border-gray-200 dark:border-gray-800">
      {/* Toggle Button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors motion-reduce:transition-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
        aria-expanded={expanded}
        aria-controls="dashboard-summary-content"
      >
        <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
        <span>{expanded ? 'Hide Dashboard' : 'Show Dashboard'}</span>
        {expanded ? (
          <ChevronUp className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      {/* Collapsible Content */}
      {expanded && (
        <div
          id="dashboard-summary-content"
          className="animate-in slide-in-from-top-2 duration-200 motion-reduce:animate-none pb-6"
        >
          {/* Stats Row */}
          <div className="mb-6 px-4 py-4 bg-muted/30 rounded-lg">
            <DashboardOverview variant="compact" />
          </div>

          {/* Alerts and Quick Actions Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <RecentAlerts />
            </div>
            <div>
              <QuickActions />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
