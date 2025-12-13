/**
 * Feed Alert Notifications
 * 
 * Sent when dealer product feeds fail or recover.
 */

import {
  sendEmail,
  wrapEmailTemplate,
  emailButton,
  emailInfoBox,
  EMAIL_CONFIG,
  type EmailResult,
} from '../channels/email';
import {
  sendSlackMessage,
  slackHeader,
  slackDivider,
  slackContext,
  slackActions,
  slackButton,
  slackFieldsSection,
  SLACK_CONFIG,
  type SlackResult,
} from '../channels/slack';

// =============================================================================
// Types
// =============================================================================

export interface FeedAlertInfo {
  feedId: string;
  feedType: string;
  dealerId: string;
  businessName: string;
  dealerEmail: string;
  errorMessage?: string;
  lastSuccessAt?: Date | null;
}

export interface NotificationResult {
  email: EmailResult;
  slack: SlackResult;
}

// =============================================================================
// Feed Failed Notification
// =============================================================================

export async function notifyFeedFailed(feed: FeedAlertInfo): Promise<NotificationResult> {
  const dealerPortalUrl = `${EMAIL_CONFIG.dealerPortalUrl}/feeds`;
  const adminDetailUrl = `${EMAIL_CONFIG.adminPortalUrl}/dealers/${feed.dealerId}`;
  
  const lastSuccess = feed.lastSuccessAt 
    ? new Date(feed.lastSuccessAt).toLocaleString()
    : 'Never';

  // Send email to dealer
  const emailResult = await sendEmail({
    to: feed.dealerEmail,
    subject: `⚠️ Feed Alert: ${feed.feedType} feed failed`,
    html: wrapEmailTemplate(`
      ${emailInfoBox(`
        <h2 style="margin: 0 0 10px 0; font-size: 18px;">⚠️ Feed Processing Failed</h2>
        <p style="margin: 0;">Your ${feed.feedType} product feed encountered an error.</p>
      `, 'error')}
      
      <div style="background: #f9fafb; border-radius: 8px; padding: 25px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 140px;">Feed Type:</td>
            <td style="padding: 8px 0; color: #111;">${feed.feedType}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Last Success:</td>
            <td style="padding: 8px 0; color: #111;">${lastSuccess}</td>
          </tr>
          ${feed.errorMessage ? `
          <tr>
            <td style="padding: 8px 0; color: #666; vertical-align: top;">Error:</td>
            <td style="padding: 8px 0; color: #b91c1c; font-family: monospace; font-size: 13px;">${feed.errorMessage}</td>
          </tr>
          ` : ''}
        </table>
      </div>
      
      ${emailButton('View Feed Status', dealerPortalUrl)}
      
      <div style="text-align: center; color: #888; font-size: 12px; margin-top: 20px;">
        <p style="margin: 0;">Need help? Contact support@ironscout.ai</p>
      </div>
    `),
    text: `Feed Processing Failed

Your ${feed.feedType} product feed encountered an error.

Feed Type: ${feed.feedType}
Last Success: ${lastSuccess}${feed.errorMessage ? `\nError: ${feed.errorMessage}` : ''}

View feed status: ${dealerPortalUrl}

Need help? Contact support@ironscout.ai`,
  });

  // Send Slack notification (to feeds channel if configured)
  const slackResult = await sendSlackMessage({
    text: `⚠️ Feed failed: ${feed.businessName} - ${feed.feedType}`,
    blocks: [
      slackHeader('⚠️ Feed Processing Failed'),
      slackFieldsSection({
        'Business': feed.businessName,
        'Feed Type': feed.feedType,
        'Last Success': lastSuccess,
        ...(feed.errorMessage ? { 'Error': `\`${feed.errorMessage.slice(0, 100)}\`` } : {}),
      }),
      slackDivider(),
      slackActions(
        slackButton('View in Admin', adminDetailUrl, 'danger')
      ),
      slackContext(`Feed ID: ${feed.feedId} • Dealer ID: ${feed.dealerId}`),
    ],
  }, SLACK_CONFIG.feedsWebhookUrl || SLACK_CONFIG.dealerOpsWebhookUrl);

  return { email: emailResult, slack: slackResult };
}

// =============================================================================
// Feed Recovered Notification
// =============================================================================

// =============================================================================
// Feed Warning Notification (High Quarantine Rate)
// =============================================================================

export async function notifyFeedWarning(
  feed: FeedAlertInfo,
  stats: { quarantineCount: number; indexedCount: number; quarantineRate: number }
): Promise<NotificationResult> {
  const dealerPortalUrl = `${EMAIL_CONFIG.dealerPortalUrl}/feed/quarantine`;
  const adminDetailUrl = `${EMAIL_CONFIG.adminPortalUrl}/dealers/${feed.dealerId}`;

  const ratePercent = Math.round(stats.quarantineRate * 100);

  // Send email to dealer
  const emailResult = await sendEmail({
    to: feed.dealerEmail,
    subject: `⚠️ Feed Warning: ${ratePercent}% of records quarantined`,
    html: wrapEmailTemplate(`
      ${emailInfoBox(`
        <h2 style="margin: 0 0 10px 0; font-size: 18px;">⚠️ High Quarantine Rate</h2>
        <p style="margin: 0;">${ratePercent}% of your feed records need attention.</p>
      `, 'warning')}

      <div style="background: #f9fafb; border-radius: 8px; padding: 25px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 140px;">Feed Type:</td>
            <td style="padding: 8px 0; color: #111;">${feed.feedType}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Indexed:</td>
            <td style="padding: 8px 0; color: #059669; font-weight: 600;">${stats.indexedCount} records</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Quarantined:</td>
            <td style="padding: 8px 0; color: #d97706; font-weight: 600;">${stats.quarantineCount} records</td>
          </tr>
        </table>
      </div>

      <p style="color: #666; font-size: 14px;">
        Records are quarantined when they're missing a valid UPC code.
        You can add corrections to fix these records.
      </p>

      ${emailButton('Review Quarantine Queue', dealerPortalUrl)}
    `),
    text: `Feed Warning - High Quarantine Rate

${ratePercent}% of your feed records need attention.

Feed Type: ${feed.feedType}
Indexed: ${stats.indexedCount} records
Quarantined: ${stats.quarantineCount} records

Records are quarantined when they're missing a valid UPC code.
You can add corrections to fix these records.

Review quarantine queue: ${dealerPortalUrl}`,
  });

  // Send Slack notification
  const slackResult = await sendSlackMessage({
    text: `⚠️ High quarantine rate: ${feed.businessName} - ${ratePercent}%`,
    blocks: [
      slackHeader('⚠️ High Quarantine Rate'),
      slackFieldsSection({
        'Business': feed.businessName,
        'Feed Type': feed.feedType,
        'Indexed': `${stats.indexedCount} records`,
        'Quarantined': `${stats.quarantineCount} records (${ratePercent}%)`,
      }),
      slackDivider(),
      slackActions(
        slackButton('View in Admin', adminDetailUrl, 'danger')
      ),
      slackContext(`Feed ID: ${feed.feedId} • Dealer ID: ${feed.dealerId}`),
    ],
  }, SLACK_CONFIG.feedsWebhookUrl || SLACK_CONFIG.dealerOpsWebhookUrl);

  return { email: emailResult, slack: slackResult };
}

// =============================================================================
// Feed Recovered Notification
// =============================================================================

export async function notifyFeedRecovered(feed: FeedAlertInfo): Promise<NotificationResult> {
  const dealerPortalUrl = `${EMAIL_CONFIG.dealerPortalUrl}/feeds`;
  const adminDetailUrl = `${EMAIL_CONFIG.adminPortalUrl}/dealers/${feed.dealerId}`;

  // Send email to dealer
  const emailResult = await sendEmail({
    to: feed.dealerEmail,
    subject: `✅ Feed Recovered: ${feed.feedType} feed is healthy`,
    html: wrapEmailTemplate(`
      ${emailInfoBox(`
        <h2 style="margin: 0 0 10px 0; font-size: 18px;">✅ Feed Recovered</h2>
        <p style="margin: 0;">Your ${feed.feedType} product feed is processing successfully again.</p>
      `, 'success')}
      
      <div style="background: #f9fafb; border-radius: 8px; padding: 25px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 140px;">Feed Type:</td>
            <td style="padding: 8px 0; color: #111;">${feed.feedType}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Status:</td>
            <td style="padding: 8px 0;"><span style="background: #ecfdf5; color: #065f46; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">HEALTHY</span></td>
          </tr>
        </table>
      </div>
      
      ${emailButton('View Feed Status', dealerPortalUrl)}
    `),
    text: `Feed Recovered

Your ${feed.feedType} product feed is processing successfully again.

Feed Type: ${feed.feedType}
Status: HEALTHY

View feed status: ${dealerPortalUrl}`,
  });

  // Send Slack notification
  const slackResult = await sendSlackMessage({
    text: `✅ Feed recovered: ${feed.businessName} - ${feed.feedType}`,
    blocks: [
      slackHeader('✅ Feed Recovered'),
      slackFieldsSection({
        'Business': feed.businessName,
        'Feed Type': feed.feedType,
        'Status': '✅ Healthy',
      }),
      slackDivider(),
      slackActions(
        slackButton('View in Admin', adminDetailUrl)
      ),
      slackContext(`Feed ID: ${feed.feedId} • Dealer ID: ${feed.dealerId}`),
    ],
  }, SLACK_CONFIG.feedsWebhookUrl || SLACK_CONFIG.dealerOpsWebhookUrl);

  return { email: emailResult, slack: slackResult };
}
