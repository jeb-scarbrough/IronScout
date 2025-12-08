import { NextResponse } from 'next/server';
import { getSession, logAdminAction } from '@/lib/auth';
import { prisma } from '@ironscout/db';
import { headers } from 'next/headers';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    
    if (!session || session.type !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const dealerId = params.id;

    // Get current dealer state
    const dealer = await prisma.dealer.findUnique({
      where: { id: dealerId },
    });

    if (!dealer) {
      return NextResponse.json(
        { error: 'Dealer not found' },
        { status: 404 }
      );
    }

    if (dealer.status === 'SUSPENDED') {
      return NextResponse.json(
        { error: 'Dealer is already suspended' },
        { status: 400 }
      );
    }

    // Update dealer status
    const updatedDealer = await prisma.dealer.update({
      where: { id: dealerId },
      data: {
        status: 'SUSPENDED',
      },
    });

    // Log admin action
    const headersList = await headers();
    await logAdminAction(session.email, 'suspend', {
      dealerId,
      resource: 'dealer',
      resourceId: dealerId,
      oldValue: { status: dealer.status },
      newValue: { status: 'SUSPENDED' },
      ipAddress: headersList.get('x-forwarded-for') || undefined,
      userAgent: headersList.get('user-agent') || undefined,
    });

    // TODO: Send suspension email to dealer

    return NextResponse.json({
      success: true,
      dealer: {
        id: updatedDealer.id,
        status: updatedDealer.status,
      },
    });
  } catch (error) {
    console.error('Suspend dealer error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
