import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '../search/admin/backfill-progress/route'
import { getAdminAccessToken } from '@/lib/admin-session'

vi.mock('@/lib/admin-session', () => ({
  getAdminAccessToken: vi.fn(),
}))

describe('web api/search/admin/backfill-progress route', () => {
  const mockedGetAdminAccessToken = vi.mocked(getAdminAccessToken)
  const originalApiUrl = process.env.API_URL
  const originalPublicApiUrl = process.env.NEXT_PUBLIC_API_URL

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.API_URL = 'http://api.test'
    process.env.NEXT_PUBLIC_API_URL = 'http://api.public'
  })

  afterEach(() => {
    process.env.API_URL = originalApiUrl
    process.env.NEXT_PUBLIC_API_URL = originalPublicApiUrl
    vi.unstubAllGlobals()
  })

  it('returns 401 when admin access token is missing', async () => {
    mockedGetAdminAccessToken.mockResolvedValue(null)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  it('proxies backfill progress from the API', async () => {
    mockedGetAdminAccessToken.mockResolvedValue('token-123')

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ inProgress: true }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ inProgress: true })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/api/search/admin/backfill-progress',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token-123' },
        cache: 'no-store',
      })
    )
  })
})