import { describe, expect, it } from 'vitest'
import { clampRateLimit, isHostAllowed, mapFetchResult } from '../http.js'

describe('clampRateLimit', () => {
  it('caps aggressive plugin hints to framework guardrails', () => {
    expect(
      clampRateLimit({
        requestsPerSecond: 10,
        minDelayMs: 10,
        maxConcurrent: 10,
      })
    ).toEqual({
      requestsPerSecond: 2,
      minDelayMs: 500,
      maxConcurrent: 1,
    })
  })

  it('keeps conservative values when inside guardrails', () => {
    expect(
      clampRateLimit({
        requestsPerSecond: 0.5,
        minDelayMs: 800,
        maxConcurrent: 1,
      })
    ).toEqual({
      requestsPerSecond: 0.5,
      minDelayMs: 800,
      maxConcurrent: 1,
    })
  })
})

describe('isHostAllowed', () => {
  it('allows host when it matches baseUrls exactly', () => {
    expect(
      isHostAllowed('https://www.example.com/product/1', ['https://www.example.com'])
    ).toBe(true)
  })

  it('rejects private/reserved hosts and non-matching domains', () => {
    expect(isHostAllowed('https://172.20.0.1/a', ['https://172.20.0.1'])).toBe(false)
    expect(
      isHostAllowed('https://shop.example.com/p/1', ['https://www.example.com'])
    ).toBe(false)
  })
})

describe('mapFetchResult', () => {
  it('maps successful and failed fetch results', () => {
    expect(
      mapFetchResult({
        status: 'ok',
        statusCode: 200,
        html: '<html></html>',
        durationMs: 123,
      })
    ).toEqual({
      ok: true,
      statusCode: 200,
      body: '<html></html>',
      durationMs: 123,
    })

    expect(
      mapFetchResult({
        status: 'timeout',
        durationMs: 456,
      })
    ).toEqual({
      ok: false,
      error: 'timeout',
      durationMs: 456,
    })
  })
})
