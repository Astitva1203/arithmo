export const FREE_LIMITS = {
  chat: 50,
  search: 3,
  research: 1,
  images: 3,
};

export const PRO_PRICE_INR = 299;
export const UPGRADE_URL = '/pricing';

const LIFETIME_EMAILS = new Set(['astitvapandey1203@gmail.com']);

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function toCount(value) {
  const count = Number(value || 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

export class AccessError extends Error {
  constructor({ code, feature, message, limit = null, used = null }) {
    super(message);
    this.name = 'AccessError';
    this.status = 402;
    this.code = code;
    this.feature = feature;
    this.limit = limit;
    this.used = used;
  }
}

export function isLifetimeEmail(email) {
  return LIFETIME_EMAILS.has(normalizeEmail(email));
}

export function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function defaultPlanFields(email) {
  const lifetime = isLifetimeEmail(email);
  return {
    plan: lifetime ? 'lifetime' : 'free',
    planExpiresAt: null,
    planGrantedAt: lifetime ? new Date() : null,
    planSource: lifetime ? 'system' : 'system',
  };
}

export function normalizePlan(user = {}) {
  const email = normalizeEmail(user.email);
  const forcedLifetime = isLifetimeEmail(email);
  const rawPlan = forcedLifetime ? 'lifetime' : String(user.plan || 'free').toLowerCase();
  const plan = ['free', 'pro', 'lifetime'].includes(rawPlan) ? rawPlan : 'free';
  const expiry = user.planExpiresAt ? new Date(user.planExpiresAt) : null;
  const hasExpired = plan === 'pro' && expiry && expiry.getTime() <= Date.now();
  const normalizedPlan = hasExpired ? 'free' : plan;
  const isLifetime = normalizedPlan === 'lifetime';
  const isPremium = isLifetime || normalizedPlan === 'pro';

  return {
    plan: normalizedPlan,
    planExpiresAt: isLifetime ? null : user.planExpiresAt || null,
    planGrantedAt: user.planGrantedAt || null,
    planSource: user.planSource || 'system',
    isPremium,
    isLifetime,
  };
}

export async function ensureLifetimeAccess(db, user) {
  if (!db || !user || !isLifetimeEmail(user.email)) return user;

  const update = {
    plan: 'lifetime',
    planExpiresAt: null,
    planSource: 'system',
    updatedAt: new Date(),
  };

  if (!user.planGrantedAt) {
    update.planGrantedAt = new Date();
  }

  try {
    await db.collection('users').updateOne({ _id: user._id }, { $set: update });
  } catch (error) {
    console.error('Lifetime grant update failed:', error?.message || error);
  }

  return { ...user, ...update, planGrantedAt: update.planGrantedAt || user.planGrantedAt };
}

export function serializeUserPlan(user = {}) {
  const planInfo = normalizePlan(user);
  return {
    plan: planInfo.plan,
    planExpiresAt: planInfo.planExpiresAt,
    isPremium: planInfo.isPremium,
    isLifetime: planInfo.isLifetime,
  };
}

export function emptyUsage(dateKey = utcDayKey()) {
  return {
    dateKey,
    chat: 0,
    search: 0,
    research: 0,
    images: 0,
  };
}

export async function getDailyUsage(db, userOrId, dateKey = utcDayKey()) {
  if (!userOrId) return emptyUsage(dateKey);

  let user = typeof userOrId === 'object' ? userOrId : null;

  if (!user && db && typeof userOrId === 'string') {
    try {
      const { ObjectId } = await import('mongodb');
      if (ObjectId.isValid(userOrId)) {
        user = await db.collection('users').findOne(
          { _id: ObjectId.createFromHexString(userOrId) },
          { projection: { usage: 1, lastReset: 1 } }
        );
      }
    } catch {
      user = null;
    }
  }

  const doc = user?.lastReset === dateKey ? user.usage || {} : {};
  return {
    dateKey,
    chat: toCount(doc.chat),
    search: toCount(doc.search),
    research: toCount(doc.research),
    images: toCount(doc.images),
  };
}

export function buildUsagePayload(user = {}, usage = emptyUsage()) {
  const planInfo = normalizePlan(user);
  const limits = planInfo.isPremium
    ? { chat: null, search: null, research: null, images: null }
    : FREE_LIMITS;
  const normalizedUsage = {
    chat: toCount(usage.chat),
    search: toCount(usage.search),
    research: toCount(usage.research),
    images: toCount(usage.images),
  };

  const remaining = Object.fromEntries(
    Object.entries(limits).map(([key, limit]) => [
      key,
      limit === null ? null : Math.max(0, limit - normalizedUsage[key]),
    ])
  );

  return {
    ...serializeUserPlan(user),
    limits,
    remaining,
    usage: normalizedUsage,
    dateKey: usage.dateKey || utcDayKey(),
  };
}

export function assertPremiumFeature(user, feature, requestedValue) {
  const planInfo = normalizePlan(user);
  if (planInfo.isPremium) return;

  if (feature === 'modelMode' && ['smart', 'deep'].includes(String(requestedValue || '').toLowerCase())) {
    throw new AccessError({
      code: 'PREMIUM_REQUIRED',
      feature: requestedValue === 'deep' ? 'Deep Mode' : 'Smart Mode',
      message: `${requestedValue === 'deep' ? 'Deep Mode' : 'Smart Mode'} is a Pro feature. Upgrade to continue.`,
    });
  }

  if (feature === 'learningMode' && ['reverse', 'explain'].includes(String(requestedValue || '').toLowerCase())) {
    throw new AccessError({
      code: 'PREMIUM_REQUIRED',
      feature: 'Advanced Learning',
      message: 'Advanced learning modes are Pro features. Upgrade to continue.',
    });
  }
}

export function getEffectiveModelMode(user, requestedMode) {
  const planInfo = normalizePlan(user);
  if (planInfo.isPremium) return requestedMode || 'auto';
  return 'fast';
}

export function getEffectiveProvider(user, requestedProvider) {
  const planInfo = normalizePlan(user);
  if (planInfo.isPremium) return requestedProvider || 'auto';
  return 'groq';
}

export async function incrementUsageOrThrow(db, { user, userId, units }) {
  const planInfo = normalizePlan(user);
  const dateKey = utcDayKey();
  const usage = await getDailyUsage(db, user, dateKey);

  if (planInfo.isPremium) {
    return buildUsagePayload(user, usage);
  }

  const normalizedUnits = Object.fromEntries(
    Object.entries(units || {}).map(([key, value]) => [key, toCount(value)])
  );

  for (const [feature, amount] of Object.entries(normalizedUnits)) {
    if (!amount) continue;
    const limit = FREE_LIMITS[feature];
    if (typeof limit !== 'number') continue;
    const used = toCount(usage[feature]);
    if (used + amount > limit) {
      throw new AccessError({
        code: 'LIMIT_REACHED',
        feature,
        limit,
        used,
        message: `You've reached your free ${feature} limit for today. Upgrade to Pro to continue.`,
      });
    }
  }

  if (!db || !userId) {
    throw new AccessError({
      code: 'LIMIT_REACHED',
      feature: 'usage',
      message: 'Usage tracking is temporarily unavailable. Please try again shortly.',
    });
  }

  const increments = {};
  for (const [feature, amount] of Object.entries(normalizedUnits)) {
    if (amount > 0) increments[`usage.${feature}`] = amount;
  }

  if (Object.keys(increments).length > 0) {
    const { ObjectId } = await import('mongodb');
    await db.collection('users').updateOne(
      { _id: ObjectId.createFromHexString(userId) },
      {
        $inc: increments,
        $set: { updatedAt: new Date(), lastReset: dateKey },
        $setOnInsert: { usage: emptyUsage(dateKey) },
      }
    );

    await db.collection('usageEvents').insertOne({
      userId,
      dateKey,
      units: normalizedUnits,
      createdAt: new Date(),
    }).catch(() => null);
  }

  const nextUsage = { ...usage };
  for (const [featurePath, amount] of Object.entries(increments)) {
    const feature = featurePath.replace('usage.', '');
    nextUsage[feature] = toCount(nextUsage[feature]) + amount;
  }

  return buildUsagePayload(user, nextUsage);
}

export async function resetUsageIfNeeded(db, user) {
  if (!db || !user?._id) return user;
  const dateKey = utcDayKey();
  if (user.lastReset === dateKey) return user;

  const usage = { chat: 0, search: 0, research: 0, images: 0 };
  await db.collection('users').updateOne(
    { _id: user._id },
    {
      $set: {
        usage,
        lastReset: dateKey,
        updatedAt: new Date(),
      },
    }
  );

  return { ...user, usage, lastReset: dateKey };
}

export async function logSecurityEvent(db, event = {}) {
  if (!db) return;
  await db.collection('securityLogs').insertOne({
    type: event.type || 'event',
    userId: event.userId || null,
    email: event.email || null,
    status: event.status || null,
    message: String(event.message || '').slice(0, 300),
    createdAt: new Date(),
  }).catch(() => null);
}

export async function logRateLimitHit(db, event = {}) {
  if (!db) return;
  await db.collection('securityLogs').insertOne({
    type: 'rate_limit',
    userId: event.userId || null,
    email: event.email || null,
    feature: event.feature || null,
    message: String(event.message || 'Daily limit reached.').slice(0, 300),
    createdAt: new Date(),
  }).catch(() => null);
}

export function accessErrorPayload(error, usage = null) {
  return {
    error: error?.message || 'Upgrade required.',
    code: error?.code || 'PREMIUM_REQUIRED',
    feature: error?.feature || 'premium',
    limit: error?.limit ?? null,
    used: error?.used ?? null,
    upgradeUrl: UPGRADE_URL,
    usage,
  };
}
