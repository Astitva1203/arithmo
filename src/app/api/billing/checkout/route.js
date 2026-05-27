import { NextResponse } from 'next/server';
import { getAuthUser, authErrorResponse, AuthError } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    await getAuthUser(request);

    return NextResponse.json({
      available: false,
      message: 'Online payments are currently disabled. Arithmo Pro will be available soon.',
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: 'Checkout is temporarily unavailable.' }, { status: 500 });
  }
}
