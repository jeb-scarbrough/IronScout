/**
 * OAuth Link Integration Tests
 *
 * Requires test containers running (pnpm test:up)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import type { Express } from 'express'
import type { PrismaClient } from '@ironscout/db'
import { verifyGoogleIdToken } from '../../services/auth/google-token'

vi.mock('../../services/auth/google-token', () => ({
  verifyGoogleIdToken: vi.fn(),
}))

const TEST_DATABASE_URL = 'postgresql://ironscout_test:ironscout_test@localhost:5433/ironscout_test'
const TEST_REDIS_URL = 'redis://localhost:6380'
const JWT_SECRET = 'test-jwt-secret-for-integration-tests'

let app: Express
let createTestClient: any
let disconnectTestClient: any
let cleanTables: any
let createTestUser: any
let TABLE_SETS: any

function createAuthToken(userId: string, email: string): string {
  return jwt.sign(
    {
      sub: userId,
      email,
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    JWT_SECRET
  )
}

describe('/api/auth/oauth/link', () => {
  let prisma: PrismaClient
  const mockedVerify = vi.mocked(verifyGoogleIdToken)

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = TEST_DATABASE_URL
    process.env.REDIS_URL = TEST_REDIS_URL
    process.env.NEXTAUTH_SECRET = JWT_SECRET

    const appModule = await import('../../app')
    app = appModule.app

    const testUtils = await import('@ironscout/db/test-utils')
    createTestClient = testUtils.createTestClient
    disconnectTestClient = testUtils.disconnectTestClient
    cleanTables = testUtils.cleanTables
    createTestUser = testUtils.createTestUser
    TABLE_SETS = testUtils.TABLE_SETS

    prisma = createTestClient()
    await prisma.$connect()
  })

  afterAll(async () => {
    await disconnectTestClient(prisma)
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    await cleanTables(prisma, TABLE_SETS.users)
  })

  it('returns 401 when missing authentication', async () => {
    const res = await request(app)
      .post('/api/auth/oauth/link')
      .send({ provider: 'google', idToken: 'token' })
      .expect(401)

    expect(res.body.error).toBe('Authentication required')
  })

  it('returns 403 when OAuth email does not match user', async () => {
    const user = await createTestUser(prisma, { id: 'user-1', email: 'user1@test.local' })
    const token = createAuthToken(user.id, user.email)

    mockedVerify.mockResolvedValue({
      sub: 'google-sub',
      email: 'other@test.local',
      emailVerified: true,
      name: null,
      picture: null,
    })

    const res = await request(app)
      .post('/api/auth/oauth/link')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'google', providerAccountId: 'google-sub', idToken: 'token' })
      .expect(403)

    expect(res.body.code).toBe('OAUTH_EMAIL_MISMATCH')
  })

  it('links OAuth account to authenticated user', async () => {
    const user = await createTestUser(prisma, { id: 'user-2', email: 'user2@test.local' })
    const token = createAuthToken(user.id, user.email)

    mockedVerify.mockResolvedValue({
      sub: 'google-sub-2',
      email: user.email.toLowerCase(),
      emailVerified: true,
      name: null,
      picture: null,
    })

    const res = await request(app)
      .post('/api/auth/oauth/link')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'google', providerAccountId: 'google-sub-2', idToken: 'token' })
      .expect(200)

    expect(res.body.message).toBe('Account linked successfully')

    const account = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'google',
          providerAccountId: 'google-sub-2',
        },
      },
    })

    expect(account?.userId).toBe(user.id)
  })
})