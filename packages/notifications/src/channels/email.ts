/**
 * Email Channel - Resend Integration
 * 
 * Sends transactional emails via Resend API.
 */

import { Resend } from 'resend';

// Lazy-initialized Resend client
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// =============================================================================
// Configuration
// =============================================================================

export const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM || 'IronScout <noreply@ironscout.ai>',
  adminEmail: process.env.ADMIN_NOTIFICATION_EMAIL || 'operations@ironscout.ai',
  dealerPortalUrl: process.env.NEXT_PUBLIC_DEALER_URL || 'https://dealer.ironscout.ai',
  adminPortalUrl: process.env.ADMIN_PORTAL_URL || 'https://admin.ironscout.ai',
};

// =============================================================================
// Types
// =============================================================================

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

// =============================================================================
// Core Email Function
// =============================================================================

export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  try {
    const resend = getResendClient();

    const { data, error } = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    });

    if (error) {
      console.error('[Email] Failed to send:', error.message);
      return { success: false, error: error.message };
    }

    console.log('[Email] Sent successfully:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Email] Error:', message);
    return { success: false, error: message };
  }
}

// =============================================================================
// Email Template Helpers
// =============================================================================

export function wrapEmailTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #111; font-size: 24px; margin: 0;">IronScout</h1>
    <p style="color: #666; font-size: 14px; margin: 5px 0 0 0;">Dealer Platform</p>
  </div>
  
  ${content}
  
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
  
  <div style="text-align: center; color: #888; font-size: 12px;">
    <p style="margin: 0;">&copy; ${new Date().getFullYear()} IronScout. All rights reserved.</p>
  </div>
</body>
</html>
  `.trim();
}

export function emailButton(text: string, url: string): string {
  return `
<div style="text-align: center; margin: 30px 0;">
  <a href="${url}" style="display: inline-block; background: #111; color: #fff; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">${text}</a>
</div>
  `.trim();
}

export function emailInfoBox(content: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): string {
  const styles = {
    info: 'background: #f0f9ff; border: 1px solid #0ea5e9; color: #0369a1;',
    success: 'background: #ecfdf5; border: 1px solid #6ee7b7; color: #065f46;',
    warning: 'background: #fffbeb; border: 1px solid #fcd34d; color: #92400e;',
    error: 'background: #fef2f2; border: 1px solid #fca5a5; color: #b91c1c;',
  };
  
  return `
<div style="${styles[type]} border-radius: 8px; padding: 20px; margin: 20px 0;">
  ${content}
</div>
  `.trim();
}
