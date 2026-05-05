import { NextResponse } from 'next/server';
import { getAuthUser, authErrorResponse, AuthError } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { isAdminEmail } from '@/lib/adminAccess';
import { utcDayKey } from '@/lib/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (!isAdminEmail(auth.email)) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ error: 'Database not available.' }, { status: 500 });
    }

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dateKey = utcDayKey(now);

    const [
      totalUsers,
      activeToday,
      activeWeek,
      freeUsers,
      proUsers,
      lifetimeUsers,
      usageDocs,
      rateLimitHits,
      recentErrors,
    ] = await Promise.all([
      db.collection('users').countDocuments(),
      db.collection('users').countDocuments({ lastSeenAt: { $gte: dayAgo } }),
      db.collection('users').countDocuments({ lastSeenAt: { $gte: weekAgo } }),
      db.collection('users').countDocuments({ $or: [{ plan: 'free' }, { plan: { $exists: false } }] }),
      db.collection('users').countDocuments({ plan: 'pro' }),
      db.collection('users').countDocuments({ plan: 'lifetime' }),
      db.collection('users')
        .aggregate([
          { $match: { lastReset: dateKey } },
          {
            $group: {
              _id: null,
              chat: { $sum: '$usage.chat' },
              search: { $sum: '$usage.search' },
              research: { $sum: '$usage.research' },
              images: { $sum: '$usage.images' },
            },
          },
        ])
        .toArray(),
      db.collection('securityLogs').countDocuments({ type: 'rate_limit', createdAt: { $gte: dayAgo } }),
      db.collection('securityLogs')
        .find({ type: { $in: ['error', 'auth_error'] } })
        .sort({ createdAt: -1 })
        .limit(8)
        .project({ _id: 0, type: 1, message: 1, email: 1, status: 1, createdAt: 1 })
        .toArray(),
    ]);

    return NextResponse.json({
      dateKey,
      users: {
        total: totalUsers,
        activeToday,
        activeWeek,
        free: freeUsers,
        pro: proUsers,
        lifetime: lifetimeUsers,
      },
      usage: usageDocs[0] || { chat: 0, search: 0, research: 0, images: 0 },
      security: {
        rateLimitHits,
        recentErrors,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Failed to load admin stats.' }, { status: 500 });
  }
}
