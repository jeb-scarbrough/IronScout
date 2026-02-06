'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  MoreHorizontal,
  Eye,
  Pencil,
  Power,
  PowerOff,
  Trash2,
  Bot,
} from 'lucide-react';
import {
  toggleSourceEnabled,
  toggleScrapeEnabled,
  deleteSource,
} from './actions';

interface SourceActionsProps {
  source: {
    id: string;
    name: string;
    enabled: boolean;
    scrapeEnabled: boolean;
  };
}

export function SourceActions({ source }: SourceActionsProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.right - 192, // 192px = w-48
      });
    }
  }, [isOpen]);

  const handleAction = async (action: () => Promise<{ success: boolean; error?: string }>) => {
    setIsLoading(true);
    try {
      const result = await action();
      if (!result.success) {
        toast.error(result.error || 'Action failed');
      }
      router.refresh();
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${source.name}"? This action cannot be undone.`)) {
      return;
    }
    await handleAction(() => deleteSource(source.id));
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
      >
        <MoreHorizontal className="h-5 w-5 text-gray-500" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="fixed z-50 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            <div className="py-1">
              <Link
                href={`/sources/${source.id}`}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                onClick={() => setIsOpen(false)}
              >
                <Eye className="h-4 w-4" />
                View Details
              </Link>

              <Link
                href={`/sources/${source.id}?edit=true`}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                onClick={() => setIsOpen(false)}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Link>

              <hr className="my-1" />

              <button
                onClick={() => handleAction(() => toggleSourceEnabled(source.id))}
                disabled={isLoading}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                {source.enabled ? (
                  <>
                    <PowerOff className="h-4 w-4" />
                    Disable Source
                  </>
                ) : (
                  <>
                    <Power className="h-4 w-4" />
                    Enable Source
                  </>
                )}
              </button>

              <button
                onClick={() => handleAction(() => toggleScrapeEnabled(source.id))}
                disabled={isLoading}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                <Bot className="h-4 w-4" />
                {source.scrapeEnabled ? 'Disable Scraping' : 'Enable Scraping'}
              </button>

              <hr className="my-1" />

              <button
                onClick={handleDelete}
                disabled={isLoading}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete Source
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
