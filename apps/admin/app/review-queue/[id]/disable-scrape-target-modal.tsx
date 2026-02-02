'use client';

import { useState } from 'react';
import { X, AlertTriangle, Unlink, ExternalLink, Loader2 } from 'lucide-react';

interface ScrapeTargetInfo {
  id: string;
  url: string;
  canonicalUrl: string;
  enabled: boolean;
  status: string;
}

interface DisableScrapeTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onSkip: () => void;
  scrapeTarget: ScrapeTargetInfo;
  skipReason: string;
  isSubmitting?: boolean;
}

/**
 * Modal to prompt operator whether to disable an associated scrape target
 * after marking a product as SKIP.
 *
 * Per scraper-framework-01 spec 10.3: Part of the skip-to-disable feedback loop.
 */
export function DisableScrapeTargetModal({
  isOpen,
  onClose,
  onConfirm,
  onSkip,
  scrapeTarget,
  skipReason,
  isSubmitting = false,
}: DisableScrapeTargetModalProps) {
  if (!isOpen) return null;

  // Truncate URL for display
  const displayUrl =
    scrapeTarget.canonicalUrl.length > 60
      ? scrapeTarget.canonicalUrl.slice(0, 57) + '...'
      : scrapeTarget.canonicalUrl;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-md transform rounded-lg bg-white shadow-xl transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Disable Scrape Target?
                </h3>
                <p className="text-sm text-gray-500">Feedback loop</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isSubmitting}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-4">
            <p className="text-sm text-gray-700">
              This product came from a scrape target. Would you like to disable
              future scraping of this URL to prevent re-ingesting non-ammunition
              products?
            </p>

            {/* Scrape target info */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Scrape Target URL
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="font-mono text-sm text-gray-900 truncate flex-1"
                  title={scrapeTarget.canonicalUrl}
                >
                  {displayUrl}
                </span>
                <a
                  href={scrapeTarget.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <div className="text-xs text-gray-500">
                Status: <span className="font-medium">{scrapeTarget.status}</span>
              </div>
            </div>

            {/* Skip reason context */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="text-xs text-amber-700 font-medium mb-1">
                Skip Reason
              </div>
              <p className="text-sm text-amber-800">{skipReason}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 bg-gray-50">
            <button
              onClick={onSkip}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              disabled={isSubmitting}
            >
              No, Keep Enabled
            </button>
            <button
              onClick={onConfirm}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Disabling...
                </>
              ) : (
                <>
                  <Unlink className="h-4 w-4" />
                  Yes, Disable Target
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
