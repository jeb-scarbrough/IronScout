import { loggers } from '../../config/logger'

const log = loggers.auth

const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com'])

export interface GoogleTokenInfo {
  sub: string
  email: string
  emailVerified: boolean
  name: string | null
  picture: string | null
}

function parseEmailVerified(value: unknown): boolean {
  if (value === true) return true
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return false
}

/**
 * Verify Google ID token via Google's tokeninfo endpoint.
 * Fail closed on any validation ambiguity.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleTokenInfo | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    log.error('GOOGLE_CLIENT_ID not set - rejecting Google OAuth (fail-closed)')
    return null
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { signal: controller.signal }
    )

    if (!response.ok) {
      log.warn('Google tokeninfo rejected token', { status: response.status })
      return null
    }

    const data = (await response.json()) as Record<string, unknown>
    const aud = data.aud as string | undefined
    const iss = data.iss as string | undefined
    const email = (data.email as string | undefined)?.toLowerCase()
    const emailVerified = parseEmailVerified(data.email_verified)
    const sub = data.sub as string | undefined

    if (!aud || aud !== clientId) {
      log.warn('Google tokeninfo invalid audience', { aud })
      return null
    }

    if (!iss || !GOOGLE_ISSUERS.has(iss)) {
      log.warn('Google tokeninfo invalid issuer', { iss })
      return null
    }

    if (!email || !emailVerified) {
      log.warn('Google tokeninfo email not verified', { hasEmail: !!email, emailVerified })
      return null
    }

    if (!sub) {
      log.warn('Google tokeninfo missing subject')
      return null
    }

    return {
      sub,
      email,
      emailVerified,
      name: (data.name as string | undefined) ?? null,
      picture: (data.picture as string | undefined) ?? null,
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      log.warn('Google tokeninfo request timed out')
      return null
    }
    log.error('Google tokeninfo verification failed', {}, error as Error)
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}
