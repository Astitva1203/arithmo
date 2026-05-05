import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { verifyFirebaseIdToken, FirebaseAdminConfigError } from '@/lib/firebaseAdmin';
import { defaultPlanFields, ensureLifetimeAccess, emptyUsage, utcDayKey } from '@/lib/billing';
import { DEFAULT_USER_SETTINGS, normalizeSettings } from '@/lib/userDefaults';

export const COOKIE_NAME = 'arithmo_token';

export class AuthError extends Error {
  constructor(message, status = 401, code = 'UNAUTHORIZED') {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getBearerToken(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return '';
  return authHeader.slice(7).trim();
}

function defaultUserName(decoded, email) {
  return (
    decoded.name ||
    decoded.displayName ||
    decoded.email?.split('@')[0] ||
    email.split('@')[0] ||
    'User'
  );
}

function mergeUserDefaults(user = {}, decoded = {}, email = '') {
  const planDefaults = defaultPlanFields(email);
  const dateKey = utcDayKey();
  const existingUsage = user.usage && user.lastReset === dateKey ? user.usage : emptyUsage(dateKey);

  return {
    firebaseUid: decoded.uid,
    email,
    name: user.name || defaultUserName(decoded, email),
    avatar: user.avatar || decoded.picture || null,
    plan: user.plan || planDefaults.plan,
    planExpiresAt: user.planExpiresAt ?? planDefaults.planExpiresAt,
    planGrantedAt: user.planGrantedAt ?? planDefaults.planGrantedAt,
    planSource: user.planSource || planDefaults.planSource,
    usage: {
      chat: Number(existingUsage.chat || 0),
      search: Number(existingUsage.search || 0),
      research: Number(existingUsage.research || 0),
      images: Number(existingUsage.images || 0),
    },
    lastReset: user.lastReset || dateKey,
    settings: normalizeSettings(user.settings || DEFAULT_USER_SETTINGS),
  };
}

export async function getAuthUser(request) {
  const token = getBearerToken(request);
  if (!token) {
    throw new AuthError('Unauthorized', 401, 'MISSING_TOKEN');
  }

  let decoded;
  try {
    decoded = await verifyFirebaseIdToken(token);
  } catch (error) {
    if (error instanceof FirebaseAdminConfigError) {
      throw new AuthError(
        'Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_BASE64.',
        503,
        'FIREBASE_ADMIN_NOT_CONFIGURED'
      );
    }
    throw new AuthError('Invalid token', 403, 'INVALID_TOKEN');
  }

  const email = normalizeEmail(decoded.email);
  if (!decoded.uid || !email) {
    throw new AuthError('Invalid token payload', 403, 'INVALID_TOKEN');
  }

  const db = await getDb();
  if (!db) {
    throw new AuthError('Database unavailable. Check MONGODB_URI.', 503, 'DATABASE_UNAVAILABLE');
  }

  const now = new Date();
  let user = await db.collection('users').findOne(
    { firebaseUid: decoded.uid },
    { projection: { password: 0 } }
  );

  if (!user) {
    user = await db.collection('users').findOne({ email }, { projection: { password: 0 } });
  }

  if (!user) {
    const defaults = mergeUserDefaults({}, decoded, email);
    const insert = {
      ...defaults,
      emailVerified: Boolean(decoded.email_verified),
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    };
    const result = await db.collection('users').insertOne(insert);
    user = { ...insert, _id: result.insertedId };
  } else {
    const defaults = mergeUserDefaults(user, decoded, email);
    const update = {
      firebaseUid: decoded.uid,
      email,
      name: user.name || defaults.name,
      avatar: user.avatar || defaults.avatar,
      plan: defaults.plan,
      planExpiresAt: defaults.planExpiresAt,
      planGrantedAt: defaults.planGrantedAt,
      planSource: defaults.planSource,
      settings: defaults.settings,
      emailVerified: Boolean(decoded.email_verified),
      lastReset: defaults.lastReset,
      usage: defaults.usage,
      lastSeenAt: now,
      updatedAt: now,
    };

    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: update,
        $unset: { passwordResetRequired: '', resetReason: '' },
      }
    );
    user = { ...user, ...update };
  }

  user = await ensureLifetimeAccess(db, user);

  return {
    userId: user._id.toString(),
    firebaseUid: decoded.uid,
    email,
    decoded,
    mongoUser: user,
  };
}

export function authErrorResponse(error) {
  const status = error instanceof AuthError ? error.status : 500;
  const fallbackMessage =
    status === 401
      ? 'Unauthorized'
      : status === 403
        ? 'Forbidden'
        : 'Authentication failed';
  const message =
    error instanceof AuthError && error.message
      ? error.message
      : fallbackMessage;
  const code = error?.code || 'AUTH_ERROR';

  return NextResponse.json(
    {
      error: message,
      code,
    },
    { status }
  );
}

export function clearAuthCookie() {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const secure = isProduction ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`;
}

export function objectIdFromUserId(userId) {
  if (!ObjectId.isValid(userId)) return null;
  return ObjectId.createFromHexString(userId);
}
