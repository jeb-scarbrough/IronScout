import { SavedItemsManager } from '@/components/dashboard/saved-items-manager'

export default function SavedItemsPage() {
  return (
    <div className="p-6 lg:p-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">Saved Items</h1>
        <p className="text-muted-foreground mt-1">
          Track prices and get notified when they drop
        </p>
      </div>

      <SavedItemsManager />
    </div>
  )
}
