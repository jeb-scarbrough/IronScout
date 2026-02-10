import { NextResponse } from 'next/server'
import { getAdminAccessToken } from '@/lib/admin-session'
import { createLogger } from '@/lib/server-logger'

const logger = createLogger('web:api:admin')

export async function GET() {
  const accessToken = await getAdminAccessToken()
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  try {
    const response = await fetch(`${apiUrl}/api/search/admin/embedding-stats`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })

    const text = await response.text()
    const data = text ? JSON.parse(text) : null

    if (!response.ok) {
      return NextResponse.json(
        data || { error: 'Failed to fetch embedding stats' },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    logger.error('Error proxying embedding stats', {}, error)
    return NextResponse.json({ error: 'Failed to fetch embedding stats' }, { status: 500 })
  }
}
