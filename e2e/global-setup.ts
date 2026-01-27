import { chromium, type FullConfig } from '@playwright/test'
import { config as loadEnv } from 'dotenv'
import { mkdirSync } from 'fs'
import { join, resolve } from 'path'
import bcrypt from 'bcryptjs'
import { encode } from 'next-auth/jwt'

const ROOT_DIR = process.cwd()
const STORAGE_DIR = join(ROOT_DIR, 'e2e', '.storage')

function loadEnvFiles() {
  loadEnv({ path: resolve(ROOT_DIR, '.env') })
  loadEnv({ path: resolve(ROOT_DIR, '.env.local'), override: true })
}

function getProjectBaseUrl(config: FullConfig, name: string): string {
  const project = config.projects.find((entry) => entry.name === name)
  const baseUrl = project?.use?.baseURL
  if (!baseUrl) {
    throw new Error(`Missing baseURL for Playwright project: ${name}`)
  }
  return baseUrl
}

async function seedMerchantUser() {
  const { prisma } = await import('../packages/db/index.js')

  const merchantId = process.env.E2E_MERCHANT_ID || 'e2e-merchant'
  const merchantUserId = process.env.E2E_MERCHANT_USER_ID || 'e2e-merchant-user'
  const merchantEmail = process.env.E2E_MERCHANT_EMAIL || 'e2e-merchant@ironscout.local'
  const merchantPassword = process.env.E2E_MERCHANT_PASSWORD || 'e2e-password-123'

  await prisma.merchants.upsert({
    where: { id: merchantId },
    update: {
      businessName: 'E2E Ammo',
      websiteUrl: 'https://e2e.example',
      status: 'ACTIVE',
      tier: 'FOUNDING',
    },
    create: {
      id: merchantId,
      businessName: 'E2E Ammo',
      websiteUrl: 'https://e2e.example',
      status: 'ACTIVE',
      tier: 'FOUNDING',
      storeType: 'ONLINE_ONLY',
      contactFirstName: 'E2E',
      contactLastName: 'Merchant',
    },
  })

  const passwordHash = await bcrypt.hash(merchantPassword, 12)

  await prisma.merchant_users.upsert({
    where: {
      merchantId_email: {
        merchantId,
        email: merchantEmail,
      },
    },
    update: {
      passwordHash,
      emailVerified: true,
      role: 'OWNER',
      name: 'E2E User',
    },
    create: {
      id: merchantUserId,
      merchantId,
      email: merchantEmail,
      passwordHash,
      name: 'E2E User',
      role: 'OWNER',
      emailVerified: true,
    },
  })

  return { merchantEmail, merchantPassword }
}

async function seedAdminUser() {
  const { prisma } = await import('../packages/db/index.js')

  const fallbackEmail = 'e2e-admin@ironscout.local'
  const adminEmail = (process.env.E2E_ADMIN_EMAIL || fallbackEmail).toLowerCase()
  process.env.ADMIN_EMAILS = adminEmail

  const adminUser = await prisma.users.upsert({
    where: { email: adminEmail },
    update: {
      name: 'E2E Admin',
      status: 'ACTIVE',
    },
    create: {
      email: adminEmail,
      name: 'E2E Admin',
      tier: 'FREE',
      status: 'ACTIVE',
    },
  })

  return { adminUser, adminEmail }
}

async function createMerchantStorageState(config: FullConfig, credentials: { merchantEmail: string; merchantPassword: string }) {
  const baseUrl = getProjectBaseUrl(config, 'merchant')
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto(`${baseUrl}/login`)
  await page.getByLabel('Email address').fill(credentials.merchantEmail)
  await page.getByLabel('Password').fill(credentials.merchantPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/dashboard', { timeout: 15000 })

  await context.storageState({ path: join(STORAGE_DIR, 'merchant.json') })
  await browser.close()
}

async function createAdminStorageState(config: FullConfig, admin: { adminUser: { id: string }; adminEmail: string }) {
  const baseUrl = getProjectBaseUrl(config, 'admin')
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || process.env.JWT_SECRET

  if (!secret) {
    throw new Error('NEXTAUTH_SECRET (or AUTH_SECRET/JWT_SECRET) is required to mint admin session')
  }

  const token = await encode({
    token: {
      sub: admin.adminUser.id,
      email: admin.adminEmail,
      name: 'E2E Admin',
    },
    secret,
    salt: 'authjs.session-token',
    maxAge: 30 * 24 * 60 * 60,
  })

  const browser = await chromium.launch()
  const context = await browser.newContext()

  await context.addCookies([
    {
      name: 'authjs.session-token',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])

  const page = await context.newPage()
  await page.goto(baseUrl)

  await context.storageState({ path: join(STORAGE_DIR, 'admin.json') })
  await browser.close()
}

export default async function globalSetup(config: FullConfig) {
  loadEnvFiles()
  if (!process.env.NEXTAUTH_SECRET) {
    process.env.NEXTAUTH_SECRET = 'e2e-jwt-secret'
  }
  const databaseUrl = process.env.DATABASE_URL || ''
  if (!databaseUrl.includes('ironscout_e2e')) {
    throw new Error('Refusing to run E2E setup without DATABASE_URL pointing at ironscout_e2e')
  }
  mkdirSync(STORAGE_DIR, { recursive: true })

  const merchant = await seedMerchantUser()
  const admin = await seedAdminUser()

  await createMerchantStorageState(config, merchant)
  await createAdminStorageState(config, admin)

  const { prisma } = await import('../packages/db/index.js')
  await prisma.$disconnect()
}
