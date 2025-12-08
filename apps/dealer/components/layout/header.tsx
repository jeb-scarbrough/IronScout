'use client';

import { Menu, Bell } from 'lucide-react';
import type { Session } from '@/lib/auth';

interface HeaderProps {
  session: Session;
}

export function Header({ session }: HeaderProps) {
  const isAdmin = session.type === 'admin';
  
  return (
    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      {/* Mobile menu button */}
      <button
        type="button"
        className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
      >
        <span className="sr-only">Open sidebar</span>
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Separator */}
      <div className="h-6 w-px bg-gray-200 lg:hidden" aria-hidden="true" />

      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        {/* Page title area - can be customized per page */}
        <div className="flex flex-1 items-center">
          {isAdmin && (
            <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20">
              Admin Mode
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* Notifications */}
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500"
          >
            <span className="sr-only">View notifications</span>
            <Bell className="h-6 w-6" aria-hidden="true" />
          </button>

          {/* Separator */}
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200" aria-hidden="true" />

          {/* Profile */}
          <div className="flex items-center gap-x-3">
            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-600">
                {isAdmin 
                  ? session.email.charAt(0).toUpperCase()
                  : session.businessName.charAt(0).toUpperCase()
                }
              </span>
            </div>
            <span className="hidden lg:flex lg:items-center">
              <span className="text-sm font-medium text-gray-900" aria-hidden="true">
                {isAdmin ? session.email : session.businessName}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
