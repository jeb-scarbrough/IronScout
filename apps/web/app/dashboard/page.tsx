import { DashboardOverview } from '@/components/dashboard/dashboard-overview'
import { RecentAlerts } from '@/components/dashboard/recent-alerts'
import { QuickActions } from '@/components/dashboard/quick-actions'

export default function DashboardPage() {
  return (
    <div className="p-6 lg:p-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Your overview and recent activity
        </p>
      </div>

      {/* Stats Cards */}
      <div className="mb-8">
        <DashboardOverview variant="grid" />
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
  )
}
