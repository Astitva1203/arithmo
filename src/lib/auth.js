import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'arithmo_default_secret_change_me';
const JWT_EXPIRES_IN = '7d';
const SALT_ROUNDS = 10;
const COOKIE_NAME = 'arithmo_token';

export { COOKIE_NAME };

export function signToken(userId) {
  return jwt.sign({ userId: String(userId) }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function getTokenFromRequest(request) {
  // Check cookie first
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (match) return match[1];

  // Fallback to Authorization header
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7);

  return null;
}

export function getAuthUser(request) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.userId) return null;
  return { userId: decoded.userId };
}

export function createAuthCookie(token) {
  const maxAge = 7 * 24 * 60 * 60; // 7 days
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearAuthCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
