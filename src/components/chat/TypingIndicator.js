'use client';

export default function TypingIndicator({ isSearching, isGenerating }) {
  const title = isSearching ? 'Searching the web' : isGenerating ? 'Generating answer' : 'Thinking';

  return (
    <div className="typing-shell" role="status" aria-live="polite">
      <div className="typing-indicator">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
      <span className="typing-label">{title}</span>
    </div>
  );
}
