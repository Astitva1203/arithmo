import { NextResponse } from 'next/server';
import { getAuthUser, authErrorResponse, AuthError } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { AccessError, accessErrorPayload, incrementUsageOrThrow, logRateLimitHit } from '@/lib/billing';
import { runWebSearch } from '@/services/search/webSearch';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const auth = await getAuthUser(request);

    const body = await request.json().catch(() => ({}));
    const query = String(body?.query || '').trim();
    if (!query) {
      return NextResponse.json({ error: 'Query is required.' }, { status: 400 });
    }
    if (query.length > 50000) {
      return NextResponse.json({ error: 'Query is too long. Please keep it under 50000 characters.' }, { status: 400 });
    }

    const db = await getDb();
    try {
      await incrementUsageOrThrow(db, {
        user: auth.mongoUser,
        userId: auth.userId,
        units: { search: 1 },
      });
    } catch (error) {
      if (error instanceof AccessError) {
        await logRateLimitHit(db, {
          userId: auth.userId,
          email: auth.email,
          feature: error.feature,
          message: error.message,
        });
        return NextResponse.json(accessErrorPayload(error), { status: error.status });
      }
      throw error;
    }

    const result = await runWebSearch({ query, limit: 5, timeoutMs: 10_000 });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json(
      { error: error?.message || 'Search request failed.' },
      { status: 500 }
    );
  }
}
