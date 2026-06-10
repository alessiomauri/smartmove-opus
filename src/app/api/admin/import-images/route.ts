import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { validateExternalUrl } from '@/lib/server/url-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const BUCKET_NAME = 'property-images';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

async function downloadAndUpload(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/*',
        'Referer': new URL(imageUrl).origin,
      },
      redirect: 'follow',
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < 5000) return null; // Skip tiny images (likely icons/placeholders)
    if (buffer.byteLength > 15 * 1024 * 1024) return null; // Skip >15MB

    // Determine extension from content type
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/avif': 'avif',
    };
    const ext = extMap[contentType] || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = `uploads/${fileName}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, new Uint8Array(buffer), {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Upload error for', imageUrl, error.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Failed to download/upload', imageUrl, error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Admin-only. The middleware matcher skips /api, so this route must
    // gate itself — otherwise anyone can make the server download
    // arbitrary URLs and write them into the storage bucket.
    const authClient = await createServerSupabaseClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { urls } = await request.json();

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'urls array is required' }, { status: 400 });
    }

    // Cap at 50 images; drop anything that isn't a safe public http(s) URL.
    const imageUrls = urls
      .slice(0, 50)
      .filter((u: unknown): u is string => typeof u === 'string' && validateExternalUrl(u) === null);

    // Process in batches of 5 for concurrency control
    const batchSize = 5;
    const uploadedUrls: string[] = [];

    for (let i = 0; i < imageUrls.length; i += batchSize) {
      const batch = imageUrls.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(downloadAndUpload));
      for (const result of results) {
        if (result) uploadedUrls.push(result);
      }
    }

    return NextResponse.json({
      uploaded: uploadedUrls,
      total: imageUrls.length,
      success: uploadedUrls.length,
      failed: imageUrls.length - uploadedUrls.length,
    });
  } catch (error) {
    console.error('Import images error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import images' },
      { status: 500 }
    );
  }
}
