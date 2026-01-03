import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@ironscout/db';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BillingSettings } from './billing-settings';

export default async function BillingPage() {
  const session = await getSession();

  if (!session || session.type !== 'merchant') {
    redirect('/login');
  }

  const merchant = await prisma.merchants.findUnique({
    where: { id: session.merchantId },
    select: {
      id: true,
      businessName: true,
      tier: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
      subscriptionGraceDays: true,
      paymentMethod: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      autoRenew: true,
    },
  });

  if (!merchant) {
    redirect('/login');
  }

  const canManageBilling = session.role === 'OWNER' || session.role === 'ADMIN';

  // Serialize merchant data for client component
  const billingData = {
    id: merchant.id,
    businessName: merchant.businessName,
    tier: merchant.tier,
    subscriptionStatus: merchant.subscriptionStatus,
    subscriptionExpiresAt: merchant.subscriptionExpiresAt?.toISOString() || null,
    subscriptionGraceDays: merchant.subscriptionGraceDays,
    paymentMethod: merchant.paymentMethod,
    stripeCustomerId: merchant.stripeCustomerId,
    stripeSubscriptionId: merchant.stripeSubscriptionId,
    autoRenew: merchant.autoRenew,
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your subscription plan and billing information
        </p>
      </div>

      {/* Billing Settings */}
      <BillingSettings
        merchant={billingData}
        canManage={canManageBilling}
      />

      {!canManageBilling && (
        <div className="rounded-lg bg-yellow-50 p-4">
          <p className="text-sm text-yellow-700">
            Only account owners and admins can manage billing. Contact your account owner if you need to make changes.
          </p>
        </div>
      )}
    </div>
  );
}
