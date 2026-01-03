/**
 * Password Reset Notifications
 */

import {
  sendEmail,
  wrapEmailTemplate,
  emailButton,
  EMAIL_CONFIG,
  type EmailResult,
} from '../channels/email.js';

// =============================================================================
// Password Reset Email
// =============================================================================

export async function sendPasswordResetEmail(
  email: string,
  businessName: string,
  resetToken: string
): Promise<EmailResult> {
  const resetUrl = `${EMAIL_CONFIG.merchantPortalUrl}/reset-password?token=${resetToken}`;

  return sendEmail({
    to: email,
    subject: 'Reset your IronScout Merchant password',
    html: wrapEmailTemplate(`
      <div style="background: #f9fafb; border-radius: 8px; padding: 30px; margin-bottom: 30px;">
        <h2 style="color: #111; font-size: 20px; margin: 0 0 15px 0;">Password Reset Request</h2>
        <p style="margin: 0 0 20px 0;">Hi ${businessName}, we received a request to reset your password. Click the button below to choose a new password.</p>
        
        ${emailButton('Reset Password', resetUrl)}
        
        <p style="margin: 20px 0 0 0; font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
        <p style="margin: 10px 0 0 0; font-size: 12px; color: #888; word-break: break-all;">${resetUrl}</p>
      </div>
      
      <div style="text-align: center; color: #888; font-size: 12px;">
        <p style="margin: 0;">This link expires in 1 hour.</p>
        <p style="margin: 10px 0 0 0;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `),
    text: `Password Reset Request

Hi ${businessName}, we received a request to reset your IronScout Merchant Portal password.

Click the link below to choose a new password:
${resetUrl}

This link expires in 1 hour.

If you didn't request this, you can safely ignore this email.`,
  });
}
