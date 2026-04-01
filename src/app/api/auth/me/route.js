import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAuthUser } from '@/lib/auth';

export async function GET(request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const db = await getDb();
    if (!db) {
      // DB unavailable but token is valid — return user from token
      return NextResponse.json({
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
      // ObjectId parse error — invalid ID format
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({
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
