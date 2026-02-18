'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import Script from 'next/script'
import { useSearchParams } from 'next/navigation'

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.ironscout.ai').replace(/\/$/, '')
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

type FormState = {
  name: string
  email: string
  company: string
  subject: string
  message: string
  website: string
}

type SubmitState = {
  type: 'idle' | 'submitting' | 'success' | 'error'
  message?: string
}

type FieldErrors = Partial<Record<keyof FormState, string>>

/** Client-side constraints matching the API Zod schema (contact.ts). */
function validateForm(form: FormState): FieldErrors {
  const errors: FieldErrors = {}
  if (form.name.trim().length < 2) errors.name = 'Name must be at least 2 characters.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.'
  if (form.subject.trim().length < 3) errors.subject = 'Subject must be at least 3 characters.'
  if (form.message.trim().length < 20) errors.message = 'Message must be at least 20 characters.'
  return errors
}

export function ContactSupportForm() {
  const searchParams = useSearchParams()
  const source = searchParams.get('source') || ''
  const errorCode = searchParams.get('code') || ''
  const errorId = searchParams.get('errorId') || ''

  const defaultSubject = useMemo(() => {
    if (errorCode) return `Website error ${errorCode}`
    return 'Support request'
  }, [errorCode])

  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    company: '',
    subject: defaultSubject,
    message: '',
    website: '',
  })
  const [submitState, setSubmitState] = useState<SubmitState>({ type: 'idle' })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [turnstileReady, setTurnstileReady] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [widgetId, setWidgetId] = useState<string | null>(null)
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setForm((prev) => {
      if (prev.subject.trim().length > 0) return prev
      return { ...prev, subject: defaultSubject }
    })
  }, [defaultSubject])

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !turnstileReady || !window.turnstile || !turnstileContainerRef.current || widgetId) {
      return
    }

    const id = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      action: 'contact_form',
      theme: 'dark',
      callback: (token: string) => setTurnstileToken(token),
      'expired-callback': () => setTurnstileToken(''),
      'error-callback': () => setTurnstileToken(''),
    })
    setWidgetId(id)
  }, [turnstileReady, widgetId])

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const errors = validateForm(form)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    if (!turnstileToken) {
      setSubmitState({
        type: 'error',
        message: 'Please complete the bot check before submitting.',
      })
      return
    }

    setSubmitState({ type: 'submitting' })

    const pageUrl = typeof window !== 'undefined' ? window.location.href : undefined

    try {
      const response = await fetch(`${API_BASE_URL}/api/contact`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          source,
          errorCode,
          errorId,
          pageUrl,
          turnstileToken,
        }),
      })

      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(json?.error || 'We could not submit your request right now.')
      }

      setSubmitState({
        type: 'success',
        message: 'Thanks. We received your message and will respond as soon as possible.',
      })
      setForm({
        name: '',
        email: '',
        company: '',
        subject: defaultSubject,
        message: '',
        website: '',
      })
      setFieldErrors({})
      setTurnstileToken('')
      if (window.turnstile && widgetId) {
        window.turnstile.reset(widgetId)
      }
    } catch (error) {
      setSubmitState({
        type: 'error',
        message: error instanceof Error ? error.message : 'Contact form is temporarily unavailable.',
      })
    }
  }

  const formUnavailable = !TURNSTILE_SITE_KEY

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setTurnstileReady(true)}
      />

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-iron-300">Name</span>
            <input
              type="text"
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={120}
              className="rounded-lg border border-iron-800 bg-iron-900/60 px-3 py-2 text-iron-100 focus:border-primary focus:outline-none"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
            />
            {fieldErrors.name && <span className="text-xs text-red-400">{fieldErrors.name}</span>}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-iron-300">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              maxLength={320}
              className="rounded-lg border border-iron-800 bg-iron-900/60 px-3 py-2 text-iron-100 focus:border-primary focus:outline-none"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
            />
            {fieldErrors.email && <span className="text-xs text-red-400">{fieldErrors.email}</span>}
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-iron-300">Company (optional)</span>
          <input
            type="text"
            name="company"
            autoComplete="organization"
            maxLength={120}
            className="rounded-lg border border-iron-800 bg-iron-900/60 px-3 py-2 text-iron-100 focus:border-primary focus:outline-none"
            value={form.company}
            onChange={(event) => updateField('company', event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-iron-300">Subject</span>
          <input
            type="text"
            name="subject"
            required
            minLength={3}
            maxLength={160}
            className="rounded-lg border border-iron-800 bg-iron-900/60 px-3 py-2 text-iron-100 focus:border-primary focus:outline-none"
            value={form.subject}
            onChange={(event) => updateField('subject', event.target.value)}
          />
          {fieldErrors.subject && <span className="text-xs text-red-400">{fieldErrors.subject}</span>}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-iron-300">Message</span>
          <textarea
            name="message"
            required
            rows={8}
            minLength={20}
            maxLength={5000}
            className="rounded-lg border border-iron-800 bg-iron-900/60 px-3 py-2 text-iron-100 focus:border-primary focus:outline-none"
            value={form.message}
            onChange={(event) => updateField('message', event.target.value)}
          />
          {fieldErrors.message && <span className="text-xs text-red-400">{fieldErrors.message}</span>}
        </label>

        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          value={form.website}
          onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))}
        />

        <div>
          {formUnavailable ? (
            <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              Contact form is currently unavailable. Please try again later.
            </p>
          ) : (
            <div ref={turnstileContainerRef} />
          )}
        </div>

        {submitState.type === 'error' && submitState.message ? (
          <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {submitState.message}
          </p>
        ) : null}
        {submitState.type === 'success' && submitState.message ? (
          <p className="rounded-lg border border-emerald-900/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
            {submitState.message}
          </p>
        ) : null}

        <button
          type="submit"
          className="btn-primary"
          disabled={submitState.type === 'submitting' || formUnavailable}
        >
          {submitState.type === 'submitting' ? 'Sending…' : 'Send message'}
        </button>
      </form>
    </>
  )
}
