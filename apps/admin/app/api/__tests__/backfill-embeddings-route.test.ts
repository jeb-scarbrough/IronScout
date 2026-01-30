import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../search/admin/backfill-embeddings/route'
import { getAdminSession } from '@/lib/auth'

vi.mock('@/lib/auth', () => ({
  getAdminSession: vi.fn(),
}))

describe('admin api/search/admin/backfill-embeddings route', () => {
  const mockedGetAdminSession = vi.mocked(getAdminSession)
  const originalApiUrl = process.env.API_URL
  const originalAdminKey = process.env.ADMIN_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.API_URL = 'http://api.test'
    process.env.ADMIN_API_KEY = 'test-key'
  })

  afterEach(() => {
    process.env.API_URL = originalApiUrl
    process.env.ADMIN_API_KEY = originalAdminKey
    vi.unstubAllGlobals()
  })

  it('returns 401 when session is missing', async () => {
    mockedGetAdminSession.mockResolvedValue(null)

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  it('returns 503 when ADMIN_API_KEY is missing', async () => {
    mockedGetAdminSession.mockResolvedValue({ userId: 'admin-1', email: 'admin@example.com' })
    process.env.ADMIN_API_KEY = ''

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toEqual({ error: 'Admin API key not configured' })
  })

  it('proxies backfill trigger to the API', async () => {
    mockedGetAdminSession.mockResolvedValue({ userId: 'admin-1', email: 'admin@example.com' })

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'queued' }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ message: 'queued' })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/api/search/admin/backfill-embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: { 'X-Admin-Key': 'test-key' },
      })
    )
  })
})