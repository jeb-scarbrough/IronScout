'use server';

import { prisma, Prisma } from '@ironscout/db';
import { revalidatePath } from 'next/cache';
import { getAdminSession, logAdminAction } from '@/lib/auth';
import { loggers } from '@/lib/logger';

// =============================================================================
// Types
// =============================================================================

export type SourceType = 'HTML' | 'JS_RENDERED' | 'RSS' | 'JSON' | 'FEED_CSV' | 'FEED_XML' | 'FEED_JSON';

type DetectConfidence = 'high' | 'medium' | 'low';

interface DetectSourceTypeResult {
  success: boolean;
  type?: SourceType;
  confidence?: DetectConfidence;
  method?: 'head' | 'get' | 'heuristic';
  contentType?: string | null;
  error?: string;
}

const BLOCKED_HOSTS = new Set([
  '169.254.169.254', // AWS/GCP/Azure metadata
  'metadata.google.internal', // GCP metadata
  'metadata.goog', // GCP metadata
  '169.254.170.2', // AWS ECS task metadata
  'fd00:ec2::254', // AWS IMDSv2 IPv6
]);

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
  if (normalized.startsWith('fe80:')) return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('::ffff:')) {
    const ipv4Part = normalized.slice(7);
    return isPrivateIP(ipv4Part);
  }
  return false;
}

function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return isPrivateIPv6(ip);
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;
  return false;
}

async function resolveHostname(hostname: string): Promise<{ ips: string[]; error?: string }> {
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return { ips: [hostname] };
  }
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    const ipv6 = hostname.slice(1, -1);
    return { ips: [ipv6] };
  }

  try {
    const dns = await import('dns').then((m) => m.promises);
    const allAddresses: string[] = [];

    try {
      const ipv4Addresses = await dns.resolve4(hostname);
      allAddresses.push(...ipv4Addresses);
    } catch {
      // continue
    }

    try {
      const ipv6Addresses = await dns.resolve6(hostname);
      allAddresses.push(...ipv6Addresses);
    } catch {
      // continue
    }

    if (allAddresses.length === 0) {
      return { ips: [], error: 'No A or AAAA records found for hostname' };
    }

    return { ips: allAddresses };
  } catch (error) {
    return { ips: [], error: `DNS resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

async function validateUrlForSSRF(urlString: string): Promise<{ safe: boolean; error?: string; normalizedUrl?: string }> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { safe: false, error: 'Invalid URL format' };
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return { safe: false, error: 'URL must use http or https protocol' };
  }

  if (url.username || url.password) {
    return { safe: false, error: 'URL credentials are not allowed' };
  }

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(hostname)) {
    return { safe: false, error: 'Access to this host is not allowed' };
  }
  if (
    hostname === 'localhost' ||
    hostname === 'localhost.localdomain' ||
    hostname.endsWith('.localhost')
  ) {
    return { safe: false, error: 'Localhost access not allowed' };
  }

  const { ips, error: dnsError } = await resolveHostname(hostname);
  if (dnsError) return { safe: false, error: dnsError };
  if (ips.length === 0) return { safe: false, error: 'Hostname does not resolve to any IP address' };

  for (const ip of ips) {
    if (isPrivateIP(ip)) {
      return { safe: false, error: 'Access to private/internal networks not allowed' };
    }
    if (BLOCKED_HOSTS.has(ip)) {
      return { safe: false, error: 'Access to this host is not allowed' };
    }
  }

  return { safe: true, normalizedUrl: url.toString() };
}

function classifyFromContentType(contentType: string | null, url: URL): { type: SourceType | null; confidence: DetectConfidence } {
  if (!contentType) return { type: null, confidence: 'low' };
  const normalized = contentType.toLowerCase();

  if (normalized.includes('text/csv') || normalized.includes('application/csv') || normalized.includes('application/vnd.ms-excel')) {
    return { type: 'FEED_CSV', confidence: 'high' };
  }

  if (normalized.includes('application/rss+xml') || normalized.includes('application/atom+xml')) {
    return { type: 'RSS', confidence: 'high' };
  }

  if (normalized.includes('application/xml') || normalized.includes('text/xml')) {
    return { type: 'FEED_XML', confidence: 'high' };
  }

  if (normalized.includes('application/json') || normalized.includes('+json')) {
    const urlStr = url.toString().toLowerCase();
    const looksLikeFeed = ['feed', 'catalog', 'inventory', 'products'].some((token) => urlStr.includes(token));
    return { type: looksLikeFeed ? 'FEED_JSON' : 'JSON', confidence: looksLikeFeed ? 'high' : 'medium' };
  }

  if (normalized.includes('text/html')) {
    return { type: 'HTML', confidence: 'high' };
  }

  return { type: null, confidence: 'low' };
}

function classifyFromUrl(url: URL): SourceType {
  const path = url.pathname.toLowerCase();
  if (path.endsWith('.csv')) return 'FEED_CSV';
  if (path.endsWith('.rss') || path.endsWith('.atom')) return 'RSS';
  if (path.endsWith('.xml')) return 'FEED_XML';
  if (path.endsWith('.json')) return 'FEED_JSON';
  if (path.includes('/api/')) return 'JSON';
  return 'HTML';
}

async function fetchContentType(url: string, method: 'HEAD' | 'GET'): Promise<{ status: number; contentType: string | null }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: method === 'GET'
        ? { 'Range': 'bytes=0-2048', 'Accept': '*/*' }
        : undefined,
    });
    const contentType = response.headers.get('content-type');
    response.body?.cancel();
    return { status: response.status, contentType };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function detectSourceType(url: string): Promise<DetectSourceTypeResult> {
  const session = await getAdminSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!url?.trim()) {
    return { success: false, error: 'URL is required' };
  }

  const ssrfResult = await validateUrlForSSRF(url);
  if (!ssrfResult.safe) {
    return { success: false, error: ssrfResult.error || 'URL validation failed' };
  }

  const safeUrl = ssrfResult.normalizedUrl || url;
  const parsedUrl = new URL(safeUrl);

  try {
    const headResult = await fetchContentType(safeUrl, 'HEAD');
    if (headResult.status >= 200 && headResult.status < 400) {
      const classified = classifyFromContentType(headResult.contentType, parsedUrl);
      if (classified.type) {
        return {
          success: true,
          type: classified.type,
          confidence: classified.confidence,
          method: 'head',
          contentType: headResult.contentType,
        };
      }
    }
  } catch (error) {
    loggers.sources.warn('HEAD request failed during type detection', { url: safeUrl, error: String(error) });
  }

  try {
    const getResult = await fetchContentType(safeUrl, 'GET');
    if (getResult.status >= 200 && getResult.status < 400) {
      const classified = classifyFromContentType(getResult.contentType, parsedUrl);
      if (classified.type) {
        return {
          success: true,
          type: classified.type,
          confidence: classified.confidence,
          method: 'get',
          contentType: getResult.contentType,
        };
      }
    }
  } catch (error) {
    loggers.sources.warn('GET request failed during type detection', { url: safeUrl, error: String(error) });
  }

  return {
    success: true,
    type: classifyFromUrl(parsedUrl),
    confidence: 'low',
    method: 'heuristic',
    contentType: null,
  };
}

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
