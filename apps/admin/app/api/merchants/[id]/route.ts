import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@ironscout/db';
import { getAdminSession } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const merchant = await prisma.merchants.findUnique({
      where: { id },
      select: {
        id: true,
        businessName: true,
        websiteUrl: true,
        status: true,
        tier: true,
      },
    });

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    return NextResponse.json(merchant);
  } catch (error) {
    console.error('Error fetching merchant:', error);
    return NextResponse.json({ error: 'Failed to fetch merchant' }, { status: 500 });
  }
}
