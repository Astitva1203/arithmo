'use client';

import Image from 'next/image';

const suggestions = [
  { icon: '💡', text: 'Explain quantum computing simply' },
  { icon: '💻', text: 'Write a Python sorting algorithm' },
  { icon: '🧮', text: 'Solve: integral of x^2 from 0 to 5' },
  { icon: '🔬', text: 'Help me debug my React code' },
];

export default function EmptyState({ onPickSuggestion }) {
  return (
    <div className="empty-state">
      <div className="empty-state-orb" />
      
      <div className="empty-brand" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: '16px' }}>
          <Image
            src="/logo.png"
            alt="Arithmo Logo"
            fill
            className="header-brand-logo"
            style={{ 
              objectFit: 'contain', 
              filter: 'drop-shadow(0 0 16px rgba(51, 182, 255, 0.4))',
              animation: 'pulse-badge 3s ease-in-out infinite'
            }}
          />
        </div>
        <h2>What can I help you discover?</h2>
        <p style={{ color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.02em', fontSize: '0.9rem', marginBottom: '8px' }}>
          Smarter Thinking, Limitless Solutions
        </p>
        <p>Switch between Chat, Search, and Research to match your workflow.</p>
      </div>

      <div className="empty-suggestions">
        {suggestions.map((suggestion, idx) => (
          <button
            key={idx}
            className="suggestion-chip"
            type="button"
            onClick={() => onPickSuggestion?.(suggestion.text)}
          >
            <span style={{ fontSize: '1.2rem' }}>{suggestion.icon}</span>
            <span>{suggestion.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
