'use client';

import { useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';

interface PriceRange {
  min: number;
  max: number;
  avg: number;
  count: number;
}

interface PriceContextProps {
  sourcePrice?: number | null;
  range30d?: PriceRange | null;
  rangeAllTime?: PriceRange | null;
  className?: string;
}

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Determine if source price is an outlier relative to range
 */
function getOutlierStatus(
  sourcePrice: number,
  range: PriceRange
): 'low' | 'high' | 'normal' {
  const buffer = (range.max - range.min) * 0.1; // 10% buffer
  if (sourcePrice < range.min - buffer) return 'low';
  if (sourcePrice > range.max + buffer) return 'high';
  return 'normal';
}

/**
 * Get visual indicator for outlier status
 */
function OutlierIndicator({ status }: { status: 'low' | 'high' | 'normal' }) {
  if (status === 'low') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
        <TrendingDown className="h-3 w-3" />
        Below market
      </span>
    );
  }
  if (status === 'high') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
        <TrendingUp className="h-3 w-3" />
        Above market
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
      <Minus className="h-3 w-3" />
      In range
    </span>
  );
}

/**
 * Price range display row
 */
function PriceRangeDisplay({
  range,
  label,
}: {
  range: PriceRange;
  label: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-gray-500 font-medium">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-mono text-gray-900">
          {formatCurrency(range.min)} – {formatCurrency(range.max)}
        </span>
      </div>
      <div className="text-xs text-gray-500">
        avg {formatCurrency(range.avg)} · {range.count.toLocaleString()} prices
      </div>
    </div>
  );
}

export function PriceContext({
  sourcePrice,
  range30d,
  rangeAllTime,
  className = '',
}: PriceContextProps) {
  const [showAllTime, setShowAllTime] = useState(false);

  const hasSourcePrice = sourcePrice != null && sourcePrice > 0;
  const has30dRange = range30d && range30d.count > 0;
  const hasAllTimeRange = rangeAllTime && rangeAllTime.count > 0;

  // Determine outlier status if we have both source price and range
  const outlierStatus =
    hasSourcePrice && has30dRange
      ? getOutlierStatus(sourcePrice, range30d)
      : null;

  // If no price data at all, show empty state
  if (!hasSourcePrice && !has30dRange && !hasAllTimeRange) {
    return (
      <div className={`bg-gray-50 rounded-lg p-3 ${className}`}>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <DollarSign className="h-4 w-4" />
          <span>No price data available</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        Price Context
      </h3>

      {/* Source Price */}
      {hasSourcePrice && (
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500 font-medium">Source Price</span>
            {outlierStatus && <OutlierIndicator status={outlierStatus} />}
          </div>
          <div className="text-2xl font-bold font-mono text-gray-900">
            {formatCurrency(sourcePrice)}
          </div>
        </div>
      )}

      {/* 30-day Range */}
      {has30dRange && (
        <div className="bg-gray-50 rounded-lg p-3">
          <PriceRangeDisplay range={range30d} label="Market Range (30 days)" />
        </div>
      )}

      {/* All-time Range Toggle */}
      {hasAllTimeRange && (
        <div>
          <button
            onClick={() => setShowAllTime(!showAllTime)}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 transition-colors"
          >
            {showAllTime ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {showAllTime ? 'Hide all-time range' : 'Show all-time range'}
          </button>
          {showAllTime && (
            <div className="mt-2 bg-gray-50 rounded-lg p-3">
              <PriceRangeDisplay range={rangeAllTime} label="Market Range (All Time)" />
            </div>
          )}
        </div>
      )}

      {/* Visual price bar (if we have source price and range) */}
      {hasSourcePrice && has30dRange && (
        <PricePositionBar
          sourcePrice={sourcePrice}
          min={range30d.min}
          max={range30d.max}
          avg={range30d.avg}
        />
      )}
    </div>
  );
}

/**
 * Visual bar showing source price position relative to market range
 */
function PricePositionBar({
  sourcePrice,
  min,
  max,
  avg,
}: {
  sourcePrice: number;
  min: number;
  max: number;
  avg: number;
}) {
  // Calculate positions as percentages
  const range = max - min;
  if (range <= 0) return null;

  // Extend range by 20% on each side for outliers
  const extendedMin = min - range * 0.2;
  const extendedMax = max + range * 0.2;
  const extendedRange = extendedMax - extendedMin;

  const sourcePosition = Math.max(0, Math.min(100,
    ((sourcePrice - extendedMin) / extendedRange) * 100
  ));
  const minPosition = ((min - extendedMin) / extendedRange) * 100;
  const maxPosition = ((max - extendedMin) / extendedRange) * 100;
  const avgPosition = ((avg - extendedMin) / extendedRange) * 100;

  return (
    <div className="relative pt-4 pb-2">
      {/* Track */}
      <div className="relative h-2 bg-gray-200 rounded-full">
        {/* Market range highlight */}
        <div
          className="absolute h-full bg-gray-300 rounded-full"
          style={{
            left: `${minPosition}%`,
            width: `${maxPosition - minPosition}%`,
          }}
        />

        {/* Average marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gray-500"
          style={{ left: `${avgPosition}%` }}
          title={`Avg: ${formatCurrency(avg)}`}
        />

        {/* Source price marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow-sm"
          style={{ left: `${sourcePosition}%`, marginLeft: '-6px' }}
          title={`Source: ${formatCurrency(sourcePrice)}`}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-1 text-xs text-gray-400">
        <span>{formatCurrency(min)}</span>
        <span>{formatCurrency(max)}</span>
      </div>
    </div>
  );
}
