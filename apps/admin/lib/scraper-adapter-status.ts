import { prisma } from '@ironscout/db';
import { KNOWN_ADAPTERS } from '@ironscout/scraper-registry';

function isKnownAdapterId(adapterId: string): boolean {
  return KNOWN_ADAPTERS.some((adapter) => adapter.id === adapterId);
}

export function normalizeAdapterId(adapterId: string | null | undefined): string | null {
  if (adapterId == null) return null;
  const normalized = adapterId.trim();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Ensures the adapter ID can be safely referenced by sources.adapterId.
 * For known adapters, seed scrape_adapter_status on demand to avoid FK failures.
 * For unknown adapters, only allow values already registered in scrape_adapter_status.
 */
export async function resolveSourceAdapterId(
  adapterId: string | null | undefined,
): Promise<{ adapterId: string | null; error?: string }> {
  const normalizedAdapterId = normalizeAdapterId(adapterId);
  if (!normalizedAdapterId) {
    return { adapterId: null };
  }

  if (isKnownAdapterId(normalizedAdapterId)) {
    const now = new Date();
    await prisma.scrape_adapter_status.upsert({
      where: { adapterId: normalizedAdapterId },
      create: {
        adapterId: normalizedAdapterId,
        enabled: false,
        disabledAt: now,
        disabledReason: 'MANUAL',
      },
      update: {},
    });

    return { adapterId: normalizedAdapterId };
  }

  const existing = await prisma.scrape_adapter_status.findUnique({
    where: { adapterId: normalizedAdapterId },
    select: { adapterId: true },
  });

  if (!existing) {
    return {
      adapterId: null,
      error: `Invalid adapter: ${normalizedAdapterId}`,
    };
  }

  return { adapterId: normalizedAdapterId };
}
