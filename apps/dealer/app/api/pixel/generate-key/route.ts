import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@ironscout/db';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dealerId } = await request.json();

    // Verify the dealer owns this account or is admin
    if (session.type === 'dealer' && session.dealerId !== dealerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Generate a new API key
    const apiKey = `isk_${crypto.randomBytes(24).toString('hex')}`;

    // Update the dealer with the new key
    await prisma.dealer.update({
      where: { id: dealerId },
      data: {
        pixelApiKey: apiKey,
        pixelEnabled: true,
      },
    });

    return NextResponse.json({ apiKey });
  } catch (error) {
    console.error('Failed to generate pixel API key:', error);
    return NextResponse.json(
      { error: 'Failed to generate API key' },
      { status: 500 }
    );
  }
}
