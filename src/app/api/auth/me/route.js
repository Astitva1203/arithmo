import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAuthUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    const db = await getDb();
    if (!db) {
      // Token is valid but DB is unavailable.
      return NextResponse.json({
        authenticated: true,
        user: {
          id: auth.userId,
          email: 'user@arithmo.ai',
          name: 'User',
        },
      });
    }

    const { ObjectId } = await import('mongodb');
    let user = null;

    try {
      user = await db.collection('users').findOne(
        { _id: ObjectId.createFromHexString(auth.userId) },
        { projection: { password: 0 } }
      );
    } catch {
      // Invalid ObjectId format.
    }

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name || user.email.split('@')[0],
      },
    });
  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json({ error: 'Authentication check failed.' }, { status: 500 });
  }
}
