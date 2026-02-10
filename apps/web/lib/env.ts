/**
 * Environment Variable Validation
 *
 * This module validates required environment variables at startup.
 * If required variables are missing, the app will fail fast with clear error messages.
 *
 * Server-only variables are only validated on the server.
 * Client-side only has access to NEXT_PUBLIC_* variables.
 *
 * Usage:
 *   import { env } from '@/lib/env'
 *   const apiUrl = env.NEXT_PUBLIC_API_URL
 */

import { createLogger } from './logger'

const logger = createLogger('env')

// Check if we're running on the server
const isServer = typeof window === 'undefined'

// ============================================================================
// Types
// ============================================================================

interface EnvConfig {
  /** Required on both client and server (must be NEXT_PUBLIC_*) */
  requiredPublic: string[]
  /** Required only on server (secrets, API keys) */
  requiredServer: string[]
  /** Optional environment variables with default values */
  optional: Record<string, string>
}

interface ValidatedEnv {
  // Public (available client + server)
  NEXT_PUBLIC_API_URL: string
  NEXT_PUBLIC_E2E_TEST_MODE: string
  // Server-only (only available on server)
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  NEXTAUTH_SECRET: string
  NEXTAUTH_URL: string
  // Optional with defaults
  NODE_ENV: string
  ADMIN_EMAILS: string
  COOKIE_DOMAIN: string
}

// ============================================================================
// Configuration
// ============================================================================

const envConfig: EnvConfig = {
  requiredPublic: [
    'NEXT_PUBLIC_API_URL',
  ],
  requiredServer: [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
  ],
  optional: {
    NODE_ENV: 'development',
    NEXT_PUBLIC_E2E_TEST_MODE: 'false',
    ADMIN_EMAILS: '',
    COOKIE_DOMAIN: '',
  },
}

// NOTE: Keep these maps in sync with envConfig keys.
// Next.js only inlines static NEXT_PUBLIC_* access in client bundles.
const publicEnv = {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_E2E_TEST_MODE: process.env.NEXT_PUBLIC_E2E_TEST_MODE,
}

const optionalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_E2E_TEST_MODE: publicEnv.NEXT_PUBLIC_E2E_TEST_MODE,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS,
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
}

// ============================================================================
// Validation
// ============================================================================

function validateEnv(): ValidatedEnv {
  const missing: string[] = []
  const validated: Record<string, string> = {}

  // Check required public variables (must be available on both client and server)
  for (const key of envConfig.requiredPublic) {
    const value = publicEnv[key as keyof typeof publicEnv]
    if (!value || value.trim() === '') {
      missing.push(key)
    } else {
      validated[key] = value
    }
  }

  // Check server-only required variables (only on server)
  if (isServer) {
    for (const key of envConfig.requiredServer) {
      const value = process.env[key]
      if (!value || value.trim() === '') {
        missing.push(key)
      } else {
        validated[key] = value
      }
    }
  } else {
    // On client, provide empty strings for server-only vars
    // (they should never be accessed client-side anyway)
    for (const key of envConfig.requiredServer) {
      validated[key] = ''
    }
  }

  // Apply optional variables with defaults
  for (const [key, defaultValue] of Object.entries(envConfig.optional)) {
    const value = optionalEnv[key as keyof typeof optionalEnv]
    validated[key] = value && value.trim() !== '' ? value : defaultValue
  }

  // If any required variables are missing, fail fast
  if (missing.length > 0) {
    const context = isServer ? 'server' : 'client'
    const errorMessage = `Missing required environment variables (${context}):\n${missing.map(k => `  - ${k}`).join('\n')}`

    // Log the error
    logger.error(errorMessage, { missing, context })

    // In production on server, this should also alert to Slack
    if (isServer && process.env.NODE_ENV === 'production') {
      alertMissingEnvVars(missing).catch(err => logger.error('Failed to send env var alert', {}, err))
    }

    // Throw to prevent app startup
    throw new Error(errorMessage)
  }

  return validated as unknown as ValidatedEnv
}

// ============================================================================
// Alerting
// ============================================================================

async function alertMissingEnvVars(missing: string[]): Promise<void> {
  const slackWebhookUrl =
    process.env.SLACK_MERCHANT_OPS_WEBHOOK_URL
    ?? process.env.SLACK_DATAFEED_ALERTS_WEBHOOK_URL
  if (!slackWebhookUrl) {
    logger.error('[CRITICAL] Missing env vars and no Slack webhook configured', { missing })
    return
  }

  try {
    await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `:rotating_light: *IronScout Web App Startup Failed*`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:rotating_light: *IronScout Web App Startup Failed*\n\nMissing required environment variables:\n${missing.map(k => `• \`${k}\``).join('\n')}`,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Environment: \`${process.env.NODE_ENV || 'unknown'}\` | Time: ${new Date().toISOString()}`,
              },
            ],
          },
        ],
      }),
    })
  } catch (error) {
    logger.error('[CRITICAL] Failed to send Slack alert for missing env vars', { missing }, error)
  }
}

// ============================================================================
// Export
// ============================================================================

/**
 * Validated environment variables.
 * Access this instead of process.env directly to ensure type safety
 * and fail-fast behavior for missing required variables.
 */
export const env = validateEnv()

/**
 * Check if we're in E2E test mode
 */
export const isE2E = env.NEXT_PUBLIC_E2E_TEST_MODE === 'true'

/**
 * Check if we're in production
 */
export const isProd = env.NODE_ENV === 'production'

/**
 * Check if we're in development
 */
export const isDev = env.NODE_ENV === 'development'
