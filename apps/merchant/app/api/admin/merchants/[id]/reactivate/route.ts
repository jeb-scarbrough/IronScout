import { NextResponse } from 'next/server';
import { getSession, logAdminAction } from '@/lib/auth';
import { prisma } from '@ironscout/db';
import { headers } from 'next/headers';
import { logger } from '@/lib/logger';
import { sendApprovalEmail } from '@/lib/email';

// Force dynamic rendering - this route uses cookies for auth
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const reqLogger = logger.child({ requestId, endpoint: '/api/admin/merchants/[id]/reactivate' });

  try {
    const session = await getSession();

    if (!session || session.type !== 'admin') {
      reqLogger.warn('Unauthorized reactivate attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: merchantId } = await params;
    reqLogger.info('Merchant reactivate request', { merchantId, adminEmail: session.email });

    // Get current merchant state with owner user
    const merchant = await prisma.merchants.findUnique({
      where: { id: merchantId },
      include: {
        merchant_users: {
          where: { role: 'OWNER' },
          take: 1,
        },
      },
    });

    if (!merchant) {
      reqLogger.warn('Merchant not found', { merchantId });
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const ownerUser = merchant.merchant_users[0];

    if (merchant.status !== 'SUSPENDED') {
      reqLogger.warn('Merchant is not suspended', { merchantId, currentStatus: merchant.status });
      return NextResponse.json(
        { error: 'Merchant is not suspended' },
        { status: 400 }
      );
    }

    reqLogger.info('Reactivating merchant', {
      merchantId,
      businessName: merchant.businessName
    });

    // Update merchant status
    const updatedMerchant = await prisma.merchants.update({
      where: { id: merchantId },
      data: {
        status: 'ACTIVE',
      },
    });

    reqLogger.info('Merchant reactivated successfully', { merchantId });

    // Log admin action
    const headersList = await headers();
    await logAdminAction(session.email, 'reactivate', {
      merchantId,
      resource: 'merchant',
      resourceId: merchantId,
      oldValue: { status: merchant.status },
      newValue: { status: 'ACTIVE' },
      ipAddress: headersList.get('x-forwarded-for') || undefined,
      userAgent: headersList.get('user-agent') || undefined,
    });

    // Send reactivation email (same as approval) to owner
    if (ownerUser) {
      reqLogger.debug('Sending reactivation email');
      const emailResult = await sendApprovalEmail(
        ownerUser.email,
        merchant.businessName
      );

      if (!emailResult.success) {
        reqLogger.warn('Failed to send reactivation email', {
          merchantId,
          error: emailResult.error
        });
      } else {
        reqLogger.info('Reactivation email sent', {
          merchantId,
          messageId: emailResult.messageId
        });
      }

      return NextResponse.json({
        success: true,
        merchant: {
          id: updatedMerchant.id,
          status: updatedMerchant.status,
        },
        emailSent: emailResult.success,
      });
    }

    return NextResponse.json({
      success: true,
      merchant: {
        id: updatedMerchant.id,
        status: updatedMerchant.status,
      },
      emailSent: false,
    });
  } catch (error) {
    reqLogger.error('Reactivate merchant error', {}, error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
