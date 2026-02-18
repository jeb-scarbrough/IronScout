import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { sendMock, loggerMock } = vi.hoisted(() => ({
  sendMock: vi.fn().mockResolvedValue({ data: { id: 'email_test_123' }, error: null }),
  loggerMock: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('resend', () => {
  class MockResend {
    emails = { send: sendMock }
  }
  return { Resend: MockResend }
})

vi.mock('../../config/logger', () => ({
  loggers: {
    server: {
      child: vi.fn(() => loggerMock),
    },
  },
}))

import { contactRouter } from '../contact'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/contact', contactRouter)
  return app
}

describe('POST /api/contact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RESEND_API_KEY = 'resend_test_key'
    process.env.TURNSTILE_SECRET_KEY = 'turnstile_test_secret'
    process.env.NOREPLY_EMAIL_FROM = 'noreply@ironscout.ai'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accepts valid submission and sends support email', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, action: 'contact_form' }),
    }))

    const app = buildApp()
    const response = await request(app).post('/api/contact').send({
      name: 'Test User',
      email: 'test@example.com',
      subject: 'Support request',
      message: 'I hit an unexpected error and need help with this page.',
      source: 'www-status',
      errorCode: '500',
      pageUrl: 'https://www.ironscout.ai/status/500',
      website: '',
      turnstileToken: 'token_abcdefghijklmnopqrstuvwxyz',
    })

    expect(response.status).toBe(202)
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
      to: ['support@ironscout.ai'],
      replyTo: 'test@example.com',
      subject: '[Contact] Support request',
    }))
  })

  it('rejects submission when honeypot field is filled', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const app = buildApp()
    const response = await request(app).post('/api/contact').send({
      name: 'Bot User',
      email: 'bot@example.com',
      subject: 'Spam',
      message: 'This message should be blocked by honeypot field content.',
      website: 'https://spam.example',
      turnstileToken: 'token_abcdefghijklmnopqrstuvwxyz',
    })

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('rejects submission when captcha verification fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    }))

    const app = buildApp()
    const response = await request(app).post('/api/contact').send({
      name: 'Test User',
      email: 'test@example.com',
      subject: 'Support request',
      message: 'I hit an unexpected error and need help with this page.',
      website: '',
      turnstileToken: 'token_abcdefghijklmnopqrstuvwxyz',
    })

    expect(response.status).toBe(403)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('fails closed when turnstile secret is missing', async () => {
    delete process.env.TURNSTILE_SECRET_KEY
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const app = buildApp()
    const response = await request(app).post('/api/contact').send({
      name: 'Test User',
      email: 'test@example.com',
      subject: 'Support request',
      message: 'I hit an unexpected error and need help with this page.',
      website: '',
      turnstileToken: 'token_abcdefghijklmnopqrstuvwxyz',
    })

    expect(response.status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sendMock).not.toHaveBeenCalled()
  })
})
