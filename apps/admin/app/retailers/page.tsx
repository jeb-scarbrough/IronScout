import { prisma } from '@ironscout/db';
import Link from 'next/link';
import { RetailerSearch } from './retailer-search';
import {
  Store,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
  Plus
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const visibilityConfig = {
  ELIGIBLE: { label: 'Eligible', color: 'bg-green-100 text-green-700', icon: Eye },
  INELIGIBLE: { label: 'Ineligible', color: 'bg-yellow-100 text-yellow-700', icon: EyeOff },
  SUSPENDED: { label: 'Suspended', color: 'bg-red-100 text-red-700', icon: XCircle },
};

const tierConfig = {
  STANDARD: { label: 'Standard', color: 'bg-gray-100 text-gray-700' },
  PREMIUM: { label: 'Premium', color: 'bg-purple-100 text-purple-700' },
};

interface SearchParams {
  search?: string;
  visibility?: string;
  tier?: string;
}

export default async function RetailersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { search, visibility, tier } = await searchParams;

  // Build where clause
  const where: any = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { website: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (visibility && ['ELIGIBLE', 'INELIGIBLE', 'SUSPENDED'].includes(visibility)) {
    where.visibilityStatus = visibility;
  }

  if (tier && ['STANDARD', 'PREMIUM'].includes(tier)) {
    where.tier = tier;
  }

  const retailers = await prisma.retailers.findMany({
    where,
    orderBy: [
      { visibilityStatus: 'asc' },
      { name: 'asc' },
    ],
    include: {
      merchant_retailers: {
        include: {
          merchants: {
            select: { id: true, businessName: true },
          },
        },
        take: 1,
      },
      _count: {
        select: {
          prices: true,
          sources: true,
        },
      },
    },
  });

  // Stats
  const stats = await prisma.retailers.groupBy({
    by: ['visibilityStatus'],
    _count: true,
  });

  const eligibleCount = stats.find(s => s.visibilityStatus === 'ELIGIBLE')?._count || 0;
  const ineligibleCount = stats.find(s => s.visibilityStatus === 'INELIGIBLE')?._count || 0;
  const suspendedCount = stats.find(s => s.visibilityStatus === 'SUSPENDED')?._count || 0;
  const totalCount = eligibleCount + ineligibleCount + suspendedCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Retailers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage retailer accounts and visibility
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-72">
            <RetailerSearch />
          </div>
          <Link
            href="/retailers/create"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Retailer
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Store className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Retailers</dt>
                  <dd className="text-lg font-semibold text-gray-900">{totalCount}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Eligible</dt>
                  <dd className="text-lg font-semibold text-gray-900">{eligibleCount}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-yellow-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Ineligible</dt>
                  <dd className="text-lg font-semibold text-gray-900">{ineligibleCount}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <XCircle className="h-6 w-6 text-red-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Suspended</dt>
                  <dd className="text-lg font-semibold text-gray-900">{suspendedCount}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Suspended Alert */}
      {suspendedCount > 0 && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <XCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                {suspendedCount} retailer{suspendedCount !== 1 ? 's' : ''} suspended
              </h3>
              <p className="mt-1 text-sm text-red-700">
                Suspended retailers are hidden from all consumer-facing features.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Retailers Table */}
      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Retailer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Visibility
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Merchant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Prices
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sources
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
            {retailers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  {search || visibility || tier
                    ? 'No retailers found matching your filters.'
                    : 'No retailers yet. Add your first retailer to get started.'}
                </td>
              </tr>
            ) : (
              retailers.map((retailer) => {
                const visibilityInfo = visibilityConfig[retailer.visibilityStatus];
                const tierInfo = tierConfig[retailer.tier];
                const VisibilityIcon = visibilityInfo.icon;
                const merchant = retailer.merchant_retailers[0]?.merchants;

                return (
                  <tr key={retailer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {retailer.logoUrl ? (
                          <img
                            src={retailer.logoUrl}
                            alt={retailer.name}
                            className="h-10 w-10 rounded-full object-contain bg-gray-100"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <Store className="h-5 w-5 text-gray-500" />
                          </div>
                        )}
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{retailer.name}</div>
                          <a
                            href={retailer.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1"
                          >
                            {retailer.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tierInfo.color}`}>
                        {tierInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${visibilityInfo.color}`}>
                        <VisibilityIcon className="h-3 w-3" />
                        {visibilityInfo.label}
                      </span>
                      {retailer.visibilityReason && (
                        <p className="text-xs text-gray-500 mt-1 max-w-xs truncate" title={retailer.visibilityReason}>
                          {retailer.visibilityReason}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {merchant ? (
                        <Link href={`/merchants/${merchant.id}`} className="text-blue-600 hover:underline">
                          {merchant.businessName}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {retailer._count.prices.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {retailer._count.sources}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(retailer.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/retailers/${retailer.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
