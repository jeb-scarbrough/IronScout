import { Metadata } from 'next'
import { SavedItemsManager } from '@/components/dashboard/saved-items-manager'
import { DashboardContent } from '@/components/dashboard/dashboard-content'

export const metadata: Metadata = {
  title: 'Watchlist',
}

export default function WatchlistPage() {
  return (
    <DashboardContent>
      <SavedItemsManager />
    </DashboardContent>
  )
}
