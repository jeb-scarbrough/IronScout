import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@ironscout/db';
import { z } from 'zod';

const feedSchema = z.object({
  id: z.string().optional(),
  feedType: z.enum(['URL', 'AUTH_URL', 'FTP', 'SFTP', 'UPLOAD']),
  url: z.string().url().optional().nullable(),
  username: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  scheduleMinutes: z.number().min(60).max(1440),
});

export async function GET() {
  try {
    const session = await getSession();
    
    if (!session || session.type !== 'dealer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const feed = await prisma.dealerFeed.findFirst({
      where: { dealerId: session.dealerId },
    });

    return NextResponse.json({ feed });
  } catch (error) {
    console.error('Get feed error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    
    if (!session || session.type !== 'dealer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = feedSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { feedType, url, username, password, scheduleMinutes } = validation.data;

    // Check if dealer already has a feed
    const existingFeed = await prisma.dealerFeed.findFirst({
      where: { dealerId: session.dealerId },
    });

    if (existingFeed) {
      return NextResponse.json(
        { error: 'Feed already exists. Use PUT to update.' },
        { status: 400 }
      );
    }

    // Create feed
    const feed = await prisma.dealerFeed.create({
      data: {
        dealerId: session.dealerId,
        feedType,
        url: url || null,
        username: username || null,
        password: password || null, // TODO: Encrypt at app layer
        scheduleMinutes,
        status: 'PENDING',
      },
    });

    return NextResponse.json({ success: true, feed });
  } catch (error) {
    console.error('Create feed error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    
    if (!session || session.type !== 'dealer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = feedSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { id, feedType, url, username, password, scheduleMinutes } = validation.data;

    if (!id) {
      return NextResponse.json(
        { error: 'Feed ID required for update' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingFeed = await prisma.dealerFeed.findFirst({
      where: { id, dealerId: session.dealerId },
    });

    if (!existingFeed) {
      return NextResponse.json(
        { error: 'Feed not found' },
        { status: 404 }
      );
    }

    // Update feed
    const feed = await prisma.dealerFeed.update({
      where: { id },
      data: {
        feedType,
        url: url || null,
        username: username || null,
        // Only update password if provided (non-empty)
        ...(password ? { password } : {}),
        scheduleMinutes,
      },
    });

    return NextResponse.json({ success: true, feed });
  } catch (error) {
    console.error('Update feed error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
