import { Router, Request, Response } from 'express'
import { z } from 'zod'
import Stripe from 'stripe'
import { prisma } from '@ironscout/db'

const router: any = Router()

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-08-16' })
  : null

// =============================================================================
// Schemas
// =============================================================================

const createCheckoutSchema = z.object({
  priceId: z.string(),
  userId: z.string(),
  successUrl: z.string(),
  cancelUrl: z.string()
})

const createDealerCheckoutSchema = z.object({
  priceId: z.string(),
  dealerId: z.string(),
  successUrl: z.string(),
  cancelUrl: z.string()
})

// =============================================================================
// Consumer Checkout (existing)
// =============================================================================

router.post('/create-checkout', async (req: Request, res: Response) => {
  try {
    const { priceId, userId, successUrl, cancelUrl } = createCheckoutSchema.parse(req.body)

    if (!stripe) {
      return res.json({
        url: `${successUrl}?session_id=mock_session_${Date.now()}`,
        sessionId: `mock_session_${Date.now()}`
      })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: {
        type: 'consumer',
        userId: userId,
      },
    })

    res.json({
      url: session.url,
      sessionId: session.id
    })
  } catch (error) {
    console.error('Checkout creation error:', error)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

// =============================================================================
// Dealer Checkout
// =============================================================================

router.post('/dealer/create-checkout', async (req: Request, res: Response) => {
  try {
    const { priceId, dealerId, successUrl, cancelUrl } = createDealerCheckoutSchema.parse(req.body)

    if (!stripe) {
      return res.json({
        url: `${successUrl}?session_id=mock_dealer_session_${Date.now()}`,
        sessionId: `mock_dealer_session_${Date.now()}`
      })
    }

    // Get dealer info for Stripe customer
    const dealer = await prisma.dealer.findUnique({
      where: { id: dealerId },
      include: {
        users: {
          where: { role: 'OWNER' },
          take: 1,
        },
      },
    })

    if (!dealer) {
      return res.status(404).json({ error: 'Dealer not found' })
    }

    const ownerEmail = dealer.users[0]?.email

    // Create or retrieve Stripe customer
    let customerId = dealer.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: ownerEmail,
        name: dealer.businessName,
        metadata: {
          dealerId: dealer.id,
          type: 'dealer',
        },
      })
      customerId = customer.id

      // Save customer ID to dealer record
      await prisma.dealer.update({
        where: { id: dealerId },
        data: { stripeCustomerId: customerId },
      })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: dealerId,
      metadata: {
        type: 'dealer',
        dealerId: dealerId,
      },
      subscription_data: {
        metadata: {
          type: 'dealer',
          dealerId: dealerId,
        },
      },
    })

    res.json({
      url: session.url,
      sessionId: session.id
    })
  } catch (error) {
    console.error('Dealer checkout creation error:', error)
    res.status(500).json({ error: 'Failed to create dealer checkout session' })
  }
})

// =============================================================================
// Dealer Customer Portal
// =============================================================================

router.post('/dealer/create-portal-session', async (req: Request, res: Response) => {
  try {
    const { dealerId, returnUrl } = req.body

    if (!stripe) {
      return res.json({ url: returnUrl })
    }

    const dealer = await prisma.dealer.findUnique({
      where: { id: dealerId },
    })

    if (!dealer?.stripeCustomerId) {
      return res.status(400).json({ error: 'No billing account found' })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: dealer.stripeCustomerId,
      return_url: returnUrl,
    })

    res.json({ url: session.url })
  } catch (error) {
    console.error('Portal session error:', error)
    res.status(500).json({ error: 'Failed to create portal session' })
  }
})

// =============================================================================
// Webhook Handler
// =============================================================================

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const sig = req.headers['stripe-signature'] as string

    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      console.log('Mock webhook received:', req.body)
      return res.json({ received: true })
    }

    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )

    console.log(`[Stripe Webhook] Received event: ${event.type}`)

    switch (event.type) {
      // =======================================================================
      // Checkout completed - new subscription created
      // =======================================================================
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const metadata = session.metadata || {}

        if (metadata.type === 'dealer') {
          await handleDealerCheckoutCompleted(session)
        } else {
          await handleConsumerCheckoutCompleted(session)
        }
        break
      }

      // =======================================================================
      // Invoice paid - subscription renewed or payment succeeded
      // =======================================================================
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const metadata = subscription.metadata || {}

          if (metadata.type === 'dealer') {
            await handleDealerInvoicePaid(invoice, subscription)
          } else {
            await handleConsumerInvoicePaid(invoice, subscription)
          }
        }
        break
      }

      // =======================================================================
      // Invoice payment failed
      // =======================================================================
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const metadata = subscription.metadata || {}

          if (metadata.type === 'dealer') {
            await handleDealerPaymentFailed(invoice, subscription)
          } else {
            await handleConsumerPaymentFailed(invoice, subscription)
          }
        }
        break
      }

      // =======================================================================
      // Subscription updated (e.g., plan change, pause, resume)
      // =======================================================================
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const metadata = subscription.metadata || {}

        if (metadata.type === 'dealer') {
          await handleDealerSubscriptionUpdated(subscription)
        } else {
          await handleConsumerSubscriptionUpdated(subscription)
        }
        break
      }

      // =======================================================================
      // Subscription deleted (cancelled)
      // =======================================================================
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const metadata = subscription.metadata || {}

        if (metadata.type === 'dealer') {
          await handleDealerSubscriptionDeleted(subscription)
        } else {
          await handleConsumerSubscriptionDeleted(subscription)
        }
        break
      }

      // =======================================================================
      // Subscription paused
      // =======================================================================
      case 'customer.subscription.paused': {
        const subscription = event.data.object as Stripe.Subscription
        const metadata = subscription.metadata || {}

        if (metadata.type === 'dealer') {
          await handleDealerSubscriptionPaused(subscription)
        }
        break
      }

      // =======================================================================
      // Subscription resumed
      // =======================================================================
      case 'customer.subscription.resumed': {
        const subscription = event.data.object as Stripe.Subscription
        const metadata = subscription.metadata || {}

        if (metadata.type === 'dealer') {
          await handleDealerSubscriptionResumed(subscription)
        }
        break
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
    }

    res.json({ received: true })
  } catch (error) {
    console.error('[Stripe Webhook] Error:', error)
    res.status(400).json({ error: 'Webhook signature verification failed' })
  }
})

// =============================================================================
// Dealer Webhook Handlers
// =============================================================================

async function handleDealerCheckoutCompleted(session: Stripe.Checkout.Session) {
  const dealerId = session.metadata?.dealerId || session.client_reference_id
  const subscriptionId = session.subscription as string

  if (!dealerId) {
    console.error('[Dealer Webhook] No dealerId in checkout session')
    return
  }

  console.log(`[Dealer Webhook] Checkout completed for dealer ${dealerId}`)

  // Get subscription details
  const subscription = await stripe!.subscriptions.retrieve(subscriptionId)
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000)

  await prisma.dealer.update({
    where: { id: dealerId },
    data: {
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: session.customer as string,
      paymentMethod: 'STRIPE',
      subscriptionStatus: 'ACTIVE',
      subscriptionExpiresAt: currentPeriodEnd,
      autoRenew: true,
    },
  })

  console.log(`[Dealer Webhook] Dealer ${dealerId} subscription activated until ${currentPeriodEnd}`)
}

async function handleDealerInvoicePaid(invoice: Stripe.Invoice, subscription: Stripe.Subscription) {
  const dealerId = subscription.metadata?.dealerId

  if (!dealerId) {
    console.error('[Dealer Webhook] No dealerId in subscription metadata')
    return
  }

  console.log(`[Dealer Webhook] Invoice paid for dealer ${dealerId}`)

  const currentPeriodEnd = new Date(subscription.current_period_end * 1000)

  await prisma.dealer.update({
    where: { id: dealerId },
    data: {
      subscriptionStatus: 'ACTIVE',
      subscriptionExpiresAt: currentPeriodEnd,
    },
  })

  console.log(`[Dealer Webhook] Dealer ${dealerId} subscription renewed until ${currentPeriodEnd}`)
}

async function handleDealerPaymentFailed(invoice: Stripe.Invoice, subscription: Stripe.Subscription) {
  const dealerId = subscription.metadata?.dealerId

  if (!dealerId) {
    console.error('[Dealer Webhook] No dealerId in subscription metadata')
    return
  }

  console.log(`[Dealer Webhook] Payment failed for dealer ${dealerId}`)

  // Set to EXPIRED to trigger grace period
  await prisma.dealer.update({
    where: { id: dealerId },
    data: {
      subscriptionStatus: 'EXPIRED',
      // Keep existing expiration date - grace period calculated from there
    },
  })

  console.log(`[Dealer Webhook] Dealer ${dealerId} subscription marked as EXPIRED (payment failed)`)
}

async function handleDealerSubscriptionUpdated(subscription: Stripe.Subscription) {
  const dealerId = subscription.metadata?.dealerId

  if (!dealerId) {
    console.error('[Dealer Webhook] No dealerId in subscription metadata')
    return
  }

  console.log(`[Dealer Webhook] Subscription updated for dealer ${dealerId}, status: ${subscription.status}`)

  const currentPeriodEnd = new Date(subscription.current_period_end * 1000)

  // Map Stripe status to our status
  let subscriptionStatus: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED' = 'ACTIVE'

  switch (subscription.status) {
    case 'active':
    case 'trialing':
      subscriptionStatus = 'ACTIVE'
      break
    case 'past_due':
    case 'unpaid':
      subscriptionStatus = 'EXPIRED'
      break
    case 'paused':
      subscriptionStatus = 'SUSPENDED'
      break
    case 'canceled':
    case 'incomplete_expired':
      subscriptionStatus = 'CANCELLED'
      break
  }

  await prisma.dealer.update({
    where: { id: dealerId },
    data: {
      subscriptionStatus,
      subscriptionExpiresAt: currentPeriodEnd,
      autoRenew: !subscription.cancel_at_period_end,
    },
  })

  console.log(`[Dealer Webhook] Dealer ${dealerId} updated: status=${subscriptionStatus}, expires=${currentPeriodEnd}`)
}

async function handleDealerSubscriptionDeleted(subscription: Stripe.Subscription) {
  const dealerId = subscription.metadata?.dealerId

  if (!dealerId) {
    console.error('[Dealer Webhook] No dealerId in subscription metadata')
    return
  }

  console.log(`[Dealer Webhook] Subscription deleted for dealer ${dealerId}`)

  await prisma.dealer.update({
    where: { id: dealerId },
    data: {
      subscriptionStatus: 'CANCELLED',
      stripeSubscriptionId: null,
      autoRenew: false,
    },
  })

  console.log(`[Dealer Webhook] Dealer ${dealerId} subscription cancelled`)
}

async function handleDealerSubscriptionPaused(subscription: Stripe.Subscription) {
  const dealerId = subscription.metadata?.dealerId

  if (!dealerId) {
    console.error('[Dealer Webhook] No dealerId in subscription metadata')
    return
  }

  console.log(`[Dealer Webhook] Subscription paused for dealer ${dealerId}`)

  await prisma.dealer.update({
    where: { id: dealerId },
    data: {
      subscriptionStatus: 'SUSPENDED',
    },
  })

  console.log(`[Dealer Webhook] Dealer ${dealerId} subscription suspended (paused)`)
}

async function handleDealerSubscriptionResumed(subscription: Stripe.Subscription) {
  const dealerId = subscription.metadata?.dealerId

  if (!dealerId) {
    console.error('[Dealer Webhook] No dealerId in subscription metadata')
    return
  }

  console.log(`[Dealer Webhook] Subscription resumed for dealer ${dealerId}`)

  const currentPeriodEnd = new Date(subscription.current_period_end * 1000)

  await prisma.dealer.update({
    where: { id: dealerId },
    data: {
      subscriptionStatus: 'ACTIVE',
      subscriptionExpiresAt: currentPeriodEnd,
    },
  })

  console.log(`[Dealer Webhook] Dealer ${dealerId} subscription resumed until ${currentPeriodEnd}`)
}

// =============================================================================
// Consumer Webhook Handlers (placeholders - implement as needed)
// =============================================================================

async function handleConsumerCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id
  console.log(`[Consumer Webhook] Checkout completed for user ${userId}`)
  // TODO: Update user tier to PREMIUM
}

async function handleConsumerInvoicePaid(invoice: Stripe.Invoice, subscription: Stripe.Subscription) {
  console.log(`[Consumer Webhook] Invoice paid for subscription ${subscription.id}`)
  // TODO: Update user subscription status
}

async function handleConsumerPaymentFailed(invoice: Stripe.Invoice, subscription: Stripe.Subscription) {
  console.log(`[Consumer Webhook] Payment failed for subscription ${subscription.id}`)
  // TODO: Handle consumer payment failure
}

async function handleConsumerSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log(`[Consumer Webhook] Subscription updated: ${subscription.id}`)
  // TODO: Update user subscription status
}

async function handleConsumerSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log(`[Consumer Webhook] Subscription deleted: ${subscription.id}`)
  // TODO: Downgrade user to FREE tier
}

// =============================================================================
// Plans endpoint
// =============================================================================

router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = [
      {
        id: 'price_free',
        name: 'Free',
        price: 0,
        currency: 'USD',
        interval: 'month',
        features: [
          'Search, filter, and compare prices across hundreds of dealers',
          'Price-per-round breakdowns',
          'Purpose badges (range, defense, hunting)',
          'Up to 3 delayed price alerts',
          'Basic AI assistance'
        ]
      },
      {
        id: process.env.STRIPE_PRICE_ID_PREMIUM_MONTHLY || 'price_premium_monthly',
        name: 'Premium Monthly',
        price: 4.99,
        currency: 'USD',
        interval: 'month',
        features: [
          'Everything in Free',
          'Personalized AI recommendations based on firearm and use case',
          'Best Value scoring',
          'Price history charts',
          'Unlimited instant alerts',
          'Performance filters (low-recoil, subsonic, +P, match-grade)',
          'AI explanations for recommendations'
        ]
      },
      {
        id: process.env.STRIPE_PRICE_ID_PREMIUM_ANNUALLY || 'price_premium_annual',
        name: 'Premium Annual',
        price: 49.99,
        currency: 'USD',
        interval: 'year',
        monthlyEquivalent: 4.17,
        savings: '17% savings',
        recommended: true,
        features: [
          'Everything in Free',
          'Personalized AI recommendations based on firearm and use case',
          'Best Value scoring',
          'Price history charts',
          'Unlimited instant alerts',
          'Performance filters (low-recoil, subsonic, +P, match-grade)',
          'AI explanations for recommendations'
        ]
      }
    ]

    res.json(plans)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch plans' })
  }
})

// Dealer plans endpoint
router.get('/dealer/plans', async (req: Request, res: Response) => {
  try {
    const dealerPlans = [
      {
        id: process.env.STRIPE_PRICE_ID_DEALER_STANDARD_MONTHLY || 'price_dealer_standard',
        name: 'Standard',
        tier: 'STANDARD',
        price: 99,
        currency: 'USD',
        interval: 'month',
        features: [
          'Product listing inclusion on IronScout.ai',
          'Dealer feed ingestion and SKU matching',
          'Market price benchmarks by caliber',
          'Basic pricing insights',
          'Email alerts for market changes',
          'Monthly performance reports',
          'Email support'
        ]
      },
      {
        id: process.env.STRIPE_PRICE_ID_DEALER_PRO_MONTHLY || 'price_dealer_pro',
        name: 'Pro',
        tier: 'PRO',
        price: 299,
        currency: 'USD',
        interval: 'month',
        popular: true,
        features: [
          'Everything in Standard',
          'More frequent price monitoring',
          'SKU-level price comparisons',
          'Expanded market benchmarks',
          'Actionable pricing insights and alerts',
          'Historical pricing context',
          'API access for inventory synchronization',
          'Phone and email support'
        ]
      }
    ]

    res.json(dealerPlans)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dealer plans' })
  }
})

export { router as paymentsRouter }
