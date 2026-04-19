'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Menu, Moon, Settings2, Sun } from 'lucide-react';

const modeOptions = [
  { value: 'chat', label: 'Chat' },
  { value: 'search', label: 'Search' },
  { value: 'research', label: 'Research' },
];

export default function ChatHeader({
  title,
  chatMode,
  onModeChange,
  modelMode,
  onModelModeChange,
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
  fallbackNotice,
  latencyMs,
  queryComplexity,
  deviceType,
}) {
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const isMobile = deviceType === 'mobile';
  const activeTabIndex = Math.max(
    0,
    modeOptions.findIndex((option) => option.value === chatMode)
  );

  useEffect(() => {
    if (!isMobile) {
      setMobileSettingsOpen(false);
    }
  }, [isMobile]);

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
          <button className="mobile-menu-btn" onClick={onOpenSidebar} type="button" aria-label="Open chats">
            <Menu size={18} strokeWidth={2.2} />
          </button>
          <div className="header-title-wrap">
            <div className="header-brand">
              <img src="/logo.png" alt="" aria-hidden="true" className="header-brand-logo" />
              <span>Arithmo AI</span>
            </div>
            <span className="chat-title">{title || 'New conversation'}</span>
          </div>
        </div>
        <div className="header-actions">
          {canExport && (
            <button
              className="glass-icon-btn"
              type="button"
              onClick={onExport}
              title="Export conversation"
              aria-label="Export conversation"
            >
              <Download size={16} />
            </button>
          )}
          <button
            className="glass-icon-btn"
            type="button"
            onClick={onToggleTheme}
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {isMobile && (
            <button
              className={`glass-icon-btn ${mobileSettingsOpen ? 'active' : ''}`}
              type="button"
              onClick={() => setMobileSettingsOpen((value) => !value)}
              title="Chat settings"
              aria-label="Chat settings"
              aria-expanded={mobileSettingsOpen}
            >
              <Settings2 size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="header-sub-row">
        <div
          className="mode-switch"
          role="tablist"
          aria-label="Conversation mode"
          style={{ '--mode-index': activeTabIndex }}
        >
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

        {!isMobile && (
          <div className="header-settings">
            <select
              className="model-select"
              value={modelMode}
              onChange={(event) => onModelModeChange(event.target.value)}
              disabled={isBusy}
              title="Model mode"
            >
              <option value="auto">🤖 Auto</option>
              <option value="fast">⚡ Fast (Groq)</option>
              <option value="smart">🧠 Smart (Gemini)</option>
              <option value="deep">🔬 Deep (NVIDIA)</option>
            </select>
          </div>
        )}

        <div className={`status-strip ${isMobile ? 'compact' : ''}`}>
          <span className={`status-badge ${isBusy ? 'thinking' : 'online'}`}>{status}</span>
          <span className="status-badge online">Using: {activeProvider}</span>
          {fallbackNotice && <span className="status-badge thinking">{fallbackNotice}</span>}
          {!isMobile && queryComplexity && <span className="status-badge online">Complexity: {queryComplexity}</span>}
          {!isMobile && latencyMs > 0 && <span className="status-badge online">{latencyMs}ms</span>}
          {!isMobile && ragUsed && <span className="status-badge online">Search: {searchProvider}</span>}
          {!isMobile && researchUsed && <span className="status-badge online">Research</span>}
        </div>
      </div>

      {isMobile && mobileSettingsOpen && (
        <div className="mobile-settings-panel">
          <select
            className="model-select"
            value={modelMode}
            onChange={(event) => onModelModeChange(event.target.value)}
            disabled={isBusy}
            title="Model mode"
          >
            <option value="auto">🤖 Auto</option>
            <option value="fast">⚡ Fast (Groq)</option>
            <option value="smart">🧠 Smart (Gemini)</option>
            <option value="deep">🔬 Deep (NVIDIA)</option>
          </select>
        </div>
      )}
    </header>
  );
}
