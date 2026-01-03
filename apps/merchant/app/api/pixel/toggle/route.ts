import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@ironscout/db';
import { logger } from '@/lib/logger';

// Force dynamic rendering - this route uses cookies for auth
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const reqLogger = logger.child({ requestId, endpoint: '/api/pixel/toggle' });
  
  reqLogger.info('Pixel toggle request received');
  
  try {
    const session = await getSession();
    
    if (!session) {
      reqLogger.warn('Unauthorized - no session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { merchantId?: string; enabled?: boolean };
    try {
      body = await request.json();
    } catch {
      reqLogger.warn('Failed to parse request body');
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const merchantId = body.merchantId;
    const { enabled } = body;

    if (!merchantId || typeof enabled !== 'boolean') {
      reqLogger.warn('Invalid request parameters', { merchantId, enabled });
      return NextResponse.json({ error: 'Merchant ID and enabled status required' }, { status: 400 });
    }

    // Verify the merchant owns this account or is admin
    if (session.type === 'merchant' && session.merchantId !== merchantId) {
      reqLogger.warn('Forbidden - merchant mismatch', {
        sessionMerchantId: session.merchantId,
        requestedMerchantId: merchantId
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    reqLogger.debug('Toggling pixel status', { merchantId, enabled });

    // Update the pixel enabled status
    await prisma.merchants.update({
      where: { id: merchantId },
      data: {
        pixelEnabled: enabled,
      },
    });

    reqLogger.info('Pixel status updated', { merchantId, enabled });

    return NextResponse.json({ success: true, enabled });
  } catch (error) {
    reqLogger.error('Failed to toggle pixel', {}, error);
    return NextResponse.json(
      { error: 'Failed to toggle pixel' },
      { status: 500 }
    );
  }
}
