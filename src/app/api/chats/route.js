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
      return NextResponse.json({ chats: [] });
    }

    const chats = await db.collection('chats')
      .find({ userId: auth.userId })
      .sort({ updatedAt: -1 })
      .project({ messages: 0 })
      .limit(100)
      .toArray();

    return NextResponse.json({
      chats: chats.map((c) => ({
        id: c._id.toString(),
        title: c.title || 'New Chat',
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (error) {
    console.error('List chats error:', error);
    return NextResponse.json({ error: 'Failed to load chats.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const title = String(body.title || 'New Chat').trim().slice(0, 100);

    const db = await getDb();
    if (!db) {
      // No DB — return a fake local chat ID
      const fakeId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const now = new Date();
      return NextResponse.json({
        chat: { id: fakeId, title, createdAt: now, updatedAt: now },
      });
    }

    const now = new Date();
    const result = await db.collection('chats').insertOne({
      userId: auth.userId,
      title,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      chat: {
        id: result.insertedId.toString(),
        title,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (error) {
    console.error('Create chat error:', error);
    return NextResponse.json({ error: 'Failed to create chat.' }, { status: 500 });
  }
}
