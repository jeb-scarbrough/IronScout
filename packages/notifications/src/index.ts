/**
 * @ironscout/notifications
 *
 * Unified notification service for IronScout platform.
 * Supports email (Resend) and Slack (Webhooks) channels.
 *
 * Usage:
 * ```typescript
 * import { notifyNewMerchantSignup, notifyMerchantApproved } from '@ironscout/notifications';
 *
 * await notifyNewMerchantSignup({
 *   id: merchant.id,
 *   email: merchant.email,
 *   businessName: merchant.businessName,
 *   // ...
 * });
 * ```
 *
 * Environment Variables:
 * - RESEND_API_KEY: Resend API key for email delivery
 * - EMAIL_FROM: From address for emails (default: IronScout <noreply@ironscout.ai>)
 * - ADMIN_NOTIFICATION_EMAIL: Admin email for admin notifications (default: operations@ironscout.ai)
 * - SLACK_MERCHANT_OPS_WEBHOOK_URL: Slack webhook for merchant operations notifications
 * - SLACK_DATAFEED_ALERTS_WEBHOOK_URL: Optional separate webhook for datafeed alerts
 * - NEXT_PUBLIC_MERCHANT_URL: Merchant portal URL
 * - ADMIN_PORTAL_URL: Admin portal URL
 *
 * Sending Addresses (Option B - consolidated):
 * - noreply@ironscout.ai — All transactional & notification emails (via EMAIL_FROM / MERCHANT_EMAIL_FROM / NOREPLY_EMAIL_FROM)
 * - alerts@ironscout.ai — Consumer price drop & back-in-stock alerts (via ALERTS_EMAIL_FROM)
 *
 * Receiving Addresses:
 * - operations@ironscout.ai — Admin/ops notifications (via ADMIN_NOTIFICATION_EMAIL / OPERATIONS_EMAIL_TO)
 */

// =============================================================================
// Channel Exports (for advanced usage)
// =============================================================================

export {
  // Email
  sendEmail,
  wrapEmailTemplate,
  emailButton,
  emailInfoBox,
  EMAIL_CONFIG,
  type EmailResult,
  type SendEmailOptions,
} from './channels/email.js';

export {
  // Slack
  sendSlackMessage,
  slackHeader,
  slackText,
  slackDivider,
  slackContext,
  slackActions,
  slackButton,
  slackFieldsSection,
  SLACK_CONFIG,
  type SlackResult,
  type SlackMessage,
  type SlackBlock,
} from './channels/slack.js';

export {
  wrapLoggerWithSlack,
  type ILogger,
  type LogContext,
  type SlackLoggerOptions,
} from './logger-slack.js';

// =============================================================================
// Notification Exports (primary usage)
// =============================================================================

export {
  // Merchant Signup
  notifyNewMerchantSignup,
  sendMerchantVerificationEmail,
  type NewMerchantInfo,
} from './notifications/merchant-signup.js';

export {
  // Merchant Status Changes
  notifyMerchantApproved,
  notifyMerchantSuspended,
  notifyMerchantReactivated,
  type MerchantStatusInfo,
} from './notifications/merchant-status.js';

export {
  // Password Reset
  sendPasswordResetEmail,
} from './notifications/password-reset.js';

export {
  // Feed Alerts
  notifyFeedFailed,
  notifyFeedRecovered,
  notifyFeedWarning,
  type FeedAlertInfo,
} from './notifications/feed-alerts.js';

export {
  // Affiliate Feed Alerts
  notifyAffiliateFeedRunFailed,
  notifyCircuitBreakerTriggered,
  notifyAffiliateFeedAutoDisabled,
  notifyAffiliateFeedRecovered,
  type AffiliateFeedAlertInfo,
  type CircuitBreakerMetrics,
} from './notifications/affiliate-feed-alerts.js';

export {
  // Subscription Expired
  notifyMerchantSubscriptionExpired,
  type SubscriptionExpiredInfo,
} from './notifications/subscription-expired.js';

// =============================================================================
// Common Types
// =============================================================================

export interface NotificationResult {
  email: { success: boolean; messageId?: string; error?: string };
  slack: { success: boolean; error?: string };
}
