import { NextResponse } from 'next/server';
import { getSession, requireRetailerContext, RetailerContextError } from '@/lib/auth';
import { prisma } from '@ironscout/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { createHash } from 'crypto';

// Force dynamic rendering - this route uses cookies for auth
export const dynamic = 'force-dynamic';

const batchSchema = z.object({
  recordIds: z.array(z.string()).min(1).max(100),
  retailerId: z.string().optional(), // Optional: for multi-retailer merchants
});

/**
 * POST /api/feed/quarantine/batch-reprocess
 * Attempt to reprocess multiple quarantined records with corrections applied
 */
export async function POST(request: Request) {
  const reqLogger = logger.child({ endpoint: '/api/feed/quarantine/batch-reprocess', method: 'POST' });

  try {
    const session = await getSession();

    if (!session || session.type !== 'merchant') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const validation = batchSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid record IDs' }, { status: 400 });
    }

    const { recordIds, retailerId: inputRetailerId } = validation.data;

    // Resolve retailer context (supports multi-retailer merchants)
    const retailerContext = await requireRetailerContext(session, inputRetailerId);
    const { retailerId } = retailerContext;

    // Get all records with their corrections
    const records = await prisma.quarantined_records.findMany({
      where: {
        id: { in: recordIds },
        retailerId,
        status: 'QUARANTINED',
      },
      include: {
        feed_corrections: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const results: Array<{
      recordId: string;
      success: boolean;
      error?: string;
      retailerSkuId?: string;
    }> = [];

    for (const record of records) {
      try {
        // Get parsed fields
        const parsedFields = record.parsedFields as Record<string, unknown> | null;
        if (!parsedFields) {
          results.push({
            recordId: record.id,
            success: false,
            error: 'No parsed fields',
          });
          continue;
        }

        // Apply corrections
        const correctedFields: Record<string, unknown> = { ...parsedFields };
        for (const correction of record.feed_corrections) {
          correctedFields[correction.field] = correction.newValue;
        }

        // Validate UPC
        const upc = correctedFields.upc as string | undefined;
        if (!upc || !isValidUPC(upc)) {
          results.push({
            recordId: record.id,
            success: false,
            error: 'Missing valid UPC',
          });
          continue;
        }

        // Validate required fields
        const title = correctedFields.title as string | undefined;
        const price = correctedFields.price as number | undefined;

        if (!title || !price || price <= 0) {
          results.push({
            recordId: record.id,
            success: false,
            error: 'Missing required fields',
          });
          continue;
        }

        // Generate identity hash (stable across price changes)
        const skuHash = generateSkuHash(
          title,
          upc,
          correctedFields.sku as string | undefined
        );

        // Generate content hash for change tracking
        const contentHash = generateContentHash({
          price,
          inStock: correctedFields.inStock as boolean | undefined,
          brand: correctedFields.brand as string | undefined,
          caliber: correctedFields.caliber as string | undefined,
        });

        const retailerSku = await prisma.retailer_skus.upsert({
          where: {
            retailerId_retailerSkuHash: {
              retailerId,
              retailerSkuHash: skuHash,
            },
          },
          create: {
            retailerId,
            feedId: record.feedId,
            retailerSkuHash: skuHash,
            contentHash,
            rawTitle: title,
            rawPrice: price,
            rawUpc: upc,
            rawSku: correctedFields.sku as string | undefined,
            rawBrand: correctedFields.brand as string | undefined,
            rawCaliber: correctedFields.caliber as string | undefined,
            rawInStock: (correctedFields.inStock as boolean) ?? true,
            isActive: true,
            lastSeenAt: new Date(),
          },
          update: {
            contentHash,
            rawPrice: price,
            rawInStock: (correctedFields.inStock as boolean) ?? true,
            isActive: true,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Mark quarantine record as resolved
        await prisma.quarantined_records.update({
          where: { id: record.id },
          data: { status: 'RESOLVED' },
        });

        results.push({
          recordId: record.id,
          success: true,
          retailerSkuId: retailerSku.id,
        });
      } catch (error) {
        results.push({
          recordId: record.id,
          success: false,
          error: String(error),
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    reqLogger.info('Batch reprocess completed', {
      requested: recordIds.length,
      found: records.length,
      success: successCount,
      failed: failureCount,
    });

    return NextResponse.json({
      success: true,
      total: recordIds.length,
      processed: records.length,
      succeeded: successCount,
      failed: failureCount,
      results,
      retailerContext,
    });
  } catch (error) {
    if (error instanceof RetailerContextError) {
      reqLogger.warn('Retailer context error', { code: error.code, message: error.message });
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    reqLogger.error('Batch reprocess failed', {}, error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

function isValidUPC(upc: string): boolean {
  const cleaned = upc.replace(/[^0-9]/g, '');
  return cleaned.length >= 8 && cleaned.length <= 14;
}

/**
 * Generate a stable identity hash for a SKU.
 * This hash identifies the LISTING, not its current state.
 * Price changes should NOT create new SKU records.
 */
function generateSkuHash(
  title: string,
  upc?: string,
  sku?: string
): string {
  const components = [
    title.toLowerCase().trim(),
    upc || '',
    sku || '',
    // NOTE: price intentionally excluded - price is state, not identity
  ];

  const hash = createHash('sha256')
    .update(components.join('|'))
    .digest('hex');

  return hash.substring(0, 32);
}

/**
 * Generate a content hash for change detection.
 */
function generateContentHash(record: {
  price?: number
  inStock?: boolean
  brand?: string
  caliber?: string
}): string {
  const components = [
    record.price != null ? String(record.price) : '',
    record.inStock != null ? String(record.inStock) : '',
    record.brand || '',
    record.caliber || '',
  ];

  const hash = createHash('sha256')
    .update(components.join('|'))
    .digest('hex');

  return hash.substring(0, 32);
}
