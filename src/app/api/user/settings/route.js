import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAuthUser } from '@/lib/auth';

export async function POST(request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const body = await request.json();
    const { name, avatar } = body;

    const { ObjectId } = await import('mongodb');
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (avatar !== undefined) updateData.avatar = avatar;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No data to update' }, { status: 400 });
    }

    const result = await db.collection('users').findOneAndUpdate(
      { _id: ObjectId.createFromHexString(auth.userId) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: result._id.toString(),
        email: result.email,
        name: result.name || result.email.split('@')[0],
        avatar: result.avatar || null,
      }
    });
  } catch (error) {
    console.error('Settings error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
