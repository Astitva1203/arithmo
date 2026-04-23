'use client';

import { useState, useRef } from 'react';
import { Camera, X, Check, Loader2 } from 'lucide-react';

export default function SettingsModal({ user, onClose, onUpdateUser }) {
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

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, avatar: avatarSrc })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      setSuccess('Profile updated successfully');
      onUpdateUser(data.user);
      
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', right: '16px', top: '16px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X size={20} />
        </button>
        
        <h2 style={{ marginTop: 0, marginBottom: '24px', fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>Profile Settings</h2>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
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

        {error && <div style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: '16px', padding: '8px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>{error}</div>}
        {success && <div style={{ color: 'var(--success)', fontSize: '0.85rem', marginBottom: '16px', padding: '8px', background: 'rgba(34,197,94,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} /> {success}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '8px' }}>Cancel</button>
          <button onClick={handleSave} disabled={loading} style={{ padding: '8px 16px', background: 'var(--gradient-accent)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
            {loading ? <Loader2 size={16} className="spin" /> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
