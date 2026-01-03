/**
 * Merchant Portal Authentication Library
 *
 * Handles:
 * - Merchant user email/password authentication
 * - Admin session detection (from main ironscout.ai)
 * - JWT token generation/verification
 * - Password hashing
 * - Team member management
 */

import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies, headers } from 'next/headers';
import { prisma } from '@ironscout/db';
import type { merchants, merchant_users, MerchantStatus, MerchantUserRole } from '@ironscout/db';
import { logger } from './logger';

// =============================================
// Configuration
// =============================================

// JWT secret for merchant portal tokens
// CRITICAL: At least one of these must be set in production
const jwtSecretString = process.env.MERCHANT_JWT_SECRET || process.env.DEALER_JWT_SECRET || process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
if (!jwtSecretString && process.env.NODE_ENV === 'production') {
  throw new Error('CRITICAL: No JWT secret configured. Set MERCHANT_JWT_SECRET, JWT_SECRET, or NEXTAUTH_SECRET in production.');
}
const JWT_SECRET = new TextEncoder().encode(
  jwtSecretString || 'dev-only-merchant-secret-not-for-production'
);

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);
const SESSION_COOKIE_NAME = process.env.NODE_ENV === 'production'
  ? '__Secure-authjs.session-token'
  : 'authjs.session-token';

const SESSION_COOKIE = 'merchant-session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

async function decodeAdminToken(token: string, secret: string) {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    logger.warn('Admin token verification failed', {}, error);
    return null;
  }
}

// =============================================
// Types
// =============================================

export type SessionType = 'merchant' | 'admin';

export interface MerchantSession {
  type: 'merchant';
  merchantUserId: string;
  merchantId: string;
  email: string;
  name: string;
  role: MerchantUserRole;
  businessName: string;
  status: MerchantStatus;
  tier: string;
  // Impersonation metadata (optional)
  isImpersonating?: boolean;
  impersonatedBy?: string;
  impersonatedAt?: string;
}

export interface AdminSession {
  type: 'admin';
  userId: string;
  email: string;
  name?: string;
}

export type Session = MerchantSession | AdminSession;

// Type that includes the merchant relation
export type MerchantUserWithMerchant = merchant_users & { merchants: merchants };

// Legacy type aliases for backward compatibility
/** @deprecated Use MerchantSession instead */
export type DealerSession = MerchantSession;
/** @deprecated Use MerchantUserWithMerchant instead */
export type DealerUserWithDealer = MerchantUserWithMerchant;

// =============================================
// Password Utilities
// =============================================

export async function hashPassword(password: string): Promise<string> {
  logger.debug('Hashing password');
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  logger.debug('Verifying password');
  return bcrypt.compare(password, hash);
}

// =============================================
// JWT Utilities
// =============================================

export async function createMerchantToken(merchantUser: MerchantUserWithMerchant): Promise<string> {
  logger.debug('Creating merchant JWT token', {
    merchantUserId: merchantUser.id,
    merchantId: merchantUser.merchantId,
    email: merchantUser.email
  });
  return new SignJWT({
    merchantUserId: merchantUser.id,
    merchantId: merchantUser.merchantId,
    email: merchantUser.email,
    name: merchantUser.name,
    role: merchantUser.role,
    businessName: merchantUser.merchants.businessName,
    status: merchantUser.merchants.status,
    tier: merchantUser.merchants.tier,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifyMerchantToken(token: string): Promise<MerchantSession | null> {
  try {
    logger.debug('Verifying merchant JWT token');
    const { payload } = await jwtVerify(token, JWT_SECRET);

    const merchantUserId = payload.merchantUserId as string;
    const merchantId = payload.merchantId as string;

    logger.debug('Token verified successfully', { merchantUserId });

    const session: MerchantSession = {
      type: 'merchant',
      merchantUserId,
      merchantId,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as MerchantUserRole,
      businessName: payload.businessName as string,
      status: payload.status as MerchantStatus,
      tier: payload.tier as string,
    };

    // Include impersonation metadata if present
    if (payload.isImpersonating) {
      session.isImpersonating = true;
      session.impersonatedBy = payload.impersonatedBy as string;
      session.impersonatedAt = payload.impersonatedAt as string;
      logger.info('Impersonation session detected', {
        impersonatedBy: session.impersonatedBy,
        merchantId: session.merchantId
      });
    }

    return session;
  } catch (error) {
    logger.warn('Token verification failed', {}, error);
    return null;
  }
}

// Legacy aliases
/** @deprecated Use createMerchantToken instead */
export const createDealerToken = createMerchantToken;
/** @deprecated Use verifyMerchantToken instead */
export const verifyDealerToken = verifyMerchantToken;

// =============================================
// Session Management
// =============================================

export async function setSessionCookie(token: string): Promise<void> {
  logger.debug('Setting session cookie');
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
  logger.debug('Session cookie set successfully');
}

export async function clearSessionCookie(): Promise<void> {
  logger.debug('Clearing session cookie');
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  logger.info('Session cookie cleared');
}

export async function getMerchantSession(): Promise<MerchantSession | null> {
  const cookieStore = await cookies();

  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    logger.debug('No merchant session cookie found');
    return null;
  }

  return verifyMerchantToken(token);
}

// Legacy alias
/** @deprecated Use getMerchantSession instead */
export const getDealerSession = getMerchantSession;

/**
 * Admin session from shared NextAuth cookie (main web app)
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const cookieStore = await cookies();
    const headerStore = await headers();

    let token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    // Fallback: parse raw cookie header if cookieStore misses it
    if (!token) {
      const rawCookieHeader = headerStore.get('cookie');
      const match = rawCookieHeader?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
      token = match?.[1];
    }

    if (!token) {
      logger.debug('No admin session cookie found', { cookieName: SESSION_COOKIE_NAME });
      return null;
    }

    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
    if (!secret) {
      logger.warn('Admin session unavailable - missing NEXTAUTH_SECRET/AUTH_SECRET');
      return null;
    }

    const payload = await decodeAdminToken(token, secret);

    if (!payload) {
      logger.warn('Admin session decode returned null');
      return null;
    }

    const email = (payload.email as string | undefined)?.toLowerCase();
    const userId = payload.sub as string | undefined;
    const name = payload.name as string | undefined;

    if (!email || !userId) {
      logger.warn('Admin token missing email or sub');
      return null;
    }

    if (!ADMIN_EMAILS.includes(email)) {
      logger.warn('Admin email not authorized', { email });
      return null;
    }

    return {
      type: 'admin',
      userId,
      email,
      name,
    };
  } catch (error) {
    logger.error('Error verifying admin session', {}, error);
    return null;
  }
}

/**
 * Convenience wrapper used throughout the merchant app.
 * Returns merchant session (real or impersonated) or admin session if present.
 */
export async function getSession(): Promise<Session | null> {
  const merchantSession = await getMerchantSession();
  if (merchantSession) {
    return merchantSession;
  }

  return getAdminSession();
}

/**
 * Check if current merchant user can manage team (OWNER or ADMIN role)
 */
export function canManageTeam(session: MerchantSession): boolean {
  return session.role === 'OWNER' || session.role === 'ADMIN';
}

/**
 * Check if current merchant user can edit settings (OWNER, ADMIN, or MEMBER role)
 */
export function canEditSettings(session: MerchantSession): boolean {
  return session.role !== 'VIEWER';
}

/**
 * Get session with fresh merchant data from database
 */
export async function getSessionWithMerchant(): Promise<{
  session: Session;
  merchant?: merchants;
  merchantUser?: merchant_users;
} | null> {
  const session = await getSession();

  if (!session) return null;

  if (session.type === 'merchant') {
    logger.debug('Fetching fresh merchant data', { merchantUserId: session.merchantUserId });
    const merchantUser = await prisma.merchant_users.findUnique({
      where: { id: session.merchantUserId },
      include: { merchants: true },
    });

    if (!merchantUser) {
      logger.warn('Merchant user not found for session', { merchantUserId: session.merchantUserId });
      return null;
    }

    return { session, merchant: merchantUser.merchants, merchantUser };
  }

  return { session };
}

// Legacy alias
/** @deprecated Use getSessionWithMerchant instead */
export const getSessionWithDealer = getSessionWithMerchant;

// =============================================
// Authentication Actions
// =============================================

export interface LoginResult {
  success: boolean;
  error?: string;
  token?: string;
  merchant?: merchants;
  merchantUser?: merchant_users;
}

export async function authenticateMerchant(
  email: string,
  password: string
): Promise<LoginResult> {
  const authLogger = logger.child({ action: 'login', email: email.toLowerCase() });

  authLogger.info('Login attempt started');

  try {
    // Find merchant user by email (with merchant info)
    const merchantUser = await prisma.merchant_users.findFirst({
      where: { email: email.toLowerCase() },
      include: { merchants: true },
    });

    if (!merchantUser) {
      authLogger.warn('Login failed - user not found');
      return { success: false, error: 'Invalid email or password' };
    }

    authLogger.debug('Merchant user found, verifying password', {
      merchantUserId: merchantUser.id,
      merchantId: merchantUser.merchantId
    });

    const isValid = await verifyPassword(password, merchantUser.passwordHash);

    if (!isValid) {
      authLogger.warn('Login failed - invalid password', { merchantUserId: merchantUser.id });
      return { success: false, error: 'Invalid email or password' };
    }

    if (!merchantUser.emailVerified) {
      authLogger.warn('Login failed - email not verified', { merchantUserId: merchantUser.id });
      return { success: false, error: 'Please verify your email address' };
    }

    const merchant = merchantUser.merchants;

    if (merchant.status === 'PENDING') {
      authLogger.warn('Login failed - account pending', { merchantId: merchant.id });
      return { success: false, error: 'Your account is pending approval' };
    }

    if (merchant.status === 'SUSPENDED') {
      authLogger.warn('Login failed - account suspended', { merchantId: merchant.id });
      return { success: false, error: 'Your account has been suspended' };
    }

    // Update last login timestamp
    await prisma.merchant_users.update({
      where: { id: merchantUser.id },
      data: { lastLoginAt: new Date() },
    });

    const token = await createMerchantToken(merchantUser);

    authLogger.info('Login successful', {
      merchantUserId: merchantUser.id,
      merchantId: merchant.id,
      status: merchant.status,
      role: merchantUser.role
    });

    return { success: true, token, merchant, merchantUser };
  } catch (error) {
    authLogger.error('Login failed - unexpected error', {}, error);
    throw error;
  }
}

// Legacy alias
/** @deprecated Use authenticateMerchant instead */
export const authenticateDealer = authenticateMerchant;

export interface RegisterInput {
  email: string;
  password: string;
  businessName: string;
  contactFirstName: string;
  contactLastName: string;
  websiteUrl: string;
  phone?: string;
}

export interface RegisterResult {
  success: boolean;
  error?: string;
  merchant?: merchants;
  merchantUser?: merchant_users;
}

export async function registerMerchant(input: RegisterInput): Promise<RegisterResult> {
  const { email, password, businessName, contactFirstName, contactLastName, websiteUrl, phone } = input;

  const regLogger = logger.child({
    action: 'register',
    email: email.toLowerCase(),
    businessName
  });

  regLogger.info('Registration attempt started');

  try {
    // Check if email already exists
    regLogger.debug('Checking for existing account');
    const existing = await prisma.merchant_users.findFirst({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      regLogger.warn('Registration failed - email already exists');
      return { success: false, error: 'An account with this email already exists' };
    }

    // Hash password
    regLogger.debug('Hashing password');
    const passwordHash = await hashPassword(password);

    // Generate verification token
    const verifyToken = crypto.randomUUID();
    regLogger.debug('Generated verification token');

    // Full name for user display
    const fullName = `${contactFirstName} ${contactLastName}`.trim();

    // Create merchant, owner user, and initial contact in a transaction
    regLogger.debug('Creating merchant, owner user, and contact in database');
    const result = await prisma.$transaction(async (tx) => {
      // Create the merchant (business account)
      const merchant = await tx.merchants.create({
        data: {
          businessName,
          contactFirstName,
          contactLastName,
          websiteUrl,
          phone,
          status: 'PENDING',
          tier: 'FOUNDING',
        },
      });

      // Create the owner user
      const merchantUser = await tx.merchant_users.create({
        data: {
          merchantId: merchant.id,
          email: email.toLowerCase(),
          passwordHash,
          name: fullName,
          role: 'OWNER',
          verifyToken,
          emailVerified: false,
        },
      });

      // Create the initial primary contact
      await tx.merchant_contacts.create({
        data: {
          merchantId: merchant.id,
          firstName: contactFirstName,
          lastName: contactLastName,
          email: email.toLowerCase(),
          phone,
          roles: ['PRIMARY'],
          isAccountOwner: true,
          marketingOptIn: false,
          communicationOptIn: true,
        },
      });

      return { merchant, merchantUser };
    });

    regLogger.info('Registration successful', {
      merchantId: result.merchant.id,
      merchantUserId: result.merchantUser.id,
      status: result.merchant.status,
      tier: result.merchant.tier
    });

    return { success: true, merchant: result.merchant, merchantUser: result.merchantUser };
  } catch (error) {
    regLogger.error('Registration failed - database error', {
      websiteUrl,
      contactFirstName,
      contactLastName
    }, error);
    throw error;
  }
}

// Legacy alias
/** @deprecated Use registerMerchant instead */
export const registerDealer = registerMerchant;

// =============================================
// Team Management
// =============================================

export interface InviteResult {
  success: boolean;
  error?: string;
  inviteToken?: string;
}

export async function inviteTeamMember(
  merchantId: string,
  invitedById: string,
  email: string,
  role: MerchantUserRole = 'MEMBER'
): Promise<InviteResult> {
  const inviteLogger = logger.child({
    action: 'invite',
    merchantId,
    email: email.toLowerCase(),
    role
  });

  inviteLogger.info('Invite attempt started');

  try {
    // Check if user already exists for this merchant
    const existingUser = await prisma.merchant_users.findFirst({
      where: {
        merchantId,
        email: email.toLowerCase(),
      },
    });

    if (existingUser) {
      inviteLogger.warn('Invite failed - user already exists');
      return { success: false, error: 'This user is already a team member' };
    }

    // Check for existing pending invite
    const existingInvite = await prisma.merchant_invites.findFirst({
      where: {
        merchantId,
        email: email.toLowerCase(),
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      inviteLogger.warn('Invite failed - pending invite exists');
      return { success: false, error: 'An invite has already been sent to this email' };
    }

    // Cannot invite as OWNER
    if (role === 'OWNER') {
      inviteLogger.warn('Invite failed - cannot invite as owner');
      return { success: false, error: 'Cannot invite someone as owner' };
    }

    // Generate invite token
    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

    // Create invite
    await prisma.merchant_invites.create({
      data: {
        merchantId,
        email: email.toLowerCase(),
        role,
        inviteToken,
        invitedById,
        expiresAt,
      },
    });

    inviteLogger.info('Invite created successfully', { inviteToken });

    // TODO: Send invite email

    return { success: true, inviteToken };
  } catch (error) {
    inviteLogger.error('Invite failed - unexpected error', {}, error);
    throw error;
  }
}

export interface AcceptInviteResult {
  success: boolean;
  error?: string;
  merchantUser?: merchant_users;
}

export async function acceptInvite(
  inviteToken: string,
  password: string,
  name: string
): Promise<AcceptInviteResult> {
  const acceptLogger = logger.child({ action: 'accept-invite' });

  acceptLogger.info('Accept invite attempt started');

  try {
    // Find the invite
    const invite = await prisma.merchant_invites.findUnique({
      where: { inviteToken },
      include: { merchants: true },
    });

    if (!invite) {
      acceptLogger.warn('Accept failed - invite not found');
      return { success: false, error: 'Invalid invite link' };
    }

    if (invite.acceptedAt) {
      acceptLogger.warn('Accept failed - invite already used');
      return { success: false, error: 'This invite has already been used' };
    }

    if (invite.expiresAt < new Date()) {
      acceptLogger.warn('Accept failed - invite expired');
      return { success: false, error: 'This invite has expired' };
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user and mark invite as accepted in transaction
    const result = await prisma.$transaction(async (tx) => {
      const merchantUser = await tx.merchant_users.create({
        data: {
          merchantId: invite.merchantId,
          email: invite.email,
          passwordHash,
          name,
          role: invite.role,
          emailVerified: true, // Already verified via invite email
        },
      });

      await tx.merchant_invites.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      return merchantUser;
    });

    acceptLogger.info('Invite accepted successfully', {
      merchantUserId: result.id,
      merchantId: invite.merchantId
    });

    return { success: true, merchantUser: result };
  } catch (error) {
    acceptLogger.error('Accept invite failed - unexpected error', {}, error);
    throw error;
  }
}

// =============================================
// Admin Actions
// =============================================

export async function approveMerchant(
  merchantId: string,
  adminEmail: string
): Promise<merchants> {
  logger.info('Approving merchant', { merchantId, adminEmail });

  try {
    const merchant = await prisma.merchants.update({
      where: { id: merchantId },
      data: {
        status: 'ACTIVE',
      },
    });

    logger.info('Merchant approved successfully', {
      merchantId,
      adminEmail,
      businessName: merchant.businessName
    });

    return merchant;
  } catch (error) {
    logger.error('Failed to approve merchant', { merchantId, adminEmail }, error);
    throw error;
  }
}

// Legacy alias
/** @deprecated Use approveMerchant instead */
export const approveDealer = approveMerchant;

export async function suspendMerchant(
  merchantId: string,
  adminEmail: string
): Promise<merchants> {
  logger.info('Suspending merchant', { merchantId, adminEmail });

  try {
    const merchant = await prisma.merchants.update({
      where: { id: merchantId },
      data: {
        status: 'SUSPENDED',
      },
    });

    logger.info('Merchant suspended successfully', {
      merchantId,
      adminEmail,
      businessName: merchant.businessName
    });

    return merchant;
  } catch (error) {
    logger.error('Failed to suspend merchant', { merchantId, adminEmail }, error);
    throw error;
  }
}

// Legacy alias
/** @deprecated Use suspendMerchant instead */
export const suspendDealer = suspendMerchant;

// =============================================
// Audit Logging
// =============================================

export async function logAdminAction(
  adminUserId: string,
  action: string,
  {
    merchantId,
    resource,
    resourceId,
    oldValue,
    newValue,
    ipAddress,
    userAgent,
  }: {
    merchantId?: string;
    resource?: string;
    resourceId?: string;
    oldValue?: unknown;
    newValue?: unknown;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  logger.debug('Creating admin audit log', { adminUserId, action, merchantId, resource });

  try {
    await prisma.admin_audit_logs.create({
      data: {
        adminUserId,
        merchantId,
        action,
        resource,
        resourceId,
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
        ipAddress,
        userAgent,
      },
    });

    logger.info('Admin audit log created', { adminUserId, action });
  } catch (error) {
    logger.error('Failed to create admin audit log', { adminUserId, action }, error);
    throw error;
  }
}

