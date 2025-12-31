import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@ironscout/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/canonical-skus/search
 * Search for canonical SKUs (admin only)
 */
export async function GET(request: NextRequest) {
  const session = await getAdminSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Search canonical SKUs by name, caliber, brand, or UPC
    const results = await prisma.canonicalSku.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { caliber: { contains: query, mode: 'insensitive' } },
          { brand: { contains: query, mode: 'insensitive' } },
          { upc: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ name: 'asc' }],
      take: 20,
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Failed to search canonical SKUs:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
