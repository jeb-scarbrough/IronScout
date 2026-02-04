import { Metadata } from 'next'
import { UserSettings } from '@/components/dashboard/user-settings'
import { DashboardContent } from '@/components/dashboard/dashboard-content'

export const metadata: Metadata = {
  title: 'Settings',
}

export default function SettingsPage() {
  return (
    <DashboardContent>
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold italic text-white">Settings</h1>
        <p className="text-sm text-iron-400 mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      <UserSettings />
    </DashboardContent>
  )
}
