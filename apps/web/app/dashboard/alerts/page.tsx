import { AlertsManager } from '@/components/dashboard/alerts-manager'

export default function AlertsPage() {
  return (
    <div className="p-6 lg:p-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">Alerts</h1>
        <p className="text-muted-foreground mt-1">
          Manage your price tracking alerts and get notified when prices drop
        </p>
      </div>

      <AlertsManager />
    </div>
  )
}
