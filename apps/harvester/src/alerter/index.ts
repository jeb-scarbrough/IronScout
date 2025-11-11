import { Worker, Job } from 'bullmq'
import { prisma } from '@zeroedin/db'
import { redisConnection } from '../config/redis'
import { AlertJobData } from '../config/queues'

// Alerter worker - evaluates alerts and sends notifications
export const alerterWorker = new Worker<AlertJobData>(
  'alert',
  async (job: Job<AlertJobData>) => {
    const { executionId, productId, oldPrice, newPrice, inStock } = job.data

    console.log(`[Alerter] Evaluating alerts for product ${productId}`)

    try {
      await prisma.executionLog.create({
        data: {
          executionId,
          level: 'INFO',
          event: 'ALERT_EVALUATE',
          message: `Evaluating alerts for product ${productId}`,
          metadata: { productId, oldPrice, newPrice, inStock },
        },
      })

      // Find all active alerts for this product
      const alerts = await prisma.alert.findMany({
        where: {
          productId,
          isActive: true,
        },
        include: {
          user: true,
          product: true,
        },
      })

      let triggeredCount = 0

      for (const alert of alerts) {
        let shouldTrigger = false
        let triggerReason = ''

        switch (alert.alertType) {
          case 'PRICE_DROP':
            if (oldPrice && newPrice && newPrice < oldPrice) {
              // Check if price dropped below target (if specified)
              if (alert.targetPrice) {
                const target = parseFloat(alert.targetPrice.toString())
                if (newPrice <= target) {
                  shouldTrigger = true
                  triggerReason = `Price dropped to $${newPrice} (target: $${target})`
                }
              } else {
                // Any price drop
                shouldTrigger = true
                triggerReason = `Price dropped from $${oldPrice} to $${newPrice}`
              }
            }
            break

          case 'BACK_IN_STOCK':
            if (inStock === true) {
              shouldTrigger = true
              triggerReason = 'Product is back in stock'
            }
            break

          case 'NEW_PRODUCT':
            // This would be triggered differently, when a new product is first added
            // For now, skip this type in price update evaluations
            break
        }

        if (shouldTrigger) {
          // TODO: Send actual notification (email, webhook, push, etc.)
          // For now, just log it
          await sendNotification(alert, triggerReason)

          await prisma.executionLog.create({
            data: {
              executionId,
              level: 'INFO',
              event: 'ALERT_NOTIFY',
              message: `Alert triggered for user ${alert.user.email}: ${triggerReason}`,
              metadata: {
                alertId: alert.id,
                userId: alert.userId,
                productId: alert.productId,
                reason: triggerReason,
              },
            },
          })

          triggeredCount++

          // Optionally deactivate one-time alerts
          // await prisma.alert.update({
          //   where: { id: alert.id },
          //   data: { isActive: false },
          // })
        }
      }

      await prisma.executionLog.create({
        data: {
          executionId,
          level: 'INFO',
          event: 'ALERT_EVALUATE_OK',
          message: `Triggered ${triggeredCount} alerts for product ${productId}`,
          metadata: { triggeredCount },
        },
      })

      return { success: true, triggeredCount }
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

// Send notification to user
async function sendNotification(alert: any, reason: string) {
  // TODO: Implement actual notification delivery
  // Options: Email (SendGrid, AWS SES), Webhook, Push notifications, etc.

  console.log(`[Alerter] NOTIFICATION:`)
  console.log(`  To: ${alert.user.email}`)
  console.log(`  Product: ${alert.product.name}`)
  console.log(`  Reason: ${reason}`)
  console.log(`  Alert Type: ${alert.alertType}`)

  // For MVP, we'll just log it
  // In production, implement email/webhook delivery here
}

alerterWorker.on('completed', (job) => {
  console.log(`[Alerter] Job ${job.id} completed`)
})

alerterWorker.on('failed', (job, err) => {
  console.error(`[Alerter] Job ${job?.id} failed:`, err.message)
})
