import { Metadata } from 'next'
import { AlertsManager } from '@/components/dashboard/alerts-manager'
import { AlertHistory } from '@/components/dashboard/alert-history'
import { DashboardContent } from '@/components/dashboard/dashboard-content'

export const metadata: Metadata = {
  title: 'Alerts',
}

export default function AlertsPage() {
  return (
    <DashboardContent>
      <AlertsManager />
      <AlertHistory />
    </DashboardContent>
  )
}
