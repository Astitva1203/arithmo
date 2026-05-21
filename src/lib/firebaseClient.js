'use client';

import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: "",
};

let clientAuth = null;

export function isFirebaseClientConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId
  );
}

export function getFirebaseClientAuth() {
  if (!isFirebaseClientConfigured()) {
    throw new Error('Firebase client environment variables are not configured.');
  }

  if (clientAuth) return clientAuth;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  clientAuth = getAuth(app);
  return clientAuth;
}
