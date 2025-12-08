import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/**
 * Test feed connection
 * This is a simplified test - in production, you'd actually fetch and parse the feed
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    
    if (!session || session.type !== 'dealer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { feedType, url, username, password } = await request.json();

    if (!url && feedType !== 'UPLOAD') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // For manual upload, just return success
    if (feedType === 'UPLOAD') {
      return NextResponse.json({ success: true, rowCount: 0, message: 'Manual upload ready' });
    }

    // Test the URL is reachable
    try {
      const headers: Record<string, string> = {};
      
      // Add basic auth if needed
      if (feedType === 'AUTH_URL' && username && password) {
        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return NextResponse.json(
          { error: `Server returned ${response.status}: ${response.statusText}` },
          { status: 400 }
        );
      }

      // Get content type to validate it's a feed
      const contentType = response.headers.get('content-type') || '';
      const validTypes = ['text/csv', 'application/json', 'text/xml', 'application/xml', 'text/plain'];
      const isValidType = validTypes.some(t => contentType.includes(t));

      if (!isValidType) {
        return NextResponse.json(
          { error: `Unexpected content type: ${contentType}. Expected CSV, JSON, or XML.` },
          { status: 400 }
        );
      }

      // Try to get a rough row count (for CSV, count lines)
      const text = await response.text();
      let rowCount = 0;

      if (contentType.includes('csv') || contentType.includes('text/plain')) {
        // Count non-empty lines (minus header)
        rowCount = text.split('\n').filter(line => line.trim()).length - 1;
      } else if (contentType.includes('json')) {
        try {
          const json = JSON.parse(text);
          rowCount = Array.isArray(json) ? json.length : (json.products?.length || json.items?.length || 0);
        } catch {
          return NextResponse.json(
            { error: 'Invalid JSON format' },
            { status: 400 }
          );
        }
      } else if (contentType.includes('xml')) {
        // Simple XML product count
        const productMatches = text.match(/<product|<item|<entry/gi);
        rowCount = productMatches?.length || 0;
      }

      return NextResponse.json({
        success: true,
        rowCount: Math.max(0, rowCount),
        contentType,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Connection timed out after 10 seconds' },
          { status: 400 }
        );
      }
      
      const message = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        { error: `Connection failed: ${message}` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Test feed error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
