import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { comparePassword, signToken, createAuthCookie } from '@/lib/auth';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ error: 'Database not available. Check MONGODB_URI in .env.local' }, { status: 503 });
    }

    const user = await db.collection('users').findOne({ email });
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const token = signToken(user._id.toString());
    const response = NextResponse.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name || user.email.split('@')[0],
      },
    });

    response.headers.set('Set-Cookie', createAuthCookie(token));
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 });
  }
}
