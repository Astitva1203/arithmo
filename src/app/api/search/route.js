import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { runWebSearch } from '@/services/search/webSearch';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const query = String(body?.query || '').trim();
    if (!query) {
      return NextResponse.json({ error: 'Query is required.' }, { status: 400 });
    }

    const result = await runWebSearch({ query, limit: 5, timeoutMs: 10_000 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || 'Search request failed.' },
      { status: 500 }
    );
  }
}

