import { prisma } from '@ironscout/db';
import { notFound } from 'next/navigation';
import { formatDateTime } from '@/lib/utils';
import Link from 'next/link';
import {
  ArrowLeft,
  Globe,
  Calendar,
  Store,
  Eye,
  EyeOff,
  XCircle,
  ExternalLink,
  Database,
  Rss,
  DollarSign,
} from 'lucide-react';
import { EditRetailerForm } from './edit-form';
import { VisibilityActions } from './visibility-actions';
import { MerchantLinkSection } from './merchant-link-section';

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

export default async function RetailerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const retailer = await prisma.retailers.findUnique({
    where: { id },
    include: {
      merchant_retailers: {
        include: {
          merchants: {
            select: { id: true, businessName: true, status: true },
          },
        },
      },
      _count: {
        select: {
          prices: true,
          sources: true,
          retailer_feeds: true,
          retailer_skus: true,
        },
      },
    },
  });

  if (!retailer) {
    notFound();
  }

  // Get recent feeds
  const feeds = await prisma.retailer_feeds.findMany({
    where: { retailerId: id },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      name: true,
      status: true,
      enabled: true,
      lastSuccessAt: true,
      createdAt: true,
    },
  });

  const visibilityInfo = visibilityConfig[retailer.visibilityStatus];
  const tierInfo = tierConfig[retailer.tier];
  const VisibilityIcon = visibilityInfo.icon;
  const merchant = retailer.merchant_retailers[0]?.merchants;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/retailers"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Retailers
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {retailer.logoUrl ? (
            <img
              src={retailer.logoUrl}
              alt={retailer.name}
              className="h-16 w-16 rounded-lg object-contain bg-gray-100"
            />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-gray-200 flex items-center justify-center">
              <Store className="h-8 w-8 text-gray-500" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{retailer.name}</h1>
            <a
              href={retailer.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              {retailer.website}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <EditRetailerForm retailer={{
            id: retailer.id,
            name: retailer.name,
            website: retailer.website,
            logoUrl: retailer.logoUrl,
            tier: retailer.tier,
          }} />
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${tierInfo.color}`}>
            {tierInfo.label}
          </span>
          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${visibilityInfo.color}`}>
            <VisibilityIcon className="h-4 w-4" />
            {visibilityInfo.label}
          </span>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Retailer Info */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Retailer Information</h2>
          <dl className="space-y-4">
            <div className="flex items-start gap-3">
              <Globe className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <dt className="text-sm font-medium text-gray-500">Website</dt>
                <dd className="text-sm text-gray-900">
                  <a
                    href={retailer.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {retailer.website}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Store className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <dt className="text-sm font-medium text-gray-500">Tier</dt>
                <dd className="text-sm text-gray-900">{retailer.tier}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="text-sm text-gray-900">{formatDateTime(retailer.createdAt)}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                <dd className="text-sm text-gray-900">{formatDateTime(retailer.updatedAt)}</dd>
              </div>
            </div>
          </dl>
        </div>

        {/* Visibility Info */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Visibility Status</h2>
            <VisibilityActions
              retailerId={retailer.id}
              currentStatus={retailer.visibilityStatus}
            />
          </div>
          <dl className="space-y-4">
            <div className="flex items-start gap-3">
              <VisibilityIcon className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${visibilityInfo.color}`}>
                    <VisibilityIcon className="h-3 w-3" />
                    {visibilityInfo.label}
                  </span>
                </dd>
              </div>
            </div>
            {retailer.visibilityReason && (
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <dt className="text-sm font-medium text-gray-500">Reason</dt>
                  <dd className="text-sm text-gray-900">{retailer.visibilityReason}</dd>
                </div>
              </div>
            )}
            {retailer.visibilityUpdatedAt && (
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status Updated</dt>
                  <dd className="text-sm text-gray-900">
                    {formatDateTime(retailer.visibilityUpdatedAt)}
                    {retailer.visibilityUpdatedBy && (
                      <span className="text-gray-500"> by {retailer.visibilityUpdatedBy}</span>
                    )}
                  </dd>
                </div>
              </div>
            )}
          </dl>
        </div>

        {/* Linked Merchant */}
        <MerchantLinkSection
          retailerId={retailer.id}
          linkedMerchant={merchant || null}
        />

        {/* Stats */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Statistics</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{retailer._count.prices.toLocaleString()}</p>
                <p className="text-sm text-gray-500">Prices</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{retailer._count.sources}</p>
                <p className="text-sm text-gray-500">Sources</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Rss className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{retailer._count.retailer_feeds}</p>
                <p className="text-sm text-gray-500">Feeds</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Store className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{retailer._count.retailer_skus.toLocaleString()}</p>
                <p className="text-sm text-gray-500">SKUs</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feeds Section */}
      {feeds.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Feeds</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Enabled</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Last Success</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {feeds.map((feed) => (
                  <tr key={feed.id}>
                    <td className="px-4 py-2 text-sm text-gray-900">{feed.name}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        feed.status === 'HEALTHY' ? 'bg-green-100 text-green-700' :
                        feed.status === 'WARNING' ? 'bg-yellow-100 text-yellow-700' :
                        feed.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {feed.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {feed.enabled ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {feed.lastSuccessAt ? formatDateTime(feed.lastSuccessAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-500">
        <p>Retailer ID: <code className="bg-gray-200 px-1 rounded">{retailer.id}</code></p>
      </div>
    </div>
  );
}
