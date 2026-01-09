'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  content: ReactNode;
  children?: ReactNode;
  /** Position relative to trigger */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Max width of tooltip in pixels */
  maxWidth?: number;
  /** Show help icon as trigger */
  showIcon?: boolean;
  /** Icon size */
  iconSize?: number;
  /** Icon color class */
  iconClassName?: string;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  maxWidth = 300,
  showIcon = true,
  iconSize = 16,
  iconClassName = 'text-gray-400 hover:text-gray-600',
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
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
      <div
        ref={triggerRef}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="inline-flex items-center cursor-help"
      >
        {children || (showIcon && <HelpCircle size={iconSize} className={iconClassName} />)}
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg pointer-events-none"
          style={{
            top: coords.top,
            left: coords.left,
            maxWidth,
          }}
        >
          {content}
          <div
            className={`absolute w-2 h-2 bg-gray-900 transform rotate-45 ${
              position === 'top'
                ? 'bottom-[-4px] left-1/2 -translate-x-1/2'
                : position === 'bottom'
                ? 'top-[-4px] left-1/2 -translate-x-1/2'
                : position === 'left'
                ? 'right-[-4px] top-1/2 -translate-y-1/2'
                : 'left-[-4px] top-1/2 -translate-y-1/2'
            }`}
          />
        </div>
      )}
    </>
  );
}

/**
 * Inline help tooltip - shows a help icon that displays tooltip on hover
 */
export function HelpTooltip({
  content,
  position = 'top',
  maxWidth = 300,
  iconClassName = 'text-gray-400 hover:text-gray-600',
}: {
  content: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  maxWidth?: number;
  iconClassName?: string;
}) {
  return (
    <Tooltip content={content} position={position} maxWidth={maxWidth} iconClassName={iconClassName} />
  );
}
