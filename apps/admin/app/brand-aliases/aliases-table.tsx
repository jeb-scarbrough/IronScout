'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle, Clock, XCircle, Zap } from 'lucide-react';
import type { BrandAliasDTO, AliasStatus, AliasSourceType } from './actions';

interface AliasesTableProps {
  aliases: BrandAliasDTO[];
}

const statusConfig: Record<AliasStatus, { label: string; icon: typeof CheckCircle; color: string }> = {
  DRAFT: { label: 'Draft', icon: Clock, color: 'bg-yellow-100 text-yellow-700' },
  ACTIVE: { label: 'Active', icon: CheckCircle, color: 'bg-green-100 text-green-700' },
  DISABLED: { label: 'Disabled', icon: XCircle, color: 'bg-gray-100 text-gray-700' },
};

const sourceTypeLabels: Record<AliasSourceType, string> = {
  RETAILER_FEED: 'Retailer',
  AFFILIATE_FEED: 'Affiliate',
  MANUAL: 'Manual',
};

export function AliasesTable({ aliases }: AliasesTableProps) {
  if (aliases.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No aliases found. Create your first alias to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Alias
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Canonical
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Source
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Impact
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {aliases.map((alias) => {
            const status = statusConfig[alias.status];
            const StatusIcon = status.icon;

            return (
              <tr key={alias.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{alias.aliasName}</div>
                    <div className="text-xs text-gray-500 font-mono">{alias.aliasNorm}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{alias.canonicalName}</div>
                      <div className="text-xs text-gray-500 font-mono">{alias.canonicalNorm}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </span>
                  {alias.status === 'DRAFT' && alias.canAutoActivate && (
                    <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                      <Zap className="h-3 w-3" />
                      Auto
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-600">
                    {sourceTypeLabels[alias.sourceType]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {alias.estimatedDailyImpact !== undefined && (
                    <div className="text-sm">
                      <span
                        className={`font-medium ${
                          alias.estimatedDailyImpact >= 500
                            ? 'text-orange-600'
                            : alias.estimatedDailyImpact >= 100
                            ? 'text-yellow-600'
                            : 'text-gray-600'
                        }`}
                      >
                        ~{alias.estimatedDailyImpact}/day
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div>{new Date(alias.createdAt).toLocaleDateString()}</div>
                  <div className="text-xs">{alias.createdBy}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <Link
                    href={`/brand-aliases/${alias.id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
