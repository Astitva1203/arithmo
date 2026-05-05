import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json(
    {
      error: 'Firebase Authentication now handles login on the client.',
      code: 'AUTH_MIGRATED_TO_FIREBASE',
    },
    { status: 410 }
  );
}
