'use client';

import { useMemo } from 'react';

const modeOptions = [
  { value: 'chat', label: 'Chat' },
  { value: 'search', label: 'Search' },
  { value: 'research', label: 'Research' },
];

export default function ChatHeader({
  title,
  chatMode,
  onModeChange,
  provider,
  onProviderChange,
  responseMode,
  onResponseModeChange,
  isBusy,
  onOpenSidebar,
  theme,
  onToggleTheme,
  onExport,
  canExport,
  isSearching,
  isLoading,
  imageLoading,
  activeProvider,
  ragUsed,
  researchUsed,
  searchProvider,
}) {
  const status = useMemo(() => {
    if (isSearching) return 'Searching...';
    if (isLoading) return 'Thinking...';
    if (imageLoading) return 'Creating...';
    return 'Online';
  }, [isSearching, isLoading, imageLoading]);

  return (
    <header className="app-header">
      <div className="header-main-row">
        <div className="header-left">
          <button className="mobile-menu-btn" onClick={onOpenSidebar} type="button">
            ☰
          </button>
          <div className="header-title-wrap">
            <div className="header-brand">Arithmo AI</div>
            <span className="chat-title">{title || 'New conversation'}</span>
          </div>
        </div>
        <div className="header-actions">
          {canExport && (
            <button className="glass-icon-btn" type="button" onClick={onExport} title="Export conversation">
              ⤓
            </button>
          )}
          <button className="glass-icon-btn" type="button" onClick={onToggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </div>

      <div className="header-sub-row">
        <div className="mode-switch" role="tablist" aria-label="Conversation mode">
          {modeOptions.map((option) => (
            <button
              key={option.value}
              className={`mode-chip ${chatMode === option.value ? 'active' : ''}`}
              onClick={() => onModeChange(option.value)}
              type="button"
              role="tab"
              aria-selected={chatMode === option.value}
              disabled={isBusy}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="header-settings">
          <select
            className="model-select"
            value={provider}
            onChange={(event) => onProviderChange(event.target.value)}
            disabled={isBusy}
            title="AI provider"
          >
            <option value="auto">Auto</option>
            <option value="groq">Groq</option>
            <option value="gemini">Gemini</option>
            <option value="nvidia">NVIDIA</option>
          </select>
          <button
            className={`feature-toggle ${responseMode === 'deep' ? 'active' : ''}`}
            type="button"
            onClick={() => onResponseModeChange(responseMode === 'deep' ? 'speed' : 'deep')}
            disabled={isBusy}
          >
            🧠 Deep
          </button>
        </div>

        <div className="status-strip">
          <span className={`status-badge ${isBusy ? 'thinking' : 'online'}`}>{status}</span>
          <span className="status-badge online">Provider: {activeProvider}</span>
          {ragUsed && <span className="status-badge online">Search: {searchProvider}</span>}
          {researchUsed && <span className="status-badge online">Research</span>}
        </div>
      </div>
    </header>
  );
}
