import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { comparePassword, hashPassword, signToken, createAuthCookie } from '@/lib/auth';
import {
  buildUsagePayload,
  defaultPlanFields,
  ensureLifetimeAccess,
  getDailyUsage,
  serializeUserPlan,
} from '@/lib/billing';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const providedName = String(body.name || '').trim();
    const allowPasswordReset = Boolean(body.allowPasswordReset);

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ error: 'Database not available. Check MONGODB_URI in .env.local' }, { status: 503 });
    }

    const users = db.collection('users');
    let user = await users.findOne({ email });
    let autoCreated = false;
    let passwordReset = false;

    // Beginner-friendly flow: first sign-in can create the account automatically.
    if (!user) {
      if (password.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters for a new account.' },
          { status: 400 }
        );
      }

      const hashed = await hashPassword(password);
      const finalName = providedName || email.split('@')[0];
      const result = await users.insertOne({
        email,
        name: finalName,
        password: hashed,
        ...defaultPlanFields(email),
        createdAt: new Date(),
      });

      user = {
        _id: result.insertedId,
        email,
        name: finalName,
        ...defaultPlanFields(email),
      };
      autoCreated = true;
    }

    if (!autoCreated) {
      const valid = await comparePassword(password, user.password);
      if (!valid) {
        if (allowPasswordReset) {
          if (password.length < 6) {
            return NextResponse.json(
              { error: 'New password must be at least 6 characters.' },
              { status: 400 }
            );
          }
          const newHash = await hashPassword(password);
          const nextName = providedName || user.name || email.split('@')[0];
          await users.updateOne(
            { _id: user._id },
            { $set: { password: newHash, name: nextName, updatedAt: new Date() } }
          );
          user = { ...user, name: nextName };
          passwordReset = true;
        } else {
          return NextResponse.json(
            {
              error:
                'Incorrect password. If this is your account, use Sign Up with same email to reset password.',
            },
            { status: 400 }
          );
        }
      }
    }

    user = await ensureLifetimeAccess(db, user);
    const usage = await getDailyUsage(db, user._id.toString());
    const usagePayload = buildUsagePayload(user, usage);

    const token = signToken(user._id.toString());
    const response = NextResponse.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name || user.email.split('@')[0],
        avatar: user.avatar || null,
        settings: user.settings || {},
        ...serializeUserPlan(user),
        usage: usagePayload,
      },
      autoCreated,
      passwordReset,
    });

    response.headers.set('Set-Cookie', createAuthCookie(token));
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 });
  }
}
