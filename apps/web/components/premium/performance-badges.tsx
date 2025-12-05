'use client'

import { cn } from '@/lib/utils'
import { 
  PerformanceBadge, 
  BADGE_CONFIG,
  BulletType,
  PressureRating,
  BULLET_TYPE_LABELS,
  PRESSURE_RATING_LABELS 
} from '@/lib/api'
import { 
  Zap, 
  Shield, 
  Eye, 
  Target, 
  Gauge,
  Volume2,
  VolumeX,
  Crosshair,
  FlaskConical
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface PerformanceBadgesProps {
  badges: PerformanceBadge[]
  size?: 'sm' | 'md'
  maxVisible?: number
  showTooltips?: boolean
  className?: string
}

// Icon mapping for badges
const BADGE_ICONS: Partial<Record<PerformanceBadge, typeof Zap>> = {
  'short-barrel-optimized': Gauge,
  'suppressor-safe': VolumeX,
  'low-flash': Eye,
  'low-recoil': Shield,
  'match-grade': Crosshair,
  'subsonic': Volume2,
  '+P': Zap,
  '+P+': Zap,
  'controlled-expansion': Target,
  'frangible': FlaskConical,
}

// Tooltip descriptions for badges
const BADGE_TOOLTIPS: Record<PerformanceBadge, string> = {
  'short-barrel-optimized': 'Designed for reliable expansion in compact pistols with barrels under 4 inches',
  'suppressor-safe': 'Safe for use with suppressors - won\'t damage your suppressor or cause excessive fouling',
  'low-flash': 'Reduced muzzle flash for indoor or low-light defensive situations',
  'low-recoil': 'Reduced felt recoil for faster follow-up shots and better control',
  'match-grade': 'Competition-quality ammunition for precision shooting',
  'subsonic': 'Travels below the speed of sound (~1,125 fps) - ideal for suppressed firearms',
  '+P': 'Higher pressure loading for increased velocity (~10% over standard)',
  '+P+': 'Maximum pressure loading for maximum velocity - verify firearm compatibility',
  'nato-spec': 'Loaded to NATO specifications - similar pressure to +P',
  'controlled-expansion': 'Engineered for reliable expansion with controlled penetration depth',
  'high-expansion': 'Larger expanded diameter for maximum energy transfer',
  'bonded': 'Bonded core and jacket prevent separation on impact',
  'barrier-blind': 'Maintains performance through intermediate barriers like auto glass and drywall',
  'frangible': 'Breaks apart on impact - ideal for indoor ranges and reducing ricochet risk',
  'lead-free': 'Lead-free projectile - required at some indoor ranges',
}

export function PerformanceBadges({
  badges,
  size = 'sm',
  maxVisible = 4,
  showTooltips = true,
  className
}: PerformanceBadgesProps) {
  if (!badges || badges.length === 0) return null

  const visibleBadges = badges.slice(0, maxVisible)
  const hiddenCount = badges.length - maxVisible

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-0.5',
    md: 'text-xs px-2 py-1 gap-1'
  }

  const iconSizes = {
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3'
  }

  const BadgeContent = ({ badge }: { badge: PerformanceBadge }) => {
    const config = BADGE_CONFIG[badge]
    const Icon = BADGE_ICONS[badge]
    
    return (
      <span
        className={cn(
          'inline-flex items-center font-medium rounded-full whitespace-nowrap',
          sizeClasses[size],
          config.color
        )}
      >
        {Icon && <Icon className={iconSizes[size]} />}
        {config.label}
      </span>
    )
  }

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      <TooltipProvider delayDuration={300}>
        {visibleBadges.map((badge) => (
          showTooltips ? (
            <Tooltip key={badge}>
              <TooltipTrigger asChild>
                <span className="cursor-help">
                  <BadgeContent badge={badge} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-sm">{BADGE_TOOLTIPS[badge]}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <BadgeContent key={badge} badge={badge} />
          )
        ))}
        
        {hiddenCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn(
                'inline-flex items-center font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 cursor-help',
                sizeClasses[size]
              )}>
                +{hiddenCount} more
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                {badges.slice(maxVisible).map(badge => (
                  <div key={badge} className="flex items-center gap-2">
                    <span className={cn(
                      'inline-flex items-center font-medium rounded-full text-[10px] px-1.5 py-0.5',
                      BADGE_CONFIG[badge].color
                    )}>
                      {BADGE_CONFIG[badge].label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {BADGE_TOOLTIPS[badge]}
                    </span>
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  )
}

/**
 * Bullet type badge with detailed tooltip
 */
interface BulletTypeBadgeProps {
  bulletType: BulletType
  size?: 'sm' | 'md'
  showTooltip?: boolean
}

export function BulletTypeBadge({ bulletType, size = 'sm', showTooltip = true }: BulletTypeBadgeProps) {
  const label = BULLET_TYPE_LABELS[bulletType] || bulletType
  
  // Determine color based on bullet type category
  const getColor = () => {
    const defensive = ['JHP', 'HP', 'BJHP', 'XTP', 'HST', 'GDHP']
    const training = ['FMJ', 'TMJ', 'CMJ', 'MC', 'BALL']
    const hunting = ['SP', 'JSP', 'PSP', 'VMAX']
    
    if (defensive.includes(bulletType)) {
      return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
    }
    if (training.includes(bulletType)) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
    }
    if (hunting.includes(bulletType)) {
      return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
    }
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1'
  }

  const badge = (
    <span className={cn(
      'inline-flex items-center font-semibold rounded-full',
      sizeClasses[size],
      getColor()
    )}>
      {bulletType}
    </span>
  )

  if (!showTooltip) return badge

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{badge}</span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-sm font-medium">{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Pressure rating badge
 */
interface PressureRatingBadgeProps {
  pressureRating: PressureRating
  size?: 'sm' | 'md'
}

export function PressureRatingBadge({ pressureRating, size = 'sm' }: PressureRatingBadgeProps) {
  if (pressureRating === 'STANDARD' || pressureRating === 'UNKNOWN') return null
  
  const label = PRESSURE_RATING_LABELS[pressureRating]
  
  const getColor = () => {
    switch (pressureRating) {
      case 'PLUS_P':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300'
      case 'PLUS_P_PLUS':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
      case 'NATO':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1'
  }

  return (
    <span className={cn(
      'inline-flex items-center font-semibold rounded-full',
      sizeClasses[size],
      getColor()
    )}>
      {label}
    </span>
  )
}

/**
 * Best Value grade badge
 */
interface BestValueBadgeProps {
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  summary?: string
  size?: 'sm' | 'md'
  showTooltip?: boolean
}

export function BestValueBadge({ score, grade, summary, size = 'sm', showTooltip = true }: BestValueBadgeProps) {
  const getGradeColor = () => {
    switch (grade) {
      case 'A':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-300'
      case 'B':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border-green-300'
      case 'C':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 border-yellow-300'
      case 'D':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 border-orange-300'
      case 'F':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border-red-300'
    }
  }

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-1 gap-1.5'
  }

  const badge = (
    <span className={cn(
      'inline-flex items-center font-bold rounded-full border',
      sizeClasses[size],
      getGradeColor()
    )}>
      <span className="font-black">{grade}</span>
      <span className="font-normal opacity-75">Value</span>
    </span>
  )

  if (!showTooltip || !summary) return badge

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{badge}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold">Best Value Score: {score}/100</p>
            <p className="text-sm text-muted-foreground">{summary}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
