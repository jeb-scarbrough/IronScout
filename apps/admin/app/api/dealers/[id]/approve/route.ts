import { NextResponse } from 'next/server';
import { getAdminSession, logAdminAction } from '@/lib/auth';
import { prisma } from '@ironscout/db';
import { headers } from 'next/headers';
import { logger } from '@/lib/logger';
import { sendApprovalEmail } from '@/lib/email';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const reqLogger = logger.child({ requestId, endpoint: '/api/dealers/[id]/approve' });
  
  try {
    const session = await getAdminSession();
    
    if (!session) {
      reqLogger.warn('Unauthorized approval attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: dealerId } = await params;
    reqLogger.info('Dealer approval request', { dealerId, adminEmail: session.email });

    const dealer = await prisma.dealer.findUnique({
      where: { id: dealerId },
      include: {
        users: {
          where: { role: 'OWNER' },
          take: 1,
        },
      },
    });

    if (!dealer) {
      reqLogger.warn('Dealer not found', { dealerId });
      return NextResponse.json({ error: 'Dealer not found' }, { status: 404 });
    }

    const ownerUser = dealer.users[0];

    if (dealer.status !== 'PENDING') {
      reqLogger.warn('Dealer is not pending', { dealerId, currentStatus: dealer.status });
      return NextResponse.json({ error: 'Dealer is not pending approval' }, { status: 400 });
    }

    reqLogger.info('Approving dealer', { dealerId, businessName: dealer.businessName });

    const updatedDealer = await prisma.dealer.update({
      where: { id: dealerId },
      data: {
        status: 'ACTIVE',
      },
    });

    // Also verify owner's email
    if (ownerUser && !ownerUser.emailVerified) {
      await prisma.dealerUser.update({
        where: { id: ownerUser.id },
        data: { emailVerified: true },
      });
    }

    reqLogger.info('Dealer approved successfully', { dealerId });

    const headersList = await headers();
    await logAdminAction(session.userId, 'approve', {
      dealerId,
      resource: 'dealer',
      resourceId: dealerId,
      oldValue: { status: dealer.status },
      newValue: { status: 'ACTIVE' },
      ipAddress: headersList.get('x-forwarded-for') || undefined,
      userAgent: headersList.get('user-agent') || undefined,
    });

    if (ownerUser) {
      const emailResult = await sendApprovalEmail(ownerUser.email, dealer.businessName);

      if (!emailResult.success) {
        reqLogger.warn('Failed to send approval email', { dealerId, error: emailResult.error });
      } else {
        reqLogger.info('Approval email sent', { dealerId, messageId: emailResult.messageId });
      }

      return NextResponse.json({
        success: true,
        dealer: { id: updatedDealer.id, status: updatedDealer.status },
        emailSent: emailResult.success,
      });
    }

    return NextResponse.json({
      success: true,
      dealer: { id: updatedDealer.id, status: updatedDealer.status },
      emailSent: false,
    });
  } catch (error) {
    reqLogger.error('Approve dealer error', {}, error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
