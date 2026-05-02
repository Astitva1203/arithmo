'use client';

import { useState, useRef } from 'react';
import { Camera, Check, Loader2, LogOut, Moon, Sun, X } from 'lucide-react';

function PreferenceToggle({ label, description, enabled, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        border: '1px solid var(--border-glass)',
        background: 'var(--bg-glass-input)',
        borderRadius: 10,
        padding: '10px 12px',
        color: 'var(--text-primary)',
        cursor: 'pointer',
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
        <strong style={{ fontSize: '0.84rem', fontWeight: 600 }}>{label}</strong>
        <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{description}</small>
      </span>
      <span
        aria-hidden="true"
        style={{
          width: 38,
          height: 22,
          borderRadius: 999,
          position: 'relative',
          background: enabled ? 'rgba(59, 130, 246, 0.35)' : 'rgba(148, 163, 184, 0.24)',
          border: '1px solid rgba(148, 163, 184, 0.35)',
          transition: 'background 150ms ease',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: enabled ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: enabled ? '#60a5fa' : '#94a3b8',
            transition: 'left 150ms ease',
          }}
        />
      </span>
    </button>
  );
}

export default function SettingsModal({
  user,
  onClose,
  onUpdateUser,
  theme,
  onToggleTheme,
  onSetThemeMode,
  chatMode,
  onChatModeChange,
  responseMode,
  onResponseModeChange,
  showChatTimestamps,
  onToggleChatTimestamps,
  sidebarCollapsed,
  onToggleSidebarCollapsed,
  notificationsEnabled,
  onToggleNotifications,
  compactMessages,
  onToggleCompactMessages,
  minimalVisuals,
  onToggleMinimalVisuals,
  settings,
  onLogout,
}) {
  const [name, setName] = useState(user?.name || '');
  const [avatarSrc, setAvatarSrc] = useState(user?.avatar || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setAvatarSrc(dataUrl);
        setError('');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          avatar: avatarSrc,
          settings: {
            ...settings,
            defaultChatMode: chatMode,
            responseMode,
            theme,
            showChatTimestamps: showChatTimestamps !== false,
            sidebarCollapsed: Boolean(sidebarCollapsed),
            notificationsEnabled: notificationsEnabled !== false,
            compactMessages: Boolean(compactMessages),
            minimalVisuals: minimalVisuals !== false,
          },
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      setSuccess('Profile updated successfully.');
      onUpdateUser(data.user);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '460px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', position: 'relative', maxHeight: '88vh', overflowY: 'auto' }}>
        <button onClick={onClose} style={{ position: 'absolute', right: '16px', top: '16px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X size={20} />
        </button>

        <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>Settings</h2>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <div style={{ position: 'relative' }}>
            <div
              style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--gradient-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: 'white', overflow: 'hidden', border: '2px solid var(--border-glass-strong)' }}
            >
              {avatarSrc ? (
                <img src={avatarSrc} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                (user?.name || user?.email || 'U')[0]?.toUpperCase()
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ position: 'absolute', bottom: '-4px', right: '-4px', background: 'var(--bg-glass-input)', border: '1px solid var(--border-glass-strong)', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
              title="Change avatar"
            >
              <Camera size={14} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/png,image/jpeg,image/webp"
              hidden
            />
          </div>
          <div style={{ width: '100%' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="chat-search"
              style={{ width: '100%', padding: '10px 14px', boxSizing: 'border-box' }}
              placeholder="Your name"
            />
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '14px', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '0.93rem', color: 'var(--text-primary)' }}>Customization</h3>

          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ border: '1px solid var(--border-glass)', borderRadius: 10, padding: 10, background: 'var(--bg-glass-input)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
                <strong style={{ fontSize: '0.84rem' }}>Theme Mode</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => onSetThemeMode?.('light')}
                  style={{
                    border: '1px solid var(--border-glass)',
                    background: theme === 'light' ? 'rgba(59,130,246,0.2)' : 'transparent',
                    color: 'var(--text-primary)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    cursor: 'pointer',
                  }}
                >
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => onSetThemeMode?.('dark')}
                  style={{
                    border: '1px solid var(--border-glass)',
                    background: theme === 'dark' ? 'rgba(59,130,246,0.2)' : 'transparent',
                    color: 'var(--text-primary)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    cursor: 'pointer',
                  }}
                >
                  Dark
                </button>
              </div>
              <button
                type="button"
                onClick={onToggleTheme}
                style={{
                  marginTop: 8,
                  width: '100%',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Quick Toggle Theme
              </button>
            </div>

            <div style={{ border: '1px solid var(--border-glass)', borderRadius: 10, padding: 10, background: 'var(--bg-glass-input)' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Default Chat Mode</label>
              <select
                value={chatMode}
                onChange={(event) => onChatModeChange?.(event.target.value)}
                style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'var(--text-primary)', padding: '8px 10px' }}
              >
                <option value="chat">Chat</option>
                <option value="search">Search</option>
                <option value="research">Research</option>
              </select>
            </div>

            <div style={{ border: '1px solid var(--border-glass)', borderRadius: 10, padding: 10, background: 'var(--bg-glass-input)' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Response Style</label>
              <select
                value={responseMode}
                onChange={(event) => onResponseModeChange?.(event.target.value)}
                style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'var(--text-primary)', padding: '8px 10px' }}
              >
                <option value="deep">Deep</option>
                <option value="speed">Speed</option>
              </select>
            </div>

            <PreferenceToggle
              label="Show Chat Timestamps"
              description="Display time labels in recent chats sections."
              enabled={showChatTimestamps !== false}
              onChange={onToggleChatTimestamps}
            />

            <PreferenceToggle
              label="Collapsed Sidebar by Default"
              description="Start desktop layout with compact sidebar."
              enabled={Boolean(sidebarCollapsed)}
              onChange={onToggleSidebarCollapsed}
            />

            <PreferenceToggle
              label="In-App Notices"
              description="Show product and account notice banners."
              enabled={notificationsEnabled !== false}
              onChange={onToggleNotifications}
            />

            <PreferenceToggle
              label="Compact Chat Bubbles"
              description="Use tighter spacing for longer conversations."
              enabled={Boolean(compactMessages)}
              onChange={onToggleCompactMessages}
            />

            <PreferenceToggle
              label="Minimal Visual Style"
              description="Reduce bright gradients and keep the chat surface calm."
              enabled={minimalVisuals !== false}
              onChange={onToggleMinimalVisuals}
            />
          </div>
        </div>

        {error && <div style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: '16px', padding: '8px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>{error}</div>}
        {success && <div style={{ color: 'var(--success)', fontSize: '0.85rem', marginBottom: '16px', padding: '8px', background: 'rgba(34,197,94,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} /> {success}</div>}

        <div style={{ display: 'grid', gap: 10 }}>
          <button
            onClick={onLogout}
            type="button"
            style={{
              padding: '9px 12px',
              border: '1px solid rgba(239,68,68,0.35)',
              background: 'rgba(239,68,68,0.12)',
              color: '#fca5a5',
              cursor: 'pointer',
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontWeight: 600,
            }}
          >
            <LogOut size={14} /> Sign Out
          </button>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '8px' }}>Close</button>
            <button onClick={handleSaveProfile} disabled={loading} style={{ padding: '8px 16px', background: 'var(--gradient-accent)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
              {loading ? <Loader2 size={16} className="spin" /> : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
