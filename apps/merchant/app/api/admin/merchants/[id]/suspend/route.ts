import { NextResponse } from 'next/server';
import { getSession, logAdminAction } from '@/lib/auth';
import { prisma } from '@ironscout/db';
import { notifyMerchantSuspended } from '@ironscout/notifications';
import { headers } from 'next/headers';
import { logger } from '@/lib/logger';

// Force dynamic rendering - this route uses cookies for auth
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const reqLogger = logger.child({ requestId, endpoint: '/api/admin/merchants/[id]/suspend' });

  try {
    const session = await getSession();

    if (!session || session.type !== 'admin') {
      reqLogger.warn('Unauthorized suspend attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: merchantId } = await params;
    reqLogger.info('Merchant suspend request', { merchantId, adminEmail: session.email });

    // Get current merchant state
    const merchant = await prisma.merchants.findUnique({
      where: { id: merchantId },
    });

    if (!merchant) {
      reqLogger.warn('Merchant not found', { merchantId });
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (merchant.status === 'SUSPENDED') {
      reqLogger.warn('Merchant already suspended', { merchantId });
      return NextResponse.json(
        { error: 'Merchant is already suspended' },
        { status: 400 }
      );
    }

    reqLogger.info('Suspending merchant', {
      merchantId,
      businessName: merchant.businessName
    });

    // Update merchant status
    const updatedMerchant = await prisma.merchants.update({
      where: { id: merchantId },
      data: {
        status: 'SUSPENDED',
      },
    });

    reqLogger.info('Merchant suspended successfully', { merchantId });

    // Log admin action
    const headersList = await headers();
    await logAdminAction(session.email, 'suspend', {
      merchantId,
      resource: 'merchant',
      resourceId: merchantId,
      oldValue: { status: merchant.status },
      newValue: { status: 'SUSPENDED' },
      ipAddress: headersList.get('x-forwarded-for') || undefined,
      userAgent: headersList.get('user-agent') || undefined,
    });

    // Send suspension email to merchant (fire-and-forget)
    const primaryUser = await prisma.merchant_users.findFirst({
      where: { merchantId, role: 'ADMIN' },
      select: { email: true, name: true },
    });

    if (primaryUser) {
      notifyMerchantSuspended({
        id: merchantId,
        email: primaryUser.email,
        businessName: merchant.businessName,
        contactName: primaryUser.name,
      }).catch((err) => {
        reqLogger.warn('Failed to send suspension email', { error: (err as Error).message });
      });
    } else {
      reqLogger.warn('No admin user found for suspension notification', { merchantId });
    }

    return NextResponse.json({
      success: true,
      merchant: {
        id: updatedMerchant.id,
        status: updatedMerchant.status,
      },
    });
  } catch (error) {
    reqLogger.error('Suspend merchant error', {}, error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
