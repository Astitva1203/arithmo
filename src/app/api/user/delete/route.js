import { NextResponse } from 'next/server';
import { getAuthUser, authErrorResponse, AuthError } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { getFirebaseAdminAuth } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request) {
  try {
    const auth = await getAuthUser(request);
    const adminAuth = getFirebaseAdminAuth();

    await adminAuth.deleteUser(auth.firebaseUid);

    const db = await getDb();
    if (db) {
      const { ObjectId } = await import('mongodb');
      const userObjectId = ObjectId.createFromHexString(auth.userId);

      const chats = await db.collection('chats')
        .find({ userId: auth.userId })
        .project({ _id: 1 })
        .toArray();
      const chatIds = chats.map((chat) => chat._id.toString());

      await db.collection('users').deleteOne({ _id: userObjectId });
      await db.collection('chats').deleteMany({ userId: auth.userId });

      if (chatIds.length > 0) {
        await db.collection('messages').deleteMany({ chatId: { $in: chatIds } });
      }

      await db.collection('usageEvents').deleteMany({ userId: auth.userId });
      await db.collection('securityLogs').deleteMany({ userId: auth.userId });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Delete account error:', error);
    return NextResponse.json({ error: 'Failed to delete account.' }, { status: 500 });
  }
}
