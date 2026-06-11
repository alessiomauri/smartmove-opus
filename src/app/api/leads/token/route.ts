import { NextResponse } from 'next/server';
import { mintSubmitToken } from '@/lib/lead-protection';

/**
 * Mints the signed timestamp every lead form fetches on MOUNT. The
 * submit endpoint rejects payloads whose token is younger than 2s
 * (bots) or missing/forged. Must be a runtime fetch — the pages
 * themselves are ISR-cached, so anything embedded at render time
 * would be stale.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { token: mintSubmitToken() },
    { headers: { 'cache-control': 'no-store' } }
  );
}
