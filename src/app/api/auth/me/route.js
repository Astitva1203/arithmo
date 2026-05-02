import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAuthUser } from '@/lib/auth';
import {
  buildUsagePayload,
  ensureLifetimeAccess,
  getDailyUsage,
  serializeUserPlan,
} from '@/lib/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    theme: ['light', 'dark'].includes(input.theme) ? input.theme : DEFAULT_SETTINGS.theme,
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
          settings: DEFAULT_SETTINGS,
          ...serializeUserPlan({ email: 'user@arithmo.ai' }),
          usage: buildUsagePayload({ email: 'user@arithmo.ai' }),
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

    user = await ensureLifetimeAccess(db, user);
    const usage = await getDailyUsage(db, user._id.toString());
    const usagePayload = buildUsagePayload(user, usage);

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name || user.email.split('@')[0],
        avatar: user.avatar || null,
        settings: normalizeSettings(user.settings || {}),
        ...serializeUserPlan(user),
        usage: usagePayload,
      },
    });
  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json({ error: 'Authentication check failed.' }, { status: 500 });
  }
}
