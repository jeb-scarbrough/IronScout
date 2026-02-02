import * as React from 'react'

export interface IronScoutLogoProps {
  /** CSS class name for sizing and additional styling */
  className?: string
}

/**
 * IronScout Logo - Hexagon with scope pattern
 *
 * The canonical IronScout brand logo. Use this component everywhere
 * the logo needs to be displayed for consistent branding.
 *
 * Usage:
 * ```tsx
 * import { IronScoutLogo } from '@ironscout/ui/components'
 *
 * <IronScoutLogo className="w-8 h-8" />
 * ```
 */
export function IronScoutLogo({ className }: IronScoutLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-label="IronScout logo"
    >
      {/* Hexagon border */}
      <path
        d="M50 5 L89 27.5 V72.5 L50 95 L11 72.5 V27.5 Z"
        stroke="#00C2CB"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      {/* Scope crosshairs - 6-point radial pattern */}
      <g transform="translate(50,50)">
        <path d="M0 -30 Q15 -30 22 -10 L0 0 Z" stroke="#00C2CB" strokeWidth="2" fill="none" transform="rotate(0)" />
        <path d="M0 -30 Q15 -30 22 -10 L0 0 Z" stroke="#00C2CB" strokeWidth="2" fill="none" transform="rotate(60)" />
        <path d="M0 -30 Q15 -30 22 -10 L0 0 Z" stroke="#00C2CB" strokeWidth="2" fill="none" transform="rotate(120)" />
        <path d="M0 -30 Q15 -30 22 -10 L0 0 Z" stroke="#00C2CB" strokeWidth="2" fill="none" transform="rotate(180)" />
        <path d="M0 -30 Q15 -30 22 -10 L0 0 Z" stroke="#00C2CB" strokeWidth="2" fill="none" transform="rotate(240)" />
        <path d="M0 -30 Q15 -30 22 -10 L0 0 Z" stroke="#00C2CB" strokeWidth="2" fill="none" transform="rotate(300)" />
      </g>
      {/* Center dot */}
      <circle cx="50" cy="50" r="12" fill="#00C2CB" />
      {/* Corner accent */}
      <circle cx="82" cy="18" r="4" fill="#00C2CB" />
    </svg>
  )
}
