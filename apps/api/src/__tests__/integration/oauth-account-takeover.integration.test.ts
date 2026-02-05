/**
 * OAuth Account Takeover Prevention Tests (#195)
 *
 * Verify that OAuth signin does NOT link to unverified credentials accounts
 * (pre-registration account takeover), but DOES link to verified accounts.
 *
 * Requires test containers running (pnpm test:up)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import type { Express } from 'express'
import type { PrismaClient } from '@ironscout/db'
import { verifyGoogleIdToken } from '../../services/auth/google-token'

vi.mock('../../services/auth/google-token', () => ({
  verifyGoogleIdToken: vi.fn(),
}))

const TEST_DATABASE_URL = 'postgresql://ironscout_test:ironscout_test@localhost:5433/ironscout_test'
const TEST_REDIS_URL = 'redis://localhost:6380'
const JWT_SECRET = 'test-jwt-secret-for-integration-tests'

const VICTIM_EMAIL = 'victim@test.ironscout.local'
const GOOGLE_SUB = 'google-sub-victim-123'

function mockGoogleVerification() {
  vi.mocked(verifyGoogleIdToken).mockResolvedValue({
    sub: GOOGLE_SUB,
    email: VICTIM_EMAIL,
    emailVerified: true,
    name: 'Victim User',
    picture: null,
  })
}

describe('Pre-registration account takeover prevention (#195)', () => {
  let app: Express
  let prisma: PrismaClient
  let cleanTables: any
  let TABLE_SETS: any

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = TEST_DATABASE_URL
    process.env.REDIS_URL = TEST_REDIS_URL
    process.env.NEXTAUTH_SECRET = JWT_SECRET

    const appModule = await import('../../app')
    app = appModule.app

    const testUtils = await import('@ironscout/db/test-utils')
    cleanTables = testUtils.cleanTables
    TABLE_SETS = testUtils.TABLE_SETS

    prisma = testUtils.createTestClient()
    await prisma.$connect()
  })

  afterAll(async () => {
    const testUtils = await import('@ironscout/db/test-utils')
    await testUtils.disconnectTestClient(prisma)
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    await cleanTables(prisma, TABLE_SETS.users)
  })

  it('evicts unverified credentials account when OAuth user signs in with same email', async () => {
    // Step 1: Attacker registers with victim's email (no email verification)
    const squatterId = randomUUID()
    const hashedPassword = await bcrypt.hash('evil123', 10)
    await prisma.users.create({
      data: {
        id: squatterId,
        email: VICTIM_EMAIL,
        password: hashedPassword,
        tier: 'FREE',
        // emailVerified: null (default — unverified)
      },
    })

    // Step 2: Victim signs in with Google OAuth
    mockGoogleVerification()

    const res = await request(app)
      .post('/api/auth/oauth/signin')
      .send({ provider: 'google', idToken: 'valid-google-token' })
      .expect(201)

    // Should create a NEW user (squatter evicted)
    expect(res.body.isNewUser).toBe(true)
    expect(res.body.user.email).toBe(VICTIM_EMAIL)
    expect(res.body.user.id).not.toBe(squatterId)
    expect(res.body.accessToken).toBeDefined()

    // Squatter account should be gone
    const squatter = await prisma.users.findUnique({ where: { id: squatterId } })
    expect(squatter).toBeNull()

    // New user should have emailVerified set
    const newUser = await prisma.users.findUnique({
      where: { email: VICTIM_EMAIL },
      select: { emailVerified: true },
    })
    expect(newUser?.emailVerified).not.toBeNull()

    // Attacker's password login should fail (account deleted)
    const attackerLogin = await request(app)
      .post('/api/auth/signin')
      .send({ email: VICTIM_EMAIL, password: 'evil123' })
      .expect(401)

    expect(attackerLogin.body.error).toBe('Invalid email or password')
  })

  it('links OAuth account to existing verified user (OAuth-verified)', async () => {
    // User previously signed up via a different OAuth flow and has emailVerified set
    const verifiedUserId = randomUUID()
    await prisma.users.create({
      data: {
        id: verifiedUserId,
        email: VICTIM_EMAIL,
        emailVerified: new Date('2025-01-01'),
        tier: 'FREE',
      },
    })

    mockGoogleVerification()

    const res = await request(app)
      .post('/api/auth/oauth/signin')
      .send({ provider: 'google', idToken: 'valid-google-token' })
      .expect(200)

    // Should link to the existing user, NOT create a new one
    expect(res.body.isNewUser).toBe(false)
    expect(res.body.user.id).toBe(verifiedUserId)
    expect(res.body.accessToken).toBeDefined()

    // OAuth account should be linked to the existing user
    const account = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'google',
          providerAccountId: GOOGLE_SUB,
        },
      },
    })
    expect(account?.userId).toBe(verifiedUserId)
  })

  it('creates new user when no existing account matches the email', async () => {
    // No pre-existing user with this email
    mockGoogleVerification()

    const res = await request(app)
      .post('/api/auth/oauth/signin')
      .send({ provider: 'google', idToken: 'valid-google-token' })
      .expect(201)

    expect(res.body.isNewUser).toBe(true)
    expect(res.body.user.email).toBe(VICTIM_EMAIL)
    expect(res.body.accessToken).toBeDefined()

    // User should have emailVerified set (OAuth)
    const user = await prisma.users.findUnique({
      where: { email: VICTIM_EMAIL },
      select: { emailVerified: true },
    })
    expect(user?.emailVerified).not.toBeNull()
  })
})
