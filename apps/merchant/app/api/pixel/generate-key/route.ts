import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@ironscout/db';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

// Force dynamic rendering - this route uses cookies for auth
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const reqLogger = logger.child({ requestId, endpoint: '/api/pixel/generate-key' });
  
  reqLogger.info('Pixel API key generation request received');
  
  try {
    const session = await getSession();
    
    if (!session) {
      reqLogger.warn('Unauthorized - no session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { merchantId?: string };
    try {
      body = await request.json();
    } catch {
      reqLogger.warn('Failed to parse request body');
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const merchantId = body.merchantId;

    if (!merchantId) {
      reqLogger.warn('No merchantId provided');
      return NextResponse.json({ error: 'Merchant ID required' }, { status: 400 });
    }

    // Verify the merchant owns this account or is admin
    if (session.type === 'merchant' && session.merchantId !== merchantId) {
      reqLogger.warn('Forbidden - merchant mismatch', {
        sessionMerchantId: session.merchantId,
        requestedMerchantId: merchantId
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    reqLogger.debug('Generating new pixel API key', { merchantId });

    // Generate a new API key
    const apiKey = `isk_${crypto.randomBytes(24).toString('hex')}`;

    // Update the merchant with the new key
    await prisma.merchants.update({
      where: { id: merchantId },
      data: {
        pixelApiKey: apiKey,
        pixelEnabled: true,
      },
    });

    reqLogger.info('Pixel API key generated successfully', {
      merchantId,
      keyPrefix: apiKey.substring(0, 8)
    });

    return NextResponse.json({ apiKey });
  } catch (error) {
    reqLogger.error('Failed to generate pixel API key', {}, error);
    return NextResponse.json(
      { error: 'Failed to generate API key' },
      { status: 500 }
    );
  }
}
