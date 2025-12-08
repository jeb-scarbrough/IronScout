import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@ironscout/db';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dealerId, enabled } = await request.json();

    // Verify the dealer owns this account or is admin
    if (session.type === 'dealer' && session.dealerId !== dealerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update the pixel enabled status
    await prisma.dealer.update({
      where: { id: dealerId },
      data: {
        pixelEnabled: enabled,
      },
    });

    return NextResponse.json({ success: true, enabled });
  } catch (error) {
    console.error('Failed to toggle pixel:', error);
    return NextResponse.json(
      { error: 'Failed to toggle pixel' },
      { status: 500 }
    );
  }
}
