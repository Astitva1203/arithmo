import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAuthUser } from '@/lib/auth';
import {
  buildUsagePayload,
  ensureLifetimeAccess,
  getDailyUsage,
  serializeUserPlan,
} from '@/lib/billing';

const DEFAULT_SETTINGS = {
  defaultChatMode: 'chat',
  responseMode: 'deep',
  theme: 'dark',
  showChatTimestamps: true,
  sidebarCollapsed: false,
  notificationsEnabled: true,
  compactMessages: false,
  minimalVisuals: true,
};

function normalizeSettings(input = {}) {
  return {
    defaultChatMode: ['chat', 'search', 'research'].includes(input.defaultChatMode)
      ? input.defaultChatMode
      : DEFAULT_SETTINGS.defaultChatMode,
    responseMode: ['deep', 'speed'].includes(input.responseMode)
      ? input.responseMode
      : DEFAULT_SETTINGS.responseMode,
    theme: ['light', 'dark'].includes(input.theme)
      ? input.theme
      : DEFAULT_SETTINGS.theme,
    showChatTimestamps:
      typeof input.showChatTimestamps === 'boolean'
        ? input.showChatTimestamps
        : DEFAULT_SETTINGS.showChatTimestamps,
    sidebarCollapsed:
      typeof input.sidebarCollapsed === 'boolean'
        ? input.sidebarCollapsed
        : DEFAULT_SETTINGS.sidebarCollapsed,
    notificationsEnabled:
      typeof input.notificationsEnabled === 'boolean'
        ? input.notificationsEnabled
        : DEFAULT_SETTINGS.notificationsEnabled,
    compactMessages:
      typeof input.compactMessages === 'boolean'
        ? input.compactMessages
        : DEFAULT_SETTINGS.compactMessages,
    minimalVisuals:
      typeof input.minimalVisuals === 'boolean'
        ? input.minimalVisuals
        : DEFAULT_SETTINGS.minimalVisuals,
  };
}

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
    const { name, avatar, settings } = body;

    const { ObjectId } = await import('mongodb');
    const updateData = {};
    if (typeof name === 'string' && name.trim()) updateData.name = name.trim().slice(0, 80);
    if (avatar !== undefined) updateData.avatar = avatar;
    if (settings && typeof settings === 'object') updateData.settings = normalizeSettings(settings);

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

    const updatedUser = await ensureLifetimeAccess(db, result);
    const usage = await getDailyUsage(db, updatedUser._id.toString());

    return NextResponse.json({
      user: {
        id: updatedUser._id.toString(),
        email: updatedUser.email,
        name: updatedUser.name || updatedUser.email.split('@')[0],
        avatar: updatedUser.avatar || null,
        settings: normalizeSettings(updatedUser.settings || {}),
        ...serializeUserPlan(updatedUser),
        usage: buildUsagePayload(updatedUser, usage),
      }
    });
  } catch (error) {
    console.error('Settings error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
