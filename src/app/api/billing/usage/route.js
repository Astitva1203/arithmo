import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import {
  buildUsagePayload,
  ensureLifetimeAccess,
  getDailyUsage,
} from '@/lib/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { ObjectId } = await import('mongodb');
    const user = await db.collection('users').findOne(
      { _id: ObjectId.createFromHexString(auth.userId) },
      { projection: { password: 0 } }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updatedUser = await ensureLifetimeAccess(db, user);
    const usage = await getDailyUsage(db, updatedUser._id.toString());

    return NextResponse.json(buildUsagePayload(updatedUser, usage));
  } catch (error) {
    console.error('Billing usage error:', error);
    return NextResponse.json({ error: 'Failed to load usage.' }, { status: 500 });
  }
}
