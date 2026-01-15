'use client';

/**
 * Score Breakdown Component
 *
 * Displays a visual breakdown of the weighted match score.
 *
 * IMPORTANT: This is an APPROXIMATE breakdown computed client-side.
 * The actual resolver score may differ slightly due to:
 * - TF-IDF title similarity being computed server-side
 * - Potential custom weight overrides per resolver config
 *
 * Source: apps/harvester/src/resolver/scoring/weighted-exact.ts
 * DEFAULT_WEIGHTS constant (verified 2025-01-14)
 */

// Resolver scoring weights
// Source: apps/harvester/src/resolver/scoring/weighted-exact.ts:34-40
// These are DEFAULT_WEIGHTS - actual resolver may use different config
const WEIGHTS = {
  brand: 0.25,
  caliber: 0.30,
  pack: 0.20,
  grain: 0.15,
  title: 0.10,
} as const;

interface MatchDetails {
  brandMatch: boolean;
  caliberMatch: boolean;
  packMatch: boolean;
  grainMatch: boolean;
  titleSimilarity: number;
}

interface ScoreBreakdownProps {
  score: number;
  matchDetails?: MatchDetails;
  compact?: boolean;
}

interface BreakdownItem {
  key: string;
  label: string;
  weight: number;
  earned: number;
  color: string;
}

export function computeScoreBreakdown(matchDetails: MatchDetails): BreakdownItem[] {
  return [
    {
      key: 'brand',
      label: 'Brand',
      weight: WEIGHTS.brand,
      earned: matchDetails.brandMatch ? WEIGHTS.brand : 0,
      color: '#3b82f6', // Blue
    },
    {
      key: 'caliber',
      label: 'Caliber',
      weight: WEIGHTS.caliber,
      earned: matchDetails.caliberMatch ? WEIGHTS.caliber : 0,
      color: '#8b5cf6', // Purple
    },
    {
      key: 'grain',
      label: 'Grain',
      weight: WEIGHTS.grain,
      earned: matchDetails.grainMatch ? WEIGHTS.grain : 0,
      color: '#06b6d4', // Cyan
    },
    {
      key: 'pack',
      label: 'Pack',
      weight: WEIGHTS.pack,
      earned: matchDetails.packMatch ? WEIGHTS.pack : 0,
      color: '#f59e0b', // Amber
    },
    {
      key: 'title',
      label: 'Title',
      weight: WEIGHTS.title,
      earned: matchDetails.titleSimilarity * WEIGHTS.title,
      color: '#6b7280', // Gray
    },
  ];
}

export function ScoreBreakdown({ score, matchDetails, compact = false }: ScoreBreakdownProps) {
  const breakdown = matchDetails ? computeScoreBreakdown(matchDetails) : null;
  const computedTotal = breakdown?.reduce((sum, item) => sum + item.earned, 0) ?? score;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="text-lg font-bold text-gray-900 tabular-nums">
          {(score * 100).toFixed(0)}%
        </div>
        {breakdown && (
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden flex">
            {breakdown.map((item) => (
              <div
                key={item.key}
                style={{
                  width: `${item.earned * 100}%`,
                  backgroundColor: item.earned > 0 ? item.color : 'transparent',
                }}
                className="h-full transition-all"
                title={`${item.label}: ${(item.earned * 100).toFixed(0)}%`}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Score Breakdown
        </span>
        <span className="text-xs text-amber-600 font-medium" title="Computed from matchDetails using default weights. Actual resolver may differ.">
          (approximate)
        </span>
      </div>

      {/* Score bar */}
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
        {breakdown?.map((item) => (
          <div
            key={item.key}
            style={{
              width: `${item.weight * 100}%`,
              backgroundColor: item.earned > 0 ? item.color : '#e5e7eb',
            }}
            className="h-full transition-all border-r border-white last:border-r-0"
            title={`${item.label}: ${(item.earned * 100).toFixed(0)}% of ${(item.weight * 100).toFixed(0)}%`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {breakdown?.map((item) => (
          <div key={item.key} className="flex items-center gap-1.5 text-xs">
            <div
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: item.earned > 0 ? item.color : '#d1d5db' }}
            />
            <span className={item.earned > 0 ? 'text-gray-700' : 'text-gray-400'}>
              {item.label}
            </span>
            <span className={`font-mono ${item.earned > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
              {item.earned > 0 ? `+${(item.earned * 100).toFixed(0)}` : '0'}
            </span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        <span className="text-sm font-medium text-gray-700">Total Score</span>
        <span className="text-lg font-bold text-gray-900 tabular-nums">
          {(computedTotal * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
