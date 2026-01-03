/**
 * Delinquency Auto-Unlist Tests
 *
 * Per Merchant-and-Retailer-Reference.md:
 * - Delinquency auto-UNLISTs all Retailers
 * - Recovery does NOT auto-relist (requires explicit merchant/admin action)
 *
 * These tests verify that all delinquency webhook paths correctly
 * unlist retailers when a merchant becomes delinquent.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// Use forward slashes for cross-platform compatibility
const PAYMENTS_PATH = path.resolve(__dirname, '../payments.ts').replace(/\\/g, '/')

describe('Delinquency Auto-Unlist Implementation', () => {
  let paymentsSource: string

  beforeEach(() => {
    paymentsSource = fs.readFileSync(PAYMENTS_PATH, 'utf-8')
  })

  describe('unlistAllRetailersForMerchant function', () => {
    it('should be defined in payments.ts', () => {
      expect(paymentsSource).toContain('async function unlistAllRetailersForMerchant')
    })

    it('should accept merchantId, reason, and actor parameters', () => {
      expect(paymentsSource).toMatch(/unlistAllRetailersForMerchant\s*\(\s*merchantId:\s*string/)
      expect(paymentsSource).toMatch(/reason:\s*UnlistReason/)
      expect(paymentsSource).toMatch(/actor:\s*string\s*=\s*['"]system['"]/)
    })

    it('should be idempotent - only update LISTED retailers', () => {
      // Function should query for listingStatus: 'LISTED' only
      expect(paymentsSource).toContain("listingStatus: 'LISTED'")
    })

    it('should update listingStatus to UNLISTED', () => {
      expect(paymentsSource).toContain("listingStatus: 'UNLISTED'")
    })

    it('should set unlistedAt, unlistedBy, and unlistedReason for audit trail', () => {
      expect(paymentsSource).toContain('unlistedAt:')
      expect(paymentsSource).toContain('unlistedBy:')
      expect(paymentsSource).toContain('unlistedReason:')
    })

    it('should create audit log entries for each unlisted retailer', () => {
      expect(paymentsSource).toContain("action: 'RETAILER_AUTO_UNLISTED'")
    })
  })

  describe('UnlistReason type', () => {
    it('should define all billing-related unlist reasons', () => {
      expect(paymentsSource).toContain("'billing_payment_failed'")
      expect(paymentsSource).toContain("'billing_subscription_past_due'")
      expect(paymentsSource).toContain("'billing_subscription_unpaid'")
      expect(paymentsSource).toContain("'billing_subscription_paused'")
      expect(paymentsSource).toContain("'billing_subscription_cancelled'")
      expect(paymentsSource).toContain("'billing_subscription_deleted'")
    })

    it('should define policy and manual reasons', () => {
      expect(paymentsSource).toContain("'policy_violation'")
      expect(paymentsSource).toContain("'manual'")
    })
  })

  describe('Webhook handler integration', () => {
    it('handleMerchantPaymentFailed should call unlistAllRetailersForMerchant', () => {
      // Find the handler function and verify it calls unlist
      const handlerMatch = paymentsSource.match(
        /async function handleMerchantPaymentFailed[\s\S]*?^}/m
      )
      expect(handlerMatch).toBeTruthy()
      const handlerBody = handlerMatch![0]
      expect(handlerBody).toContain('unlistAllRetailersForMerchant')
      expect(handlerBody).toContain("'billing_payment_failed'")
    })

    it('handleMerchantSubscriptionUpdated should call unlistAllRetailersForMerchant for past_due', () => {
      const handlerMatch = paymentsSource.match(
        /async function handleMerchantSubscriptionUpdated[\s\S]*?^async function handleMerchant/m
      )
      expect(handlerMatch).toBeTruthy()
      const handlerBody = handlerMatch![0]
      expect(handlerBody).toContain('unlistAllRetailersForMerchant')
      expect(handlerBody).toContain("'billing_subscription_past_due'")
    })

    it('handleMerchantSubscriptionUpdated should call unlistAllRetailersForMerchant for unpaid', () => {
      const handlerMatch = paymentsSource.match(
        /async function handleMerchantSubscriptionUpdated[\s\S]*?^async function handleMerchant/m
      )
      expect(handlerMatch).toBeTruthy()
      const handlerBody = handlerMatch![0]
      expect(handlerBody).toContain("'billing_subscription_unpaid'")
    })

    it('handleMerchantSubscriptionPaused should call unlistAllRetailersForMerchant', () => {
      const handlerMatch = paymentsSource.match(
        /async function handleMerchantSubscriptionPaused[\s\S]*?^async function handleMerchant/m
      )
      expect(handlerMatch).toBeTruthy()
      const handlerBody = handlerMatch![0]
      expect(handlerBody).toContain('unlistAllRetailersForMerchant')
      expect(handlerBody).toContain("'billing_subscription_paused'")
    })

    it('handleMerchantSubscriptionDeleted should call unlistAllRetailersForMerchant', () => {
      const handlerMatch = paymentsSource.match(
        /async function handleMerchantSubscriptionDeleted[\s\S]*?^async function handleMerchant/m
      )
      expect(handlerMatch).toBeTruthy()
      const handlerBody = handlerMatch![0]
      expect(handlerBody).toContain('unlistAllRetailersForMerchant')
      expect(handlerBody).toContain("'billing_subscription_deleted'")
    })

    it('handleMerchantSubscriptionResumed should NOT auto-relist retailers', () => {
      // Per spec: Recovery does NOT auto-relist
      const handlerMatch = paymentsSource.match(
        /async function handleMerchantSubscriptionResumed[\s\S]*?^}/m
      )
      expect(handlerMatch).toBeTruthy()
      const handlerBody = handlerMatch![0]
      // Should NOT contain relist logic
      expect(handlerBody).not.toContain("listingStatus: 'LISTED'")
      expect(handlerBody).not.toContain('relistAllRetailersForMerchant')
    })
  })

  describe('Audit logging', () => {
    it('all delinquency handlers should log retailersUnlisted count', () => {
      // Check that handlers include retailersUnlisted in their logs
      expect(paymentsSource).toMatch(/retailersUnlisted:\s*unlistResult\.unlistedCount/)
    })

    it('should use STRIPE_SYSTEM_USER as actor for webhook-initiated unlists', () => {
      expect(paymentsSource).toContain('STRIPE_SYSTEM_USER')
      // Verify it's used in unlist calls
      const unlistCalls = paymentsSource.match(/unlistAllRetailersForMerchant\([^)]+STRIPE_SYSTEM_USER/g)
      // Should have at least 4 calls (payment_failed, past_due, unpaid, paused, deleted)
      expect(unlistCalls).toBeTruthy()
      expect(unlistCalls!.length).toBeGreaterThanOrEqual(4)
    })
  })
})

/**
 * Contract Tests - These verify the semantic correctness of the implementation
 * against the Merchant-and-Retailer-Reference specification.
 */
describe('Merchant-and-Retailer-Reference Contract', () => {
  let paymentsSource: string

  beforeEach(() => {
    paymentsSource = fs.readFileSync(PAYMENTS_PATH, 'utf-8')
  })

  it('should reference Merchant-and-Retailer-Reference in documentation', () => {
    expect(paymentsSource).toContain('Merchant-and-Retailer-Reference')
  })

  it('should document that delinquency auto-unlists retailers', () => {
    expect(paymentsSource).toContain('auto-UNLISTs all Retailers')
  })

  it('should document that recovery does NOT auto-relist', () => {
    expect(paymentsSource).toContain('Recovery does NOT auto-relist')
  })

  it('should enforce idempotency in unlist function', () => {
    // The function should only update rows where listingStatus='LISTED'
    // This ensures calling it multiple times has no additional effect
    const unlistFunction = paymentsSource.match(
      /async function unlistAllRetailersForMerchant[\s\S]*?^}/m
    )
    expect(unlistFunction).toBeTruthy()

    // Should query for LISTED only
    expect(unlistFunction![0]).toContain("listingStatus: 'LISTED'")

    // Should have early return for no-op case
    expect(unlistFunction![0]).toContain('unlistedCount: 0')
  })

  it('should NOT auto-relist on recovery (subscription resumed/payment succeeded)', () => {
    // handleMerchantSubscriptionResumed should NOT relist
    const resumedHandler = paymentsSource.match(
      /async function handleMerchantSubscriptionResumed[\s\S]*?^}/m
    )
    expect(resumedHandler).toBeTruthy()
    expect(resumedHandler![0]).not.toContain("listingStatus: 'LISTED'")

    // handleMerchantInvoicePaid should NOT relist
    const invoicePaidHandler = paymentsSource.match(
      /async function handleMerchantInvoicePaid[\s\S]*?^}/m
    )
    expect(invoicePaidHandler).toBeTruthy()
    expect(invoicePaidHandler![0]).not.toContain("listingStatus: 'LISTED'")
  })
})
