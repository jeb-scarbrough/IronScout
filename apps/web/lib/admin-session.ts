import { auth } from '@/lib/auth'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)

export async function getAdminAccessToken(): Promise<string | null> {
  const session = await auth()
  if (!session?.user?.email) {
    return null
  }

  const email = session.user.email.toLowerCase()
  if (!ADMIN_EMAILS.includes(email)) {
    return null
  }

  const accessToken = (session as { accessToken?: string }).accessToken
  return accessToken || null
}