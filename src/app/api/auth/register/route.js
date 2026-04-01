import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { hashPassword, signToken, createAuthCookie } from '@/lib/auth';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const name = String(body.name || '').trim() || email.split('@')[0];

    if (!email || !email.includes('@') || email.length > 255) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    if (password.length > 128) {
      return NextResponse.json({ error: 'Password is too long.' }, { status: 400 });
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ error: 'Database not available. Check MONGODB_URI in .env.local' }, { status: 503 });
    }

    const users = db.collection('users');
    const existing = await users.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const hashed = await hashPassword(password);
    const result = await users.insertOne({
      email,
      name,
      password: hashed,
      createdAt: new Date(),
    });

    const token = signToken(result.insertedId.toString());
    const response = NextResponse.json({
      user: {
        id: result.insertedId.toString(),
        email,
        name,
      },
    });

    response.headers.set('Set-Cookie', createAuthCookie(token));
    return response;
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }
}
