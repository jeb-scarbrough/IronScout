import { Router, Request, Response } from 'express'
import type { Router as RouterType } from 'express'
import { z } from 'zod'
import { Resend } from 'resend'
import { loggers } from '../config/logger'

const log = loggers.server.child('contact')
const router: RouterType = Router()

const SUPPORT_EMAIL_TO = 'support@ironscout.ai'
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

const contactRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(20).max(5000),
  company: z.string().trim().max(120).optional(),
  pageUrl: z.string().trim().url().max(500).optional(),
  source: z.string().trim().max(80).optional(),
  errorCode: z.string().trim().max(40).optional(),
  errorId: z.string().trim().max(120).optional(),
  // Honeypot field; should always be empty.
  website: z.string().trim().max(200).optional(),
  turnstileToken: z.string().min(10),
})

type ContactRequest = z.infer<typeof contactRequestSchema>

let resendClient: Resend | null = null

function getResendClient(): Resend {
  if (resendClient) return resendClient

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY not configured')
  }

  resendClient = new Resend(apiKey)
  return resendClient
}

function getSenderAddress(): string {
  const raw = process.env.NOREPLY_EMAIL_FROM || process.env.ALERTS_EMAIL_FROM || ''
  // Env var may already contain a display name, e.g. "IronScout Alerts <alerts@ironscout.ai>".
  // Extract the bare address so the caller can wrap it with its own display name.
  const match = raw.match(/<([^>]+)>/)
  return match ? match[1] : (raw || 'noreply@ironscout.ai')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildMessageText(payload: ContactRequest): string {
  return [
    `Contact form submission received`,
    ``,
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Company: ${payload.company || '(not provided)'}`,
    `Source: ${payload.source || '(not provided)'}`,
    `Page URL: ${payload.pageUrl || '(not provided)'}`,
    `Error code: ${payload.errorCode || '(not provided)'}`,
    `Error ID: ${payload.errorId || '(not provided)'}`,
    ``,
    `Subject: ${payload.subject}`,
    ``,
    `Message:`,
    payload.message,
  ].join('\n')
}

function buildMessageHtml(payload: ContactRequest): string {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#111827">
      <h2 style="margin:0 0 12px 0;">Contact form submission</h2>
      <table style="border-collapse:collapse;margin-bottom:16px;">
        <tr><td style="padding:4px 8px 4px 0;font-weight:600;">Name:</td><td>${escapeHtml(payload.name)}</td></tr>
        <tr><td style="padding:4px 8px 4px 0;font-weight:600;">Email:</td><td>${escapeHtml(payload.email)}</td></tr>
        <tr><td style="padding:4px 8px 4px 0;font-weight:600;">Company:</td><td>${escapeHtml(payload.company || '(not provided)')}</td></tr>
        <tr><td style="padding:4px 8px 4px 0;font-weight:600;">Source:</td><td>${escapeHtml(payload.source || '(not provided)')}</td></tr>
        <tr><td style="padding:4px 8px 4px 0;font-weight:600;">Page URL:</td><td>${escapeHtml(payload.pageUrl || '(not provided)')}</td></tr>
        <tr><td style="padding:4px 8px 4px 0;font-weight:600;">Error code:</td><td>${escapeHtml(payload.errorCode || '(not provided)')}</td></tr>
        <tr><td style="padding:4px 8px 4px 0;font-weight:600;">Error ID:</td><td>${escapeHtml(payload.errorId || '(not provided)')}</td></tr>
      </table>
      <h3 style="margin:0 0 8px 0;">Subject</h3>
      <p style="margin:0 0 16px 0;">${escapeHtml(payload.subject)}</p>
      <h3 style="margin:0 0 8px 0;">Message</h3>
      <pre style="white-space:pre-wrap;background:#f3f4f6;padding:12px;border-radius:8px;margin:0;">${escapeHtml(payload.message)}</pre>
    </div>
  `
}

async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    throw new Error('TURNSTILE_SECRET_KEY not configured')
  }

  const formData = new URLSearchParams({
    secret,
    response: token,
  })
  if (remoteIp) {
    formData.set('remoteip', remoteIp)
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: formData,
  })
  if (!response.ok) {
    throw new Error(`Turnstile verification failed with status ${response.status}`)
  }

  const data = (await response.json()) as {
    success?: boolean
    action?: string
  }

  return data.success === true && (!data.action || data.action === 'contact_form')
}

router.post('/', async (req: Request, res: Response) => {
  const parsed = contactRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid contact form submission' })
  }

  const payload = parsed.data

  // Basic honeypot; bots typically fill hidden fields.
  if (payload.website && payload.website.length > 0) {
    return res.status(400).json({ error: 'Invalid contact form submission' })
  }

  let captchaVerified = false
  try {
    captchaVerified = await verifyTurnstileToken(payload.turnstileToken, req.ip)
  } catch (error) {
    log.error('Contact form captcha verification failed unexpectedly', {}, error as Error)
    return res.status(503).json({ error: 'Contact form is temporarily unavailable' })
  }
  if (!captchaVerified) {
    return res.status(403).json({ error: 'Captcha verification failed' })
  }

  try {
    const resend = getResendClient()
    const fromAddress = getSenderAddress()
    const { data, error: sendError } = await resend.emails.send({
      from: `IronScout Support <${fromAddress}>`,
      to: [SUPPORT_EMAIL_TO],
      replyTo: payload.email,
      subject: `[Contact] ${payload.subject}`,
      text: buildMessageText(payload),
      html: buildMessageHtml(payload),
    })

    if (sendError || !data?.id) {
      log.error('Contact form Resend rejected email', { sendError, from: fromAddress })
      return res.status(503).json({ error: 'Contact form is temporarily unavailable' })
    }

    log.info('Contact form email sent', { emailId: data.id, from: fromAddress })
    return res.status(202).json({ ok: true })
  } catch (error) {
    log.error('Contact form email delivery failed', {}, error as Error)
    return res.status(503).json({ error: 'Contact form is temporarily unavailable' })
  }
})

export { router as contactRouter }
