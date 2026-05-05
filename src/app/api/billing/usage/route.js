import { NextResponse } from 'next/server';
import { getAuthUser, authErrorResponse, AuthError } from '@/lib/auth';
import {
  buildUsagePayload,
  getDailyUsage,
} from '@/lib/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    const usage = await getDailyUsage(null, auth.mongoUser);

    return NextResponse.json(buildUsagePayload(auth.mongoUser, usage));
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Billing usage error:', error);
    return NextResponse.json({ error: 'Failed to load usage.' }, { status: 500 });
  }
}
