'use client';

import { useRef, useState } from 'react';
import { Camera, Check, Loader2, LogOut, X } from 'lucide-react';
import { resilientFetch } from '@/lib/resilientFetch';

function planLabel(user) {
  if (user?.isLifetime) return 'Lifetime';
  if (user?.isPremium) return 'Pro';
  return 'Free';
}

function fieldStyle() {
  return {
    width: '100%',
    borderRadius: 10,
    border: '1px solid var(--border-glass)',
    background: 'var(--bg-glass-input)',
    color: 'var(--text-primary)',
    padding: '10px 12px',
    boxSizing: 'border-box',
  };
}

export default function SettingsModal({
  user,
  onClose,
  onUpdateUser,
  chatMode,
  onChatModeChange,
  responseMode,
  onResponseModeChange,
  settings,
  onLogout,
}) {
  const [name, setName] = useState(user?.name || '');
  const [avatarSrc, setAvatarSrc] = useState(user?.avatar || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 200;
        let { width, height } = img;

        if (width > height && width > maxSize) {
          height *= maxSize / width;
          width = maxSize;
        } else if (height > maxSize) {
          width *= maxSize / height;
          height = maxSize;
        }

        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        setAvatarSrc(canvas.toDataURL('image/jpeg', 0.85));
        setError('');
      };
      img.src = readerEvent.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await resilientFetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          avatar: avatarSrc,
          settings: {
            ...settings,
            defaultChatMode: chatMode,
            responseMode,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save settings.');

      setSuccess('Settings saved.');
      onUpdateUser?.(data.user);
    } catch (err) {
      setError(err.message || 'Failed to save settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.62)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="modal-content"
        onClick={(event) => event.stopPropagation()}
        style={{
          background: 'var(--bg-glass)',
          border: '1px solid var(--border-glass)',
          borderRadius: 18,
          padding: 24,
          width: '90%',
          maxWidth: 460,
          boxShadow: '0 24px 60px rgba(0,0,0,0.42)',
          position: 'relative',
          maxHeight: '88vh',
          overflowY: 'auto',
        }}
      >
        <button
          onClick={onClose}
          type="button"
          aria-label="Close settings"
          style={{ position: 'absolute', right: 16, top: 16, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>

        <h2 style={{ marginTop: 0, marginBottom: 18, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Settings
        </h2>

        <section style={{ display: 'grid', gap: 14, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'var(--gradient-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.8rem',
                  color: 'white',
                  overflow: 'hidden',
                  border: '2px solid var(--border-glass-strong)',
                }}
              >
                {avatarSrc ? <img src={avatarSrc} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (user?.name || user?.email || 'U')[0]?.toUpperCase()}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                type="button"
                style={{ position: 'absolute', bottom: -4, right: -4, background: 'var(--bg-glass-input)', border: '1px solid var(--border-glass-strong)', borderRadius: '50%', width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--text-primary)' }}
                title="Change avatar"
              >
                <Camera size={14} />
              </button>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageChange} hidden />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Name</label>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" style={fieldStyle()} />
            </div>
          </div>
        </section>

        <section style={{ borderTop: '1px solid var(--border-glass)', paddingTop: 16, display: 'grid', gap: 12 }}>
          <div style={{ border: '1px solid var(--border-glass)', borderRadius: 12, padding: 12, background: 'var(--bg-glass-input)' }}>
            <small style={{ display: 'block', color: 'var(--text-muted)', marginBottom: 4 }}>User Email</small>
            <strong style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>{user?.email || 'Not available'}</strong>
          </div>

          <div style={{ border: '1px solid var(--border-glass)', borderRadius: 12, padding: 12, background: 'var(--bg-glass-input)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span>
              <small style={{ display: 'block', color: 'var(--text-muted)', marginBottom: 4 }}>Plan Status</small>
              <strong style={{ color: 'var(--text-primary)' }}>{planLabel(user)}</strong>
            </span>
            <span className={`arithmo-plan-badge ${user?.isLifetime ? 'lifetime' : user?.isPremium ? 'pro' : ''}`}>
              {planLabel(user)}
            </span>
          </div>

          <div style={{ border: '1px solid var(--border-glass)', borderRadius: 12, padding: 12, background: 'var(--bg-glass-input)' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Default Chat Mode</label>
            <select value={chatMode} onChange={(event) => onChatModeChange?.(event.target.value)} style={fieldStyle()}>
              <option value="chat">Chat</option>
              <option value="search">Search</option>
              <option value="research">Research</option>
            </select>
          </div>

          <div style={{ border: '1px solid var(--border-glass)', borderRadius: 12, padding: 12, background: 'var(--bg-glass-input)' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Response Style</label>
            <select value={responseMode} onChange={(event) => onResponseModeChange?.(event.target.value)} style={fieldStyle()}>
              <option value="deep">Deep</option>
              <option value="speed">Speed</option>
            </select>
          </div>
        </section>

        {error && <div style={{ color: '#fecaca', fontSize: '0.86rem', marginTop: 14, padding: 10, background: 'rgba(239,68,68,0.16)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 10 }}>{error}</div>}
        {success && <div style={{ color: '#bbf7d0', fontSize: '0.86rem', marginTop: 14, padding: 10, background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Check size={14} /> {success}</div>}

        <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
          <button
            onClick={onLogout}
            type="button"
            style={{
              padding: '10px 12px',
              border: '1px solid rgba(239,68,68,0.35)',
              background: 'rgba(239,68,68,0.12)',
              color: '#fca5a5',
              cursor: 'pointer',
              borderRadius: 10,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontWeight: 700,
            }}
          >
            <LogOut size={14} /> Logout
          </button>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button onClick={onClose} type="button" style={{ padding: '9px 16px', background: 'transparent', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: 10 }}>Close</button>
            <button onClick={handleSaveProfile} type="button" disabled={loading} style={{ padding: '9px 16px', background: 'var(--gradient-accent)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
              {loading ? <Loader2 size={16} className="spin" /> : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
