import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export class FirebaseAdminConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FirebaseAdminConfigError';
  }
}

let adminAuth = null;

function getServiceAccount() {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!encoded) {
    throw new FirebaseAdminConfigError('FIREBASE_SERVICE_ACCOUNT_BASE64 is not configured.');
  }

  try {
    return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  } catch {
    throw new FirebaseAdminConfigError(
      'FIREBASE_SERVICE_ACCOUNT_BASE64 is not valid base64 JSON.'
    );
  }
}

export function getFirebaseAdminAuth() {
  if (adminAuth) return adminAuth;

  if (!getApps().length) {
    initializeApp({
      credential: cert(getServiceAccount()),
    });
  }

  adminAuth = getAuth();
  return adminAuth;
}

export async function verifyFirebaseIdToken(token) {
  return getFirebaseAdminAuth().verifyIdToken(token);
}
