import { Metadata } from 'next'
import { GunLockerManager } from '@/components/dashboard/gun-locker-manager'
import { DashboardContent } from '@/components/dashboard/dashboard-content'

export const metadata: Metadata = {
  title: 'Gun Locker',
}

export default function GunLockerPage() {
  return (
    <DashboardContent>
      <GunLockerManager />
    </DashboardContent>
  )
}
