import { NextResponse } from 'next/server';
import { getAuthUser, authErrorResponse, AuthError } from '@/lib/auth';
import {
  buildUsagePayload,
  getDailyUsage,
  serializeUserPlan,
} from '@/lib/billing';
import { normalizeSettings } from '@/lib/userDefaults';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function serializeUser(user, usage) {
  return {
    id: user._id.toString(),
    firebaseUid: user.firebaseUid,
    email: user.email,
    name: user.name || user.email?.split('@')[0] || 'User',
    avatar: user.avatar || null,
    settings: normalizeSettings(user.settings || {}),
    ...serializeUserPlan(user),
    usage: buildUsagePayload(user, usage),
  };
}

export async function POST(request) {
  try {
    const auth = await getAuthUser(request);
    const body = await request.json().catch(() => ({}));
    const { name, avatar, settings } = body || {};
    const updateData = {};

    if (typeof name === 'string' && name.trim()) {
      updateData.name = name.trim().slice(0, 80);
    }
    if (avatar !== undefined) {
      const avatarText = typeof avatar === 'string' ? avatar : null;
      if (avatarText && avatarText.length > 1_000_000) {
        return NextResponse.json({ error: 'Avatar image is too large.' }, { status: 400 });
      }
      updateData.avatar = avatarText;
    }
    if (settings && typeof settings === 'object') {
      updateData.settings = normalizeSettings({
        ...auth.mongoUser.settings,
        defaultChatMode: settings.defaultChatMode,
        responseMode: settings.responseMode,
      });
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No data to update.' }, { status: 400 });
    }

    const { getDb } = await import('@/lib/mongodb');
    const { ObjectId } = await import('mongodb');
    const db = await getDb();
    const result = await db.collection('users').findOneAndUpdate(
      { _id: ObjectId.createFromHexString(auth.userId) },
      { $set: { ...updateData, updatedAt: new Date() } },
      { returnDocument: 'after', projection: { password: 0 } }
    );

    const updatedUser = result?.value || result || { ...auth.mongoUser, ...updateData };
    const usage = await getDailyUsage(null, updatedUser);

    return NextResponse.json({
      user: serializeUser(updatedUser, usage),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Settings error:', error);
    return NextResponse.json({ error: 'Failed to update settings.' }, { status: 500 });
  }
}
