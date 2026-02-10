import { NextResponse } from 'next/server'
import { getAdminAccessToken } from '@/lib/admin-session'
import { createLogger } from '@/lib/server-logger'

const logger = createLogger('web:api:admin')

export async function POST() {
  const accessToken = await getAdminAccessToken()
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  try {
    const response = await fetch(`${apiUrl}/api/search/admin/backfill-embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const text = await response.text()
    const data = text ? JSON.parse(text) : null

    if (!response.ok) {
      return NextResponse.json(
        data || { error: 'Failed to trigger backfill' },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    logger.error('Error proxying backfill', {}, error)
    return NextResponse.json({ error: 'Failed to trigger backfill' }, { status: 500 })
  }
}
