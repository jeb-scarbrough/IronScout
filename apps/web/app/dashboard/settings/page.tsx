import { Metadata } from 'next'
import { UserSettings } from '@/components/dashboard/user-settings'
import { DashboardContent } from '@/components/dashboard/dashboard-content'

export const metadata: Metadata = {
  title: 'Settings',
}

export default function SettingsPage() {
  return (
    <DashboardContent>
      <UserSettings />
    </DashboardContent>
  )
}
