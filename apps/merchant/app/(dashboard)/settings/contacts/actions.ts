'use server';

import { prisma } from '@ironscout/db';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { loggers } from '@/lib/logger';

export interface ContactData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  roles?: ('PRIMARY' | 'BILLING' | 'TECHNICAL' | 'MARKETING')[];
  marketingOptIn?: boolean;
  communicationOptIn?: boolean;
}

export async function createContact(data: ContactData) {
  const session = await getSession();
  
  if (!session || session.type !== 'merchant') {
    return { success: false, error: 'Unauthorized' };
  }

  // Only OWNER and ADMIN can manage contacts
  if (session.role !== 'OWNER' && session.role !== 'ADMIN') {
    return { success: false, error: 'You do not have permission to manage contacts' };
  }

  try {
    // Check if email already exists for this merchant
    const existingContact = await prisma.merchant_contacts.findUnique({
      where: {
        merchantId_email: {
          merchantId: session.merchantId,
          email: data.email.toLowerCase(),
        },
      },
    });

    if (existingContact) {
      return { success: false, error: 'A contact with this email already exists' };
    }

    const contact = await prisma.merchant_contacts.create({
      data: {
        merchantId: session.merchantId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        roles: data.roles || [],
        marketingOptIn: data.marketingOptIn ?? false,
        communicationOptIn: data.communicationOptIn ?? true,
        isAccountOwner: false,
      },
    });

    revalidatePath('/settings/contacts');

    return { success: true, contact };
  } catch (error) {
    loggers.settings.error('Failed to create contact', {}, error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to create contact' };
  }
}

export async function updateContact(contactId: string, data: Partial<ContactData>) {
  const session = await getSession();
  
  if (!session || session.type !== 'merchant') {
    return { success: false, error: 'Unauthorized' };
  }

  // Only OWNER and ADMIN can manage contacts
  if (session.role !== 'OWNER' && session.role !== 'ADMIN') {
    return { success: false, error: 'You do not have permission to manage contacts' };
  }

  try {
    // Verify the contact belongs to this merchant
    const existingContact = await prisma.merchant_contacts.findFirst({
      where: { id: contactId, merchantId: session.merchantId },
    });

    if (!existingContact) {
      return { success: false, error: 'Contact not found' };
    }

    // Check for email uniqueness if email is being changed
    if (data.email && data.email.toLowerCase() !== existingContact.email) {
      const duplicateEmail = await prisma.merchant_contacts.findUnique({
        where: {
          merchantId_email: {
            merchantId: session.merchantId,
            email: data.email.toLowerCase(),
          },
        },
      });

      if (duplicateEmail) {
        return { success: false, error: 'A contact with this email already exists' };
      }
    }

    const contact = await prisma.merchant_contacts.update({
      where: { id: contactId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email?.toLowerCase(),
        phone: data.phone,
        roles: data.roles,
        marketingOptIn: data.marketingOptIn,
        communicationOptIn: data.communicationOptIn,
      },
    });

    revalidatePath('/settings/contacts');

    return { success: true, contact };
  } catch (error) {
    loggers.settings.error('Failed to update contact', {}, error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to update contact' };
  }
}

export async function deleteContact(contactId: string) {
  const session = await getSession();
  
  if (!session || session.type !== 'merchant') {
    return { success: false, error: 'Unauthorized' };
  }

  // Only OWNER and ADMIN can manage contacts
  if (session.role !== 'OWNER' && session.role !== 'ADMIN') {
    return { success: false, error: 'You do not have permission to manage contacts' };
  }

  try {
    // Verify the contact belongs to this merchant
    const contact = await prisma.merchant_contacts.findFirst({
      where: { id: contactId, merchantId: session.merchantId },
    });

    if (!contact) {
      return { success: false, error: 'Contact not found' };
    }

    // Prevent deleting the account owner contact
    if (contact.isAccountOwner) {
      return { success: false, error: 'Cannot delete the account owner contact. Please transfer ownership first.' };
    }

    // Don't allow deleting the last active contact
    const activeContactCount = await prisma.merchant_contacts.count({
      where: { merchantId: session.merchantId, isActive: true },
    });

    if (activeContactCount <= 1) {
      return { success: false, error: 'Cannot delete the last contact. You must have at least one contact.' };
    }

    await prisma.merchant_contacts.delete({
      where: { id: contactId },
    });

    revalidatePath('/settings/contacts');

    return { success: true };
  } catch (error) {
    loggers.settings.error('Failed to delete contact', {}, error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to delete contact' };
  }
}

// =============================================================================
// Account Ownership Transfer
// =============================================================================

/**
 * Transfer account ownership from current owner to another contact
 * Merchant-facing action - only owner can transfer their own ownership
 */
export async function transferOwnership(newOwnerId: string) {
  const session = await getSession();
  
  if (!session || session.type !== 'merchant') {
    return { success: false, error: 'Unauthorized' };
  }

  // Only the current owner can transfer ownership
  if (session.role !== 'OWNER') {
    return { success: false, error: 'Only the account owner can transfer ownership' };
  }

  try {
    // Get the current owner contact and new owner contact
    const [currentOwner, newOwner] = await Promise.all([
      prisma.merchant_contacts.findFirst({
        where: { merchantId: session.merchantId, isAccountOwner: true },
      }),
      prisma.merchant_contacts.findFirst({
        where: { id: newOwnerId, merchantId: session.merchantId },
      }),
    ]);

    if (!currentOwner) {
      return { success: false, error: 'Current account owner not found' };
    }

    if (!newOwner) {
      return { success: false, error: 'New account owner contact not found' };
    }

    // Perform the transfer
    const [oldOwnerAfter, newOwnerAfter] = await Promise.all([
      prisma.merchant_contacts.update({
        where: { id: currentOwner.id },
        data: { isAccountOwner: false },
      }),
      prisma.merchant_contacts.update({
        where: { id: newOwnerId },
        data: { isAccountOwner: true },
      }),
    ]);

    revalidatePath('/settings/contacts');

    return {
      success: true,
      message: `Account ownership has been transferred to ${newOwner.firstName} ${newOwner.lastName}`,
      oldOwner: oldOwnerAfter,
      newOwner: newOwnerAfter,
    };
  } catch (error) {
    loggers.settings.error('Failed to transfer account ownership', {}, error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to transfer account ownership' };
  }
}
