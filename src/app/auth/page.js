'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { getFirebaseClientAuth, isFirebaseClientConfigured } from '@/lib/firebaseClient';
import { resilientFetch } from '@/lib/resilientFetch';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const router = useRouter();

  const handleSetError = (msg) => {
    setError(msg);
    if (msg) {
      setShake(true);
      setTimeout(() => setShake(false), 400); // 400ms matches the shake-error animation duration
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
    handleSetError('');
    setLoading(true);

    try {
      if (!isFirebaseClientConfigured()) {
        throw new Error('Firebase is not configured. Please add the Firebase environment variables.');
      }

      const firebaseAuth = getFirebaseClientAuth();
      const credentials = isLogin
        ? await signInWithEmailAndPassword(firebaseAuth, email.trim(), password)
        : await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);

      if (!isLogin && name.trim()) {
        await updateProfile(credentials.user, { displayName: name.trim().slice(0, 80) });
      }

      await credentials.user.getIdToken(true);

      const res = await resilientFetch('/api/auth/me', {
        method: 'GET',
      });

      const data = await res.json();

      if (!res.ok) {
        handleSetError(data.error || 'Something went wrong.');
        setLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      const code = err?.code || '';
      const friendly =
        code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')
          ? 'Invalid email or password.'
          : code.includes('email-already-in-use')
            ? 'This email already has an account. Please sign in.'
            : err?.message || 'Network error. Please try again.';
      handleSetError(friendly);
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    handleSetError('');
    setGoogleLoading(true);

    try {
      if (!isFirebaseClientConfigured()) {
        throw new Error('Firebase is not configured. Please add the Firebase environment variables.');
      }

      const firebaseAuth = getFirebaseClientAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await signInWithPopup(firebaseAuth, provider);
      const token = await result.user.getIdToken();

      const res = await resilientFetch(
        '/api/auth/me',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        { skipAuth: true }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        handleSetError(data.error || 'Login failed. Please try again.');
        setGoogleLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      const code = err?.code || '';
      const friendly =
        code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')
          ? 'Login canceled.'
          : code.includes('popup-blocked')
            ? 'Popup blocked. Please allow popups and try again.'
            : err?.message || 'Login failed. Please try again.';
      handleSetError(friendly);
      setGoogleLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg-glow" />
      <div className="auth-particles" />

      <div className="auth-card">
        <div className="auth-brand">
          <img src="/logo.png" alt="Arithmo AI logo" className="auth-logo" />
          <h1>Arithmo AI</h1>
          <p>Your intelligent assistant</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(true); handleSetError(''); }}
            type="button"
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(false); handleSetError(''); }}
            type="button"
          >
            Sign Up
          </button>
        </div>

        <button
          type="button"
          className="auth-google"
          onClick={handleGoogleSignIn}
          disabled={loading || googleLoading}
        >
          <span className="auth-google-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="img" focusable="false">
              <path
                d="M23.2 12.3c0-.8-.1-1.6-.2-2.4H12v4.5h6.3a5.4 5.4 0 0 1-2.3 3.6v3h3.7c2.2-2 3.5-5 3.5-8.7z"
                fill="#4285F4"
              />
              <path
                d="M12 24c3.2 0 5.9-1.1 7.8-2.9l-3.7-3c-1 .7-2.3 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.5v3.1A12 12 0 0 0 12 24z"
                fill="#34A853"
              />
              <path
                d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.5a12 12 0 0 0 0 10.9l3.8-3.2z"
                fill="#FBBC05"
              />
              <path
                d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.4 11.4 0 0 0 12 0 12 12 0 0 0 1.5 6.6l3.8 3.1c.9-2.9 3.6-4.9 6.7-4.9z"
                fill="#EA4335"
              />
            </svg>
          </span>
          <span>{googleLoading ? 'Connecting...' : 'Continue with Google'}</span>
        </button>

        <div className="auth-divider" aria-hidden="true">
          <span>or</span>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="auth-field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isLogin ? 'Your password' : 'At least 6 characters'}
                required
                minLength={6}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button
            type="submit"
            className={`auth-submit ${shake ? 'shake' : ''}`}
            disabled={loading || googleLoading}
          >
            {loading ? (
              <span className="auth-spinner" />
            ) : isLogin ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <p className="auth-footer-text">
          By continuing, you agree to our{' '}
          <a href="/terms">Terms of Use</a> and{' '}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
