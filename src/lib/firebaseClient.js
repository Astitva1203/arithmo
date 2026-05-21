'use client';

import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDFsiG_X4XSzFJ068leANb5kTZl_L9AjIY",
  authDomain: "arithmo-e0275.firebaseapp.com",
  projectId: "arithmo-e0275",
  storageBucket: "arithmo-e0275.appspot.com",
  messagingSenderId: "1051443488888",
  appId: "1:1051443488888:web:1234567890abcdef",
  measurementId: "G-1234567890",
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
