import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAuthUser, authErrorResponse, AuthError } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    const auth = await getAuthUser(request);

    const { id } = await params;

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ chat: { id, title: 'Chat' }, messages: [] });
    }

    const { ObjectId } = await import('mongodb');
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ chat: { id, title: 'Chat' }, messages: [] });
    }

    const chat = await db.collection('chats').findOne({
      _id: ObjectId.createFromHexString(id),
      userId: auth.userId,
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found.' }, { status: 404 });
    }

    const messages = await db.collection('messages')
      .find({ chatId: id })
      .sort({ timestamp: 1 })
      .limit(200)
      .toArray();

    return NextResponse.json({
      chat: {
        id: chat._id.toString(),
        title: chat.title,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      },
      messages: messages.map((m) => ({
        id: m._id.toString(),
        role: m.role,
        content: m.content,
        requestId: m.requestId || '',
        imageDataUrl: m.imageDataUrl || '',
        imageUrl: m.imageUrl || '',
        timestamp: m.timestamp,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Get chat error:', error);
    return NextResponse.json({ error: 'Failed to load chat.' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const auth = await getAuthUser(request);

    const { id } = await params;
    const body = await request.json().catch(() => null);
    const title = String(body?.title || '').trim().slice(0, 100);
    if (!title) {
      return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ success: true, title });
    }

    const { ObjectId } = await import('mongodb');
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: true, title });
    }

    const result = await db.collection('chats').updateOne(
      { _id: ObjectId.createFromHexString(id), userId: auth.userId },
      { $set: { title, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Chat not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, title });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Rename chat error:', error);
    return NextResponse.json({ error: 'Failed to rename chat.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const auth = await getAuthUser(request);

    const { id } = await params;

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ success: true });
    }

    const { ObjectId } = await import('mongodb');
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: true });
    }

    await db.collection('chats').deleteOne({
      _id: ObjectId.createFromHexString(id),
      userId: auth.userId,
    });

    await db.collection('messages').deleteMany({ chatId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Delete chat error:', error);
    return NextResponse.json({ error: 'Failed to delete chat.' }, { status: 500 });
  }
}
