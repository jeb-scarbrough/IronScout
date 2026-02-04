import { Metadata } from 'next'
import { SavedItemsManager } from '@/components/dashboard/saved-items-manager'
import { DashboardContent } from '@/components/dashboard/dashboard-content'

export const metadata: Metadata = {
  title: 'Watchlist',
}

export default function WatchlistPage() {
  return (
    <DashboardContent>
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold italic text-white">Watchlist</h1>
        <p className="text-sm text-iron-400 mt-1">
          Products you're tracking for price changes
        </p>
      </div>

      <SavedItemsManager />
    </DashboardContent>
  )
}
