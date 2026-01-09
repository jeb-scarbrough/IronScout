'use client';

import { HelpCircle } from 'lucide-react';
import { useState, useRef, useEffect, ReactNode } from 'react';
import type { SettingTooltip } from './constants';

interface SettingHelpProps {
  tooltip: SettingTooltip;
  /** Position relative to trigger */
  position?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Renders a help icon with a tooltip showing setting information
 */
export function SettingHelp({ tooltip, position = 'right' }: SettingHelpProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const padding = 8;

      let top = 0;
      let left = 0;

      switch (position) {
        case 'top':
          top = triggerRect.top - tooltipRect.height - padding;
          left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
          break;
        case 'bottom':
          top = triggerRect.bottom + padding;
          left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
          break;
        case 'left':
          top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
          left = triggerRect.left - tooltipRect.width - padding;
          break;
        case 'right':
          top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
          left = triggerRect.right + padding;
          break;
      }

      // Keep tooltip within viewport
      const viewportPadding = 10;
      left = Math.max(viewportPadding, Math.min(left, window.innerWidth - tooltipRect.width - viewportPadding));
      top = Math.max(viewportPadding, Math.min(top, window.innerHeight - tooltipRect.height - viewportPadding));

      setCoords({ top, left });
    }
  }, [isVisible, position]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        className="inline-flex items-center justify-center ml-1.5 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 rounded"
        aria-label="More information"
      >
        <HelpCircle size={16} />
      </button>
      {isVisible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className="fixed z-50 w-80 p-3 text-sm bg-gray-900 text-white rounded-lg shadow-xl pointer-events-none"
          style={{
            top: coords.top,
            left: coords.left,
          }}
        >
          <SettingTooltipContent tooltip={tooltip} />
        </div>
      )}
    </>
  );
}

/**
 * Renders the content of a setting tooltip
 */
function SettingTooltipContent({ tooltip }: { tooltip: SettingTooltip }) {
  return (
    <div className="space-y-2">
      <p className="font-medium">{tooltip.summary}</p>

      {tooltip.whenEnabled && (
        <div>
          <span className="text-green-400 font-medium text-xs uppercase tracking-wide">When Enabled:</span>
          <p className="text-gray-300 text-xs mt-0.5">{tooltip.whenEnabled}</p>
        </div>
      )}

      {tooltip.whenDisabled && (
        <div>
          <span className="text-gray-400 font-medium text-xs uppercase tracking-wide">When Disabled:</span>
          <p className="text-gray-300 text-xs mt-0.5">{tooltip.whenDisabled}</p>
        </div>
      )}

      {tooltip.note && (
        <div className="border-t border-gray-700 pt-2">
          <span className="text-blue-400 font-medium text-xs uppercase tracking-wide">Note:</span>
          <p className="text-gray-300 text-xs mt-0.5">{tooltip.note}</p>
        </div>
      )}

      {tooltip.warning && (
        <div className="bg-amber-900/50 -mx-3 -mb-3 px-3 py-2 rounded-b-lg border-t border-amber-700">
          <span className="text-amber-400 font-medium text-xs uppercase tracking-wide">Warning:</span>
          <p className="text-amber-200 text-xs mt-0.5">{tooltip.warning}</p>
        </div>
      )}
    </div>
  );
}
