import { Worker, Job, Queue } from 'bullmq'
import { prisma } from '@ironscout/db'
import { redisConnection } from '../config/redis'
import { logger } from '../config/logger'
import { AlertJobData } from '../config/queues'
import { Resend } from 'resend'

const log = logger.alerter

// Tier configuration (duplicated from API for harvester independence)
const TIER_ALERT_DELAY_MS = {
  FREE: 60 * 60 * 1000, // 1 hour delay
  PREMIUM: 0, // Real-time
}

/**
 * Check if a product has any visible (eligible) dealer prices.
 *
 * ADR-005: Dealer visibility must be checked at query time.
 * Alerts must not fire from ineligible dealer inventory.
 *
 * A price is visible if:
 * - It comes from a retailer with no linked dealer (direct retailer), OR
 * - It comes from a dealer with subscriptionStatus in ['ACTIVE', 'EXPIRED']
 *
 * Dealers with SUSPENDED or CANCELLED status are hidden.
 */
async function hasVisibleDealerPrice(productId: string): Promise<boolean> {
  const visiblePrice = await prisma.price.findFirst({
    where: {
      productId,
      retailer: {
        OR: [
          // Direct retailer (no dealer linked)
          { dealer: null },
          // Dealer in visible status
          {
            dealer: {
              subscriptionStatus: {
                in: ['ACTIVE', 'EXPIRED'],
              },
            },
          },
        ],
      },
    },
    select: { id: true },
  })

  return visiblePrice !== null
}

// Initialize Resend only if API key is provided
let resend: Resend | null = null
try {
  if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
} catch (error) {
  log.warn('Resend API key not configured - email notifications will be disabled')
}
const FROM_EMAIL = process.env.FROM_EMAIL || 'alerts@ironscout.ai'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

// Queue for delayed notifications
const delayedNotificationQueue = new Queue<{
  alertId: string
  triggerReason: string
  executionId: string
}>('delayed-notification', { connection: redisConnection })

// Alerter worker - evaluates alerts and sends notifications
export const alerterWorker = new Worker<AlertJobData>(
  'alert',
  async (job: Job<AlertJobData>) => {
    const { executionId, productId, oldPrice, newPrice, inStock } = job.data

    log.info('Evaluating alerts', { productId, oldPrice, newPrice, inStock })

    try {
      // ADR-005: Check dealer visibility before evaluating alerts
      // Alerts must not fire from ineligible dealer inventory
      const hasVisiblePrice = await hasVisibleDealerPrice(productId)

      if (!hasVisiblePrice) {
        log.debug('No visible dealer prices, skipping alerts', { productId })

        await prisma.executionLog.create({
          data: {
            executionId,
            level: 'INFO',
            event: 'ALERT_SKIPPED_NO_VISIBLE_DEALER',
            message: `Skipped alert evaluation - no visible dealer prices for product ${productId}`,
            metadata: { productId, oldPrice, newPrice, inStock },
          },
        })

        return { success: true, triggeredCount: 0, delayedCount: 0, skipped: 'no_visible_dealer' }
      }

      await prisma.executionLog.create({
        data: {
          executionId,
          level: 'INFO',
          event: 'ALERT_EVALUATE',
          message: `Evaluating alerts for product ${productId}`,
          metadata: { productId, oldPrice, newPrice, inStock },
        },
      })

      // Find all enabled alerts for this product with user tier info and watchlist preferences
      // ADR-011: Alert is a rule marker; all preferences/state live on WatchlistItem
      const alerts = await prisma.alert.findMany({
        where: {
          productId,
          isEnabled: true,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              tier: true, // Include tier for delay calculation
            }
          },
          product: true,
          watchlistItem: true, // ADR-011: preferences and cooldown state
        },
      })

      let triggeredCount = 0
      let delayedCount = 0

      for (const alert of alerts) {
        const watchlistItem = alert.watchlistItem
        if (!watchlistItem) {
          log.debug('Alert has no watchlistItem, skipping', { alertId: alert.id })
          continue
        }

        // ADR-011: Check if notifications are enabled on the watchlist item
        if (!watchlistItem.notificationsEnabled) {
          log.debug('Notifications disabled for watchlist item, skipping', { watchlistItemId: watchlistItem.id })
          continue
        }

        let shouldTrigger = false
        let triggerReason = ''
        const now = new Date()

        switch (alert.ruleType) {
          case 'PRICE_DROP':
            if (!watchlistItem.priceDropEnabled) {
              continue // Price drop notifications disabled for this item
            }
            if (oldPrice && newPrice && newPrice < oldPrice) {
              const dropAmount = oldPrice - newPrice
              const dropPercent = (dropAmount / oldPrice) * 100
              const minDropPercent = watchlistItem.minDropPercent || 5
              const minDropAmount = parseFloat(watchlistItem.minDropAmount?.toString() || '5')

              // ADR-011: Check thresholds from WatchlistItem
              if (dropPercent >= minDropPercent || dropAmount >= minDropAmount) {
                // Check cooldown from WatchlistItem
                if (watchlistItem.lastPriceNotifiedAt) {
                  const cooldownHours = 24 // Default cooldown for price drops
                  const cooldownThreshold = new Date(now.getTime() - cooldownHours * 60 * 60 * 1000)
                  if (watchlistItem.lastPriceNotifiedAt > cooldownThreshold) {
                    log.debug('Price drop alert in cooldown period, skipping', { alertId: alert.id })
                    continue
                  }
                }
                shouldTrigger = true
                triggerReason = `Price dropped from $${oldPrice} to $${newPrice} (${dropPercent.toFixed(1)}% / $${dropAmount.toFixed(2)} drop)`
              }
            }
            break

          case 'BACK_IN_STOCK':
            if (!watchlistItem.backInStockEnabled) {
              continue // Back in stock notifications disabled for this item
            }
            if (inStock === true) {
              // Check cooldown from WatchlistItem
              const cooldownHours = watchlistItem.stockAlertCooldownHours || 24
              if (watchlistItem.lastStockNotifiedAt) {
                const cooldownThreshold = new Date(now.getTime() - cooldownHours * 60 * 60 * 1000)
                if (watchlistItem.lastStockNotifiedAt > cooldownThreshold) {
                  log.debug('Back in stock alert in cooldown period, skipping', { alertId: alert.id })
                  continue
                }
              }
              shouldTrigger = true
              triggerReason = 'Product is back in stock'
            }
            break
        }

        if (shouldTrigger) {
          // Get user tier and calculate delay
          const userTier = (alert.user.tier || 'FREE') as keyof typeof TIER_ALERT_DELAY_MS
          const delayMs = TIER_ALERT_DELAY_MS[userTier] || TIER_ALERT_DELAY_MS.FREE

          if (delayMs > 0) {
            // Queue delayed notification for FREE users
            await delayedNotificationQueue.add(
              'send-notification',
              {
                alertId: alert.id,
                triggerReason,
                executionId,
              },
              {
                delay: delayMs,
                jobId: `alert-${alert.id}-${Date.now()}`, // Unique job ID
              }
            )

            log.info('Queued delayed notification', { email: alert.user.email, delayMinutes: delayMs / 60000, userTier })

            await prisma.executionLog.create({
              data: {
                executionId,
                level: 'INFO',
                event: 'ALERT_DELAYED',
                message: `Alert queued with ${delayMs / 60000} minute delay for ${alert.user.email} (${userTier} tier)`,
                metadata: {
                  alertId: alert.id,
                  userId: alert.userId,
                  userTier,
                  delayMinutes: delayMs / 60000,
                  reason: triggerReason,
                },
              },
            })

            delayedCount++
          } else {
            // Send immediately for PREMIUM users
            await sendNotification(alert, triggerReason)

            await prisma.executionLog.create({
              data: {
                executionId,
                level: 'INFO',
                event: 'ALERT_NOTIFY',
                message: `Alert triggered immediately for PREMIUM user ${alert.user.email}: ${triggerReason}`,
                metadata: {
                  alertId: alert.id,
                  userId: alert.userId,
                  productId: alert.productId,
                  userTier,
                  reason: triggerReason,
                },
              },
            })

            triggeredCount++
          }

          // ADR-011: Update lastNotified timestamp on WatchlistItem, not Alert
          const updateData: Record<string, Date> = {}
          if (alert.ruleType === 'PRICE_DROP') {
            updateData.lastPriceNotifiedAt = now
          } else if (alert.ruleType === 'BACK_IN_STOCK') {
            updateData.lastStockNotifiedAt = now
          }

          await prisma.watchlistItem.update({
            where: { id: watchlistItem.id },
            data: updateData,
          })
        }
      }

      await prisma.executionLog.create({
        data: {
          executionId,
          level: 'INFO',
          event: 'ALERT_EVALUATE_OK',
          message: `Evaluated alerts: ${triggeredCount} sent immediately, ${delayedCount} delayed`,
          metadata: { triggeredCount, delayedCount },
        },
      })

      return { success: true, triggeredCount, delayedCount }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await prisma.executionLog.create({
        data: {
          executionId,
          level: 'ERROR',
          event: 'ALERT_EVALUATE_FAIL',
          message: `Alert evaluation failed: ${errorMessage}`,
          metadata: { productId },
        },
      })

      throw error
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
)

// Worker for processing delayed notifications
export const delayedNotificationWorker = new Worker<{
  alertId: string
  triggerReason: string
  executionId: string
}>(
  'delayed-notification',
  async (job) => {
    const { alertId, triggerReason, executionId } = job.data

    log.info('Processing delayed notification', { alertId })

    try {
      // Fetch the alert with user, product, and watchlist info
      const alert = await prisma.alert.findUnique({
        where: { id: alertId },
        include: {
          user: true,
          product: true,
          watchlistItem: true,
        },
      })

      if (!alert) {
        log.warn('Alert not found, skipping', { alertId })
        return { success: false, reason: 'Alert not found' }
      }

      // ADR-011: Check if alert is still enabled
      if (!alert.isEnabled) {
        log.debug('Alert no longer enabled, skipping', { alertId })
        return { success: false, reason: 'Alert no longer enabled' }
      }

      // ADR-011: Check if notifications are still enabled on watchlist item
      if (alert.watchlistItem && !alert.watchlistItem.notificationsEnabled) {
        log.debug('Notifications disabled for watchlist item, skipping', { alertId })
        return { success: false, reason: 'Notifications disabled' }
      }

      // Send the notification
      await sendNotification(alert, triggerReason)

      await prisma.executionLog.create({
        data: {
          executionId,
          level: 'INFO',
          event: 'ALERT_DELAYED_SENT',
          message: `Delayed alert notification sent to ${alert.user.email}`,
          metadata: {
            alertId: alert.id,
            userId: alert.userId,
            productId: alert.productId,
            reason: triggerReason,
          },
        },
      })

      return { success: true }
    } catch (error) {
      const err = error as Error
      log.error('Failed to process delayed notification', { alertId, error: err.message })
      throw error
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
)

// Send notification to user
// ADR-011: Uses ruleType instead of alertType
async function sendNotification(alert: any, reason: string) {
  log.info('Sending notification', {
    email: alert.user.email,
    productName: alert.product.name,
    ruleType: alert.ruleType,
    userTier: alert.user.tier,
    reason,
  })

  try {
    // Get the latest price for the product from a visible dealer
    // ADR-005: Only show prices from eligible dealers
    const latestPrice = await prisma.price.findFirst({
      where: {
        productId: alert.productId,
        retailer: {
          OR: [
            { dealer: null },
            { dealer: { subscriptionStatus: { in: ['ACTIVE', 'EXPIRED'] } } },
          ],
        },
      },
      include: { retailer: true },
      orderBy: { createdAt: 'desc' }
    })

    if (!latestPrice) {
      log.warn('No price found for product', { productId: alert.productId })
      return
    }

    const currentPrice = parseFloat(latestPrice.price.toString())
    const productUrl = `${FRONTEND_URL}/products/${alert.productId}`

    if (alert.ruleType === 'PRICE_DROP') {
      const html = generatePriceDropEmailHTML({
        userName: alert.user.name || 'there',
        productName: alert.product.name,
        productUrl,
        productImageUrl: alert.product.imageUrl,
        currentPrice,
        retailerName: latestPrice.retailer.name,
        retailerUrl: latestPrice.url,
        userTier: alert.user.tier,
      })

      if (resend) {
        await resend.emails.send({
          from: `IronScout.ai Alerts <${FROM_EMAIL}>`,
          to: [alert.user.email],
          subject: `🎉 Price Drop Alert: ${alert.product.name}`,
          html
        })
        log.info('Price drop email sent', { email: alert.user.email })
      } else {
        log.debug('Email sending disabled (no RESEND_API_KEY)', { email: alert.user.email, type: 'price_drop' })
      }
    } else if (alert.ruleType === 'BACK_IN_STOCK') {
      const html = generateBackInStockEmailHTML({
        userName: alert.user.name || 'there',
        productName: alert.product.name,
        productUrl,
        productImageUrl: alert.product.imageUrl,
        currentPrice,
        retailerName: latestPrice.retailer.name,
        retailerUrl: latestPrice.url,
        userTier: alert.user.tier,
      })

      if (resend) {
        await resend.emails.send({
          from: `IronScout.ai Alerts <${FROM_EMAIL}>`,
          to: [alert.user.email],
          subject: `✨ Back in Stock: ${alert.product.name}`,
          html
        })
        log.info('Back in stock email sent', { email: alert.user.email })
      } else {
        log.debug('Email sending disabled (no RESEND_API_KEY)', { email: alert.user.email, type: 'back_in_stock' })
      }
    }
  } catch (error) {
    const err = error as Error
    log.error('Failed to send email', { error: err.message })
    // Don't throw - we don't want email failures to stop alert processing
  }
}

function generatePriceDropEmailHTML(data: {
  userName: string
  productName: string
  productUrl: string
  productImageUrl?: string
  currentPrice: number
  retailerName: string
  retailerUrl: string
  userTier: string
}): string {
  const delayNotice = data.userTier === 'FREE'
    ? `<p style="margin: 20px 0 0 0; padding: 15px; background-color: #fef3c7; border-radius: 8px; font-size: 13px; color: #92400e;">
        💡 <strong>Free account:</strong> This alert was delayed by 1 hour.
        <a href="${FRONTEND_URL}/pricing" style="color: #d97706; text-decoration: underline;">Upgrade to Premium</a> for real-time alerts!
       </p>`
    : ''

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Price Drop Alert</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 40px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">🎉 Price Drop Alert!</h1>
                    <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">Great news, ${data.userName}!</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px;">
                    ${data.productImageUrl ? `
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                      <tr>
                        <td align="center">
                          <img src="${data.productImageUrl}" alt="${data.productName}" style="max-width: 300px; height: auto; border-radius: 8px; border: 1px solid #e5e5e5;" />
                        </td>
                      </tr>
                    </table>
                    ` : ''}
                    <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 22px; font-weight: 600;">${data.productName}</h2>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                      <tr>
                        <td style="padding: 20px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #10b981;">
                          <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Current Price</p>
                          <p style="margin: 0; color: #10b981; font-size: 32px; font-weight: 700;">$${data.currentPrice.toFixed(2)}</p>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                      The price dropped to <strong>$${data.currentPrice.toFixed(2)}</strong> at <strong>${data.retailerName}</strong>!
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 20px 0;">
                          <a href="${data.retailerUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: 600;">Buy Now at ${data.retailerName}</a>
                        </td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
                      <tr>
                        <td align="center">
                          <a href="${data.productUrl}" style="color: #667eea; text-decoration: none; font-size: 14px;">View product details →</a>
                        </td>
                      </tr>
                    </table>
                    ${delayNotice}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e5e5e5;">
                    <p style="margin: 0 0 15px 0; color: #6b7280; font-size: 14px; text-align: center;">This alert was triggered by your IronScout.ai price tracking</p>
                    <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                      <a href="${FRONTEND_URL}/dashboard/alerts" style="color: #667eea; text-decoration: none;">Manage your alerts</a> |
                      <a href="${FRONTEND_URL}/dashboard/settings" style="color: #667eea; text-decoration: none;">Notification settings</a>
                    </p>
                    <p style="margin: 15px 0 0 0; color: #9ca3af; font-size: 11px; text-align: center;">© ${new Date().getFullYear()} IronScout.ai. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `
}

function generateBackInStockEmailHTML(data: {
  userName: string
  productName: string
  productUrl: string
  productImageUrl?: string
  currentPrice: number
  retailerName: string
  retailerUrl: string
  userTier: string
}): string {
  const delayNotice = data.userTier === 'FREE' 
    ? `<p style="margin: 20px 0 0 0; padding: 15px; background-color: #fef3c7; border-radius: 8px; font-size: 13px; color: #92400e;">
        💡 <strong>Free account:</strong> This alert was delayed by 1 hour. 
        <a href="${FRONTEND_URL}/pricing" style="color: #d97706; text-decoration: underline;">Upgrade to Premium</a> for real-time alerts!
       </p>`
    : ''

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Back in Stock Alert</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px 40px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">✨ Back in Stock!</h1>
                    <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">Hurry, ${data.userName}!</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px;">
                    ${data.productImageUrl ? `
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                      <tr>
                        <td align="center">
                          <img src="${data.productImageUrl}" alt="${data.productName}" style="max-width: 300px; height: auto; border-radius: 8px; border: 1px solid #e5e5e5;" />
                        </td>
                      </tr>
                    </table>
                    ` : ''}
                    <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 22px; font-weight: 600;">${data.productName}</h2>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                      <tr>
                        <td style="padding: 20px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                          <p style="margin: 0; color: #92400e; font-size: 16px; font-weight: 600;">⚡ This item is now available!</p>
                          <p style="margin: 10px 0 0 0; color: #78350f; font-size: 14px;">Price: <strong style="font-size: 20px;">$${data.currentPrice.toFixed(2)}</strong> at ${data.retailerName}</p>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                      Good news! The product you've been waiting for is back in stock at <strong>${data.retailerName}</strong>. Get it before it sells out again!
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 20px 0;">
                          <a href="${data.retailerUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: 600;">Shop Now at ${data.retailerName}</a>
                        </td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
                      <tr>
                        <td align="center">
                          <a href="${data.productUrl}" style="color: #f5576c; text-decoration: none; font-size: 14px;">View product details →</a>
                        </td>
                      </tr>
                    </table>
                    ${delayNotice}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e5e5e5;">
                    <p style="margin: 0 0 15px 0; color: #6b7280; font-size: 14px; text-align: center;">This alert was triggered by your IronScout.ai stock tracking</p>
                    <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                      <a href="${FRONTEND_URL}/dashboard/alerts" style="color: #f5576c; text-decoration: none;">Manage your alerts</a> |
                      <a href="${FRONTEND_URL}/dashboard/settings" style="color: #f5576c; text-decoration: none;">Notification settings</a>
                    </p>
                    <p style="margin: 15px 0 0 0; color: #9ca3af; font-size: 11px; text-align: center;">© ${new Date().getFullYear()} IronScout.ai. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `
}

alerterWorker.on('completed', (job) => {
  log.info('Job completed', { jobId: job.id })
})

alerterWorker.on('failed', (job, err) => {
  log.error('Job failed', { jobId: job?.id, error: err.message })
})

delayedNotificationWorker.on('completed', (job) => {
  log.info('Delayed notification sent', { jobId: job.id })
})

delayedNotificationWorker.on('failed', (job, err) => {
  log.error('Delayed notification failed', { jobId: job?.id, error: err.message })
})
