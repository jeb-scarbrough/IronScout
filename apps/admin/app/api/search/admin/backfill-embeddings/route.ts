import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth'

export async function POST() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiUrl = process.env.API_URL || 'http://localhost:8000'
  const adminApiKey = process.env.ADMIN_API_KEY

  if (!adminApiKey) {
    console.error('ADMIN_API_KEY not configured for admin proxy')
    return NextResponse.json({ error: 'Admin API key not configured' }, { status: 503 })
  }

  try {
    const response = await fetch(`${apiUrl}/api/search/admin/backfill-embeddings`, {
      method: 'POST',
      headers: {
        'X-Admin-Key': adminApiKey,
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
    console.error('Error proxying backfill:', error)
    return NextResponse.json({ error: 'Failed to trigger backfill' }, { status: 500 })
  }
}
