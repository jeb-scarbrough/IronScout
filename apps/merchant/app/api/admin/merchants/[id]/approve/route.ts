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
  const reqLogger = logger.child({ requestId, endpoint: '/api/admin/merchants/[id]/approve' });

  try {
    const session = await getSession();

    if (!session || session.type !== 'admin') {
      reqLogger.warn('Unauthorized approval attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: merchantId } = await params;
    reqLogger.info('Merchant approval request', { merchantId, adminEmail: session.email });

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
    if (!ownerUser) {
      reqLogger.warn('Merchant has no owner user', { merchantId });
      return NextResponse.json(
        { error: 'Merchant account configuration error' },
        { status: 500 }
      );
    }

    if (merchant.status !== 'PENDING') {
      reqLogger.warn('Merchant is not pending', { merchantId, currentStatus: merchant.status });
      return NextResponse.json(
        { error: 'Merchant is not pending approval' },
        { status: 400 }
      );
    }

    reqLogger.info('Approving merchant', {
      merchantId,
      businessName: merchant.businessName,
      ownerEmail: ownerUser.email
    });

    // Update merchant status
    const updatedMerchant = await prisma.merchants.update({
      where: { id: merchantId },
      data: {
        status: 'ACTIVE',
      },
    });

    // Also ensure owner's email is verified
    if (!ownerUser.emailVerified) {
      await prisma.merchant_users.update({
        where: { id: ownerUser.id },
        data: { emailVerified: true },
      });
    }

    reqLogger.info('Merchant approved successfully', { merchantId });

    // Log admin action
    const headersList = await headers();
    await logAdminAction(session.email, 'approve', {
      merchantId,
      resource: 'merchant',
      resourceId: merchantId,
      oldValue: { status: merchant.status },
      newValue: { status: 'ACTIVE' },
      ipAddress: headersList.get('x-forwarded-for') || undefined,
      userAgent: headersList.get('user-agent') || undefined,
    });

    // Send approval email to merchant owner
    reqLogger.debug('Sending approval email');
    const emailResult = await sendApprovalEmail(
      ownerUser.email,
      merchant.businessName
    );

    if (!emailResult.success) {
      reqLogger.warn('Failed to send approval email', {
        merchantId,
        error: emailResult.error
      });
      // Don't fail the approval just because email failed
    } else {
      reqLogger.info('Approval email sent', {
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
  } catch (error) {
    reqLogger.error('Approve merchant error', {}, error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
