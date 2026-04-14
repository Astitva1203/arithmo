'use client';

const suggestions = [
  'Explain quantum computing simply',
  'Write a Python sorting algorithm',
  'Solve: integral of x^2 from 0 to 5',
  'Help me debug my React code',
];

export default function EmptyState({ onPickSuggestion }) {
  return (
    <div className="empty-state">
      <div className="empty-state-orb" />
      <h2>What can I help you discover?</h2>
      <p>Switch between Chat, Search, and Research to match your workflow.</p>
      <div className="empty-suggestions">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            className="suggestion-chip"
            type="button"
            onClick={() => onPickSuggestion?.(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
