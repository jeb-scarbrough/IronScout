import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@ironscout/db'
import { getAdminSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const scrapeEnabledParam = searchParams.get('scrapeEnabled')

  try {
    const where: { scrapeEnabled?: boolean } = {}

    // Filter by scrapeEnabled if specified
    if (scrapeEnabledParam === 'true') {
      where.scrapeEnabled = true
    } else if (scrapeEnabledParam === 'false') {
      where.scrapeEnabled = false
    }

    const sources = await prisma.sources.findMany({
      where,
      select: {
        id: true,
        name: true,
        adapterId: true,
        scrapeEnabled: true,
        retailerId: true,
        url: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ sources })
  } catch (error) {
    console.error('Error fetching sources:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to fetch sources', details: message }, { status: 500 })
  }
}
