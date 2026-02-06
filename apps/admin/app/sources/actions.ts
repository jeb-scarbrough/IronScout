'use server';

import { prisma, Prisma } from '@ironscout/db';
import { revalidatePath } from 'next/cache';
import { getAdminSession, logAdminAction } from '@/lib/auth';
import { loggers } from '@/lib/logger';

// =============================================================================
// Types
// =============================================================================

export type SourceType = 'HTML' | 'JS_RENDERED' | 'RSS' | 'JSON' | 'FEED_CSV' | 'FEED_XML' | 'FEED_JSON';

export interface CreateSourceInput {
  name: string;
  url: string;
  type: SourceType;
  retailerId: string;
  enabled?: boolean;
  interval?: number;
  // Scraper config
  scrapeEnabled?: boolean;
  adapterId?: string;
  scrapeConfig?: Record<string, unknown>;
}

export interface UpdateSourceInput {
  name?: string;
  url?: string;
  type?: SourceType;
  retailerId?: string;
  enabled?: boolean;
  interval?: number;
  // Scraper config
  scrapeEnabled?: boolean;
  adapterId?: string;
  scrapeConfig?: Record<string, unknown>;
}

// =============================================================================
// CRUD Operations
// =============================================================================

export async function createSource(data: CreateSourceInput) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    // Validate retailer exists
    const retailer = await prisma.retailers.findUnique({
      where: { id: data.retailerId },
    });

    if (!retailer) {
      return { success: false, error: 'Retailer not found' };
    }

    // Create the source
    const source = await prisma.sources.create({
      data: {
        name: data.name,
        url: data.url,
        type: data.type,
        retailerId: data.retailerId,
        enabled: data.enabled ?? true,
        interval: data.interval ?? 3600,
        scrapeEnabled: data.scrapeEnabled ?? false,
        adapterId: data.adapterId || null,
        scrapeConfig: data.scrapeConfig as Prisma.InputJsonValue | undefined,
      },
    });

    await logAdminAction(session.userId, 'CREATE_SOURCE', {
      resource: 'Source',
      resourceId: source.id,
      newValue: {
        name: data.name,
        url: data.url,
        type: data.type,
        retailerId: data.retailerId,
      },
    });

    revalidatePath('/sources');

    return { success: true, source };
  } catch (error) {
    loggers.sources.error('Failed to create source', {}, error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to create source' };
  }
}

export async function updateSource(id: string, data: UpdateSourceInput) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const oldSource = await prisma.sources.findUnique({
      where: { id },
    });

    if (!oldSource) {
      return { success: false, error: 'Source not found' };
    }

    // If retailerId is changing, validate new retailer exists
    if (data.retailerId && data.retailerId !== oldSource.retailerId) {
      const retailer = await prisma.retailers.findUnique({
        where: { id: data.retailerId },
      });

      if (!retailer) {
        return { success: false, error: 'Retailer not found' };
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.url !== undefined) updateData.url = data.url;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.retailerId !== undefined) updateData.retailerId = data.retailerId;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.interval !== undefined) updateData.interval = data.interval;
    if (data.scrapeEnabled !== undefined) updateData.scrapeEnabled = data.scrapeEnabled;
    if (data.adapterId !== undefined) updateData.adapterId = data.adapterId || null;
    if (data.scrapeConfig !== undefined) updateData.scrapeConfig = data.scrapeConfig as Prisma.InputJsonValue | undefined;

    const source = await prisma.sources.update({
      where: { id },
      data: updateData,
    });

    await logAdminAction(session.userId, 'UPDATE_SOURCE', {
      resource: 'Source',
      resourceId: id,
      oldValue: {
        name: oldSource.name,
        url: oldSource.url,
        type: oldSource.type,
        enabled: oldSource.enabled,
      },
      newValue: {
        name: data.name,
        url: data.url,
        type: data.type,
        enabled: data.enabled,
      },
    });

    revalidatePath('/sources');
    revalidatePath(`/sources/${id}`);

    return { success: true, source };
  } catch (error) {
    loggers.sources.error('Failed to update source', { sourceId: id }, error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to update source' };
  }
}

export async function deleteSource(id: string) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const source = await prisma.sources.findUnique({
      where: { id },
      include: {
        affiliate_feeds: true,
        source_products: { take: 1 },
      },
    });

    if (!source) {
      return { success: false, error: 'Source not found' };
    }

    // Check for affiliate feeds
    if (source.affiliate_feeds.length > 0) {
      return { success: false, error: 'Cannot delete source with affiliate feeds. Delete the feed first.' };
    }

    // Check for source products
    if (source.source_products.length > 0) {
      return { success: false, error: 'Cannot delete source with associated products. Remove products first.' };
    }

    // Delete the source (cascade will handle executions)
    await prisma.sources.delete({
      where: { id },
    });

    await logAdminAction(session.userId, 'DELETE_SOURCE', {
      resource: 'Source',
      resourceId: id,
      oldValue: {
        name: source.name,
        url: source.url,
        type: source.type,
        retailerId: source.retailerId,
      },
    });

    revalidatePath('/sources');

    return { success: true };
  } catch (error) {
    loggers.sources.error('Failed to delete source', { sourceId: id }, error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to delete source' };
  }
}

export async function toggleSourceEnabled(id: string) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const source = await prisma.sources.findUnique({
      where: { id },
    });

    if (!source) {
      return { success: false, error: 'Source not found' };
    }

    const newEnabled = !source.enabled;

    await prisma.sources.update({
      where: { id },
      data: { enabled: newEnabled },
    });

    await logAdminAction(session.userId, 'TOGGLE_SOURCE_ENABLED', {
      resource: 'Source',
      resourceId: id,
      oldValue: { enabled: source.enabled },
      newValue: { enabled: newEnabled },
    });

    revalidatePath('/sources');
    revalidatePath(`/sources/${id}`);

    return { success: true, enabled: newEnabled };
  } catch (error) {
    loggers.sources.error('Failed to toggle source', { sourceId: id }, error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to toggle source' };
  }
}

export async function toggleScrapeEnabled(id: string) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const source = await prisma.sources.findUnique({
      where: { id },
    });

    if (!source) {
      return { success: false, error: 'Source not found' };
    }

    const newScrapeEnabled = !source.scrapeEnabled;

    await prisma.sources.update({
      where: { id },
      data: { scrapeEnabled: newScrapeEnabled },
    });

    await logAdminAction(session.userId, 'TOGGLE_SCRAPE_ENABLED', {
      resource: 'Source',
      resourceId: id,
      oldValue: { scrapeEnabled: source.scrapeEnabled },
      newValue: { scrapeEnabled: newScrapeEnabled },
    });

    revalidatePath('/sources');
    revalidatePath(`/sources/${id}`);

    return { success: true, scrapeEnabled: newScrapeEnabled };
  } catch (error) {
    loggers.sources.error('Failed to toggle scrape enabled', { sourceId: id }, error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to toggle scrape enabled' };
  }
}

// =============================================================================
// Read Operations
// =============================================================================

export async function getRetailersForSelect() {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized', retailers: [] };
  }

  try {
    const retailers = await prisma.retailers.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        website: true,
      },
    });

    return { success: true, retailers };
  } catch (error) {
    loggers.sources.error('Failed to get retailers', {}, error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to get retailers', retailers: [] };
  }
}

export async function getSource(id: string) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized', source: null };
  }

  try {
    const source = await prisma.sources.findUnique({
      where: { id },
      include: {
        retailers: true,
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!source) {
      return { success: false, error: 'Source not found', source: null };
    }

    return { success: true, source };
  } catch (error) {
    loggers.sources.error('Failed to get source', { sourceId: id }, error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to get source', source: null };
  }
}
