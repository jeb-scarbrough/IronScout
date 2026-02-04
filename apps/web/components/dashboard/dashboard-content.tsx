/**
 * Shared content wrapper for dashboard pages.
 * Ensures consistent max-width, padding, and centering across all dashboard pages.
 */
export function DashboardContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {children}
    </div>
  )
}
