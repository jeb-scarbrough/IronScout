/**
 * Admin Portal NextAuth Configuration
 *
 * Provides OAuth-based authentication for admin users.
 * Admins must use OAuth (Google, etc.) to verify email ownership.
 * Email must be in ADMIN_EMAILS environment variable.
 */

import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import FacebookProvider from 'next-auth/providers/facebook'
import GitHubProvider from 'next-auth/providers/github'
import { prisma } from '@ironscout/db'
import { loggers } from './logger'

// Admin emails list
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

// Cookie domain for cross-subdomain auth (e.g., .ironscout.ai)
// In development, leave undefined to use the current domain
const COOKIE_DOMAIN = process.env.NODE_ENV === 'production'
  ? process.env.COOKIE_DOMAIN || '.ironscout.ai'
  : undefined

const AUTH_SECRET = process.env.NEXTAUTH_SECRET

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: AUTH_SECRET,
  // No adapter - pure JWT sessions (admin emails verified in signIn callback)
  trustHost: true,
  providers: [
    // Google OAuth (primary for admins)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),

    // Optional providers (only added if credentials are configured)
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET ? [
      FacebookProvider({
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      })
    ] : []),

    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET ? [
      GitHubProvider({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      })
    ] : []),
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-authjs.session-token'
        : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: COOKIE_DOMAIN,
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-authjs.callback-url'
        : 'authjs.callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: COOKIE_DOMAIN,
      },
    },
    csrfToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Host-authjs.csrf-token'
        : 'authjs.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        // Note: __Host- prefix requires no domain to be set
      },
    },
    pkceCodeVerifier: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-authjs.pkce.code_verifier'
        : 'authjs.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 15, // 15 minutes
        domain: COOKIE_DOMAIN,
      },
    },
    state: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-authjs.state'
        : 'authjs.state',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 15, // 15 minutes
        domain: COOKIE_DOMAIN,
      },
    },
    nonce: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-authjs.nonce'
        : 'authjs.nonce',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: COOKIE_DOMAIN,
      },
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Only allow admin emails - check FIRST before any database operations
      const email = user.email?.toLowerCase()

      if (!email || !ADMIN_EMAILS.includes(email)) {
        loggers.auth.warn('Blocked login attempt for non-admin email', { email })
        return false
      }

      // Create or update user record in database for consistent audit trail
      if (account?.provider && account.providerAccountId) {
        try {
          // Upsert user - create if not exists, update if exists
          const dbUser = await prisma.users.upsert({
            where: { email },
            create: {
              email,
              name: user.name || null,
              image: user.image || null,
              emailVerified: new Date(), // OAuth = verified
            },
            update: {
              name: user.name || undefined,
              image: user.image || undefined,
              emailVerified: new Date(),
            },
          })

          // Link OAuth account if not already linked
          await prisma.account.upsert({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: account.providerAccountId,
              },
            },
            create: {
              userId: dbUser.id,
              type: account.type || 'oauth',
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
            },
            update: {
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
            },
          })

          // Store internal user ID for JWT callback
          ;(user as any).dbId = dbUser.id

          loggers.auth.info('Admin login approved and user synced', {
            email,
            userId: dbUser.id,
            provider: account.provider,
          })
        } catch (error) {
          // Fail closed - if we can't create/update user, block login
          loggers.auth.error('Failed to sync admin user to database', { email }, error)
          return false
        }
      }

      return true
    },
    async redirect({ url, baseUrl }) {
      loggers.auth.debug('Redirect callback', { url, baseUrl })

      // Allow relative URLs
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`
      }

      try {
        const urlObj = new URL(url)
        const baseUrlObj = new URL(baseUrl)

        // Allow same origin
        if (urlObj.origin === baseUrlObj.origin) {
          return url
        }

        // Allow any subdomain of ironscout.ai
        const allowedDomains = [
          'ironscout.ai',
          'admin.ironscout.ai',
          'merchant.ironscout.ai',
        ]

        // Also allow Render URLs during development/testing
        const allowedRenderDomains = [
          'ironscout-admin.onrender.com',
          'ironscout-merchant.onrender.com',
          'ironscout-web.onrender.com',
        ]

        // Allow localhost in development
        const isLocalhost = urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1'

        if (allowedDomains.includes(urlObj.hostname) ||
            allowedRenderDomains.includes(urlObj.hostname) ||
            urlObj.hostname.endsWith('.ironscout.ai') ||
            (process.env.NODE_ENV !== 'production' && isLocalhost)) {
          loggers.auth.info('Allowing redirect', { url })
          return url
        }

        loggers.auth.warn('Blocked redirect', { url })
      } catch (e) {
        loggers.auth.error('Error parsing URL', { url }, e instanceof Error ? e : new Error(String(e)))
      }

      return baseUrl
    },
    async session({ session, token, user }) {
      if (session?.user) {
        session.user.id = token.sub || user?.id || ''
        session.user.email = token.email as string || session.user.email
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        // Use database user ID (from signIn callback) for consistent audit trail
        // Falls back to OAuth provider ID if dbId not set
        token.sub = (user as any).dbId || user.id
        token.email = user.email
      }
      return token
    },
  },
  session: {
    strategy: 'jwt',
  },
})
