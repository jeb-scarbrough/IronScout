import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@ironscout/db';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

// Create Redis connection for BullMQ
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Create queue reference (connects to same queue as harvester)
const dealerFeedIngestQueue = new Queue('dealer-feed-ingest', {
  connection: redisConnection,
});

/**
 * Trigger a manual feed refresh
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    
    if (!session || session.type !== 'dealer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { feedId } = await request.json();

    if (!feedId) {
      return NextResponse.json(
        { error: 'Feed ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const feed = await prisma.dealerFeed.findFirst({
      where: { id: feedId, dealerId: session.dealerId },
    });

    if (!feed) {
      return NextResponse.json(
        { error: 'Feed not found' },
        { status: 404 }
      );
    }

    // Check dealer status
    const dealer = await prisma.dealer.findUnique({
      where: { id: session.dealerId },
    });

    if (!dealer || dealer.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Your account must be active to refresh feeds' },
        { status: 403 }
      );
    }

    // Check for rate limiting (max 1 manual refresh per 5 minutes)
    const recentRun = await prisma.dealerFeedRun.findFirst({
      where: {
        feedId,
        startedAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
        },
      },
    });

    if (recentRun) {
      return NextResponse.json(
        { error: 'Please wait 5 minutes between manual refreshes' },
        { status: 429 }
      );
    }

    // Create a feed run record
    const run = await prisma.dealerFeedRun.create({
      data: {
        dealerId: session.dealerId,
        feedId,
        status: 'RUNNING',
      },
    });

    // Queue the feed ingestion job
    await dealerFeedIngestQueue.add(
      'ingest-manual',
      {
        dealerId: session.dealerId,
        feedId: feed.id,
        feedRunId: run.id,
        feedType: feed.feedType,
        url: feed.url || undefined,
        username: feed.username || undefined,
        password: feed.password || undefined,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
        priority: 1, // High priority for manual triggers
      }
    );

    return NextResponse.json({
      success: true,
      runId: run.id,
      message: 'Feed refresh started',
    });
  } catch (error) {
    console.error('Refresh feed error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
