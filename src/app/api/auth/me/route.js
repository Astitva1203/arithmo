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
    planExpiresAt: user.planExpiresAt || null,
    ...serializeUserPlan(user),
    usage: buildUsagePayload(user, usage),
  };
}

export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    const usage = await getDailyUsage(null, auth.mongoUser);

    return NextResponse.json({
      authenticated: true,
      user: serializeUser(auth.mongoUser, usage),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 401) {
        return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
      }
      return authErrorResponse(error);
    }

    console.error('Auth me error:', error);
    return NextResponse.json({ error: 'Authentication check failed.' }, { status: 500 });
  }
}
