'use server';

import { prisma } from '@ironscout/db';
import type { StoreType, MerchantTier, MerchantStatus } from '@ironscout/db/generated/prisma';
import { revalidatePath } from 'next/cache';
import { getAdminSession, logAdminAction } from '@/lib/auth';
import { loggers } from '@/lib/logger';

export interface CreateMerchantInput {
  businessName: string;
  websiteUrl: string;
  contactFirstName: string;
  contactLastName: string;
  phone?: string;
  storeType: StoreType;
  tier: MerchantTier;
  status: MerchantStatus;
}

export async function createMerchant(data: CreateMerchantInput) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  if (process.env.E2E_TEST_MODE === 'true') {
    return {
      success: true,
      merchant: {
        id: 'e2e-merchant',
        businessName: data.businessName.trim(),
        websiteUrl: data.websiteUrl.trim(),
        tier: data.tier,
        status: data.status,
      },
    };
  }

  try {
    // Validate required fields
    if (!data.businessName.trim()) {
      return { success: false, error: 'Business name is required' };
    }
    if (!data.websiteUrl.trim()) {
      return { success: false, error: 'Website URL is required' };
    }
    if (!data.contactFirstName.trim()) {
      return { success: false, error: 'Contact first name is required' };
    }
    if (!data.contactLastName.trim()) {
      return { success: false, error: 'Contact last name is required' };
    }

    // Normalize website URL
    let websiteUrl = data.websiteUrl.trim().toLowerCase();
    if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
      websiteUrl = 'https://' + websiteUrl;
    }
    // Remove trailing slash
    websiteUrl = websiteUrl.replace(/\/+$/, '');

    // Check for duplicate website URL
    const existingMerchant = await prisma.merchants.findFirst({
      where: { websiteUrl: { equals: websiteUrl, mode: 'insensitive' } },
    });

    if (existingMerchant) {
      return { success: false, error: 'A merchant with this website URL already exists' };
    }

    // Create the merchant
    const merchant = await prisma.merchants.create({
      data: {
        businessName: data.businessName.trim(),
        websiteUrl,
        contactFirstName: data.contactFirstName.trim(),
        contactLastName: data.contactLastName.trim(),
        phone: data.phone?.trim() || null,
        storeType: data.storeType,
        tier: data.tier,
        status: data.status,
      },
    });

    await logAdminAction(session.userId, 'CREATE_MERCHANT', {
      resource: 'Merchant',
      resourceId: merchant.id,
      newValue: {
        businessName: merchant.businessName,
        websiteUrl: merchant.websiteUrl,
        tier: merchant.tier,
        status: merchant.status,
      },
    });

    revalidatePath('/merchants');

    return { success: true, merchant };
  } catch (error) {
    loggers.admin.error('Failed to create merchant', {}, error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to create merchant' };
  }
}
