import { Metadata } from 'next'
import { GunLockerManager } from '@/components/dashboard/gun-locker-manager'
import { DashboardContent } from '@/components/dashboard/dashboard-content'

export const metadata: Metadata = {
  title: 'Gun Locker',
}

export default function GunLockerPage() {
  return (
    <DashboardContent>
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold italic text-white">Gun Locker</h1>
        <p className="text-sm text-iron-400 mt-1">
          Add the guns you shoot to personalize your results
        </p>
      </div>

      <GunLockerManager />
    </DashboardContent>
  )
}
