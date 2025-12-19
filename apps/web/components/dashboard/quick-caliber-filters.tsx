'use client'

import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'

const POPULAR_CALIBERS = [
  '9mm',
  '.223 Remington',
  '.45 ACP',
  '.308 Winchester',
  '5.56 NATO',
  '12 Gauge',
  '.22 LR',
  '.300 Blackout'
]

interface QuickCaliberFiltersProps {
  userCalibersFromAlerts?: string[]
  maxDisplay?: number
}

export function QuickCaliberFilters({
  userCalibersFromAlerts = [],
  maxDisplay = 8
}: QuickCaliberFiltersProps) {
  const router = useRouter()

  // Prioritize user's calibers, then fill with popular ones
  const calibersToShow = [
    ...userCalibersFromAlerts,
    ...POPULAR_CALIBERS.filter(c => !userCalibersFromAlerts.includes(c))
  ].slice(0, maxDisplay)

  const handleCaliberClick = (caliber: string) => {
    router.push(`/search?caliber=${encodeURIComponent(caliber)}`)
  }

  const handleMoreClick = () => {
    router.push('/search')
  }

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {calibersToShow.map((caliber) => {
        const isUserCaliber = userCalibersFromAlerts.includes(caliber)
        return (
          <button
            key={caliber}
            onClick={() => handleCaliberClick(caliber)}
            className={`
              px-4 py-2.5 text-sm rounded-full border transition-all motion-reduce:transition-none
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${isUserCaliber
                ? 'border-[#00C2CB] bg-[#00C2CB]/10 text-[#00C2CB] hover:bg-[#00C2CB]/20'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#00C2CB] hover:bg-[#00C2CB]/5 hover:text-[#00C2CB]'
              }
            `}
          >
            {caliber}
          </button>
        )
      })}
      <button
        onClick={handleMoreClick}
        className="flex items-center gap-1 px-4 py-2.5 text-sm rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all motion-reduce:transition-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        More
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  )
}
