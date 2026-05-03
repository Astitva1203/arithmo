'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { resilientFetch } from '@/lib/resilientFetch';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
      const endpoint = '/api/auth/login';
      const body = {
        email,
        password,
        name,
        allowPasswordReset: !isLogin,
      };

      const res = await resilientFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        handleSetError(data.error || 'Something went wrong.');
        setLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      handleSetError('Network error. Please try again.');
      setLoading(false);
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

          <button type="submit" className={`auth-submit ${shake ? 'shake' : ''}`} disabled={loading}>
            {loading ? (
              <span className="auth-spinner" />
            ) : isLogin ? (
              'Sign In'
            ) : (
              'Create Or Reset Account'
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
