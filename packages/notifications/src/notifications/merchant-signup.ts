/**
 * Merchant Signup Notifications
 *
 * Sent when a new merchant registers for the platform.
 */

import {
  sendEmail,
  wrapEmailTemplate,
  emailButton,
  emailInfoBox,
  EMAIL_CONFIG,
  type EmailResult,
} from '../channels/email.js';
import {
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
} from '../channels/slack.js';

// =============================================================================
// Types
// =============================================================================

export interface NewMerchantInfo {
  id: string;
  email: string;
  businessName: string;
  contactFirstName: string;
  contactLastName: string;
  websiteUrl: string;
  phone?: string | null;
}

export interface NotificationResult {
  email: EmailResult;
  slack: SlackResult;
}

// =============================================================================
// Admin Notification: New Merchant Signup
// =============================================================================

export async function notifyNewMerchantSignup(merchant: NewMerchantInfo): Promise<NotificationResult> {
  const contactName = `${merchant.contactFirstName} ${merchant.contactLastName}`.trim();
  const merchantDetailUrl = `${EMAIL_CONFIG.adminPortalUrl}/merchants/${merchant.id}`;

  // Send email to admin
  const emailResult = await sendEmail({
    to: EMAIL_CONFIG.adminEmail,
    subject: `🆕 New Merchant Registration: ${merchant.businessName}`,
    html: wrapEmailTemplate(`
      ${emailInfoBox('<p style="margin: 0; font-weight: 600;">⏳ New Merchant Awaiting Approval</p>', 'warning')}
      
      <div style="background: #f9fafb; border-radius: 8px; padding: 25px; margin: 20px 0;">
        <h2 style="color: #111; font-size: 18px; margin: 0 0 20px 0;">${merchant.businessName}</h2>

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 120px;">Contact:</td>
            <td style="padding: 8px 0; color: #111;">${contactName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Email:</td>
            <td style="padding: 8px 0; color: #111;"><a href="mailto:${merchant.email}" style="color: #2563eb;">${merchant.email}</a></td>
          </tr>
          ${merchant.phone ? `
          <tr>
            <td style="padding: 8px 0; color: #666;">Phone:</td>
            <td style="padding: 8px 0; color: #111;">${merchant.phone}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 8px 0; color: #666;">Website:</td>
            <td style="padding: 8px 0; color: #111;"><a href="${merchant.websiteUrl}" style="color: #2563eb;" target="_blank">${merchant.websiteUrl}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Status:</td>
            <td style="padding: 8px 0;"><span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">PENDING</span></td>
          </tr>
        </table>
      </div>

      ${emailButton('Review & Approve', merchantDetailUrl)}

      ${emailInfoBox('<p style="margin: 0; font-size: 14px;">💡 <strong>Tip:</strong> Check the merchant\'s website to verify they are a legitimate firearms retailer before approving.</p>', 'info')}

      <div style="text-align: center; color: #888; font-size: 12px; margin-top: 20px;">
        <p style="margin: 0;">Merchant ID: ${merchant.id}</p>
      </div>
    `),
    text: `New Merchant Registration - Awaiting Approval

Business: ${merchant.businessName}
Contact: ${contactName}
Email: ${merchant.email}${merchant.phone ? `\nPhone: ${merchant.phone}` : ''}
Website: ${merchant.websiteUrl}
Status: PENDING

Review and approve this merchant: ${merchantDetailUrl}

Merchant ID: ${merchant.id}`,
  });

  // Send Slack notification
  const slackResult = await sendSlackMessage({
    text: `🆕 New merchant signup: ${merchant.businessName}`,
    blocks: [
      slackHeader('🆕 New Merchant Registration'),
      slackFieldsSection({
        'Business': merchant.businessName,
        'Contact': contactName,
        'Email': merchant.email,
        ...(merchant.phone ? { 'Phone': merchant.phone } : {}),
        'Website': `<${merchant.websiteUrl}|${merchant.websiteUrl}>`,
        'Status': '⏳ Pending Approval',
      }),
      slackDivider(),
      slackActions(
        slackButton('Review in Admin', merchantDetailUrl, 'primary'),
        slackButton('Visit Website', merchant.websiteUrl)
      ),
      slackContext(`Merchant ID: ${merchant.id}`),
    ],
  });

  return { email: emailResult, slack: slackResult };
}

// =============================================================================
// Merchant Notification: Verification Email
// =============================================================================

export async function sendMerchantVerificationEmail(
  email: string,
  businessName: string,
  verifyToken: string
): Promise<EmailResult> {
  const verifyUrl = `${EMAIL_CONFIG.merchantPortalUrl}/verify-email?token=${verifyToken}`;

  return sendEmail({
    to: email,
    subject: 'Verify your IronScout Merchant account',
    html: wrapEmailTemplate(`
      <div style="background: #f9fafb; border-radius: 8px; padding: 30px; margin-bottom: 30px;">
        <h2 style="color: #111; font-size: 20px; margin: 0 0 15px 0;">Welcome, ${businessName}!</h2>
        <p style="margin: 0 0 20px 0;">Thank you for registering for the IronScout Merchant Program. Please verify your email address to continue.</p>
        
        ${emailButton('Verify Email Address', verifyUrl)}
        
        <p style="margin: 20px 0 0 0; font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
        <p style="margin: 10px 0 0 0; font-size: 12px; color: #888; word-break: break-all;">${verifyUrl}</p>
      </div>
      
      ${emailInfoBox('<p style="margin: 0; font-size: 14px;"><strong>Note:</strong> After verifying your email, your account will be reviewed by our team. We\'ll notify you once approved (typically within 1-2 business days).</p>', 'warning')}
      
      <div style="text-align: center; color: #888; font-size: 12px;">
        <p style="margin: 0;">This link expires in 24 hours.</p>
        <p style="margin: 10px 0 0 0;">If you didn't create this account, you can safely ignore this email.</p>
      </div>
    `),
    text: `Welcome to IronScout, ${businessName}!

Thank you for registering for the IronScout Merchant Program.

Please verify your email address by clicking the link below:
${verifyUrl}

Note: After verifying your email, your account will be reviewed by our team. We'll notify you once approved (typically within 1-2 business days).

This link expires in 24 hours.

If you didn't create this account, you can safely ignore this email.`,
  });
}
