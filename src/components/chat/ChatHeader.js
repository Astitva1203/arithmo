'use client';

import { Bell, Plus } from 'lucide-react';

function modelModeLabel(value) {
  const normalized = String(value || 'auto').toLowerCase();
  if (normalized === 'fast') return 'Fast';
  if (normalized === 'smart') return 'Smart';
  if (normalized === 'deep') return 'Deep';
  return 'Auto';
}

export default function ChatHeader({
  deviceType,
  tabletOrientation,
  onOpenSidebar,
  onToggleSidebar,
  sidebarOpen,
  user,
  onOpenSettings,
  onOpenNotifications,
  onCreateNewChat,
  modelMode,
  onCycleModelMode,
  theme,
  onToggleTheme,
  notificationCount,
  onUpgradeClick,
}) {
  const isDesktop = deviceType === 'desktop';
  const initial = (user?.name || user?.email || 'A')[0]?.toUpperCase();
  const isPremium = Boolean(user?.isPremium || user?.isLifetime);

  if (isDesktop) {
    return (
      <header className="arithmo-desktop-header">
        <div className="arithmo-desktop-header-spacer" />

        <div className="arithmo-desktop-header-actions">
          <button className="arithmo-header-pill" type="button" onClick={onCreateNewChat}>
            <Plus size={14} /> New Chat
          </button>

          {!isPremium && (
            <button className="arithmo-header-pill arithmo-upgrade-pill" type="button" onClick={onUpgradeClick}>
              Upgrade
            </button>
          )}

          {user?.isLifetime && <span className="arithmo-plan-badge lifetime">Lifetime</span>}
          {!user?.isLifetime && user?.isPremium && <span className="arithmo-plan-badge pro">Pro</span>}

          <button
            className="arithmo-header-pill arithmo-model-pill"
            type="button"
            onClick={onCycleModelMode}
            aria-label="Switch model mode"
            title="Switch model mode"
          >
            <span>Model:</span> <strong>{modelModeLabel(modelMode)}</strong>
          </button>

          <button className="arithmo-header-circle" type="button" aria-label="Notifications" onClick={onOpenNotifications}>
            <Bell size={15} />
            {notificationCount > 0 && <span className="arithmo-dot-indicator" />}
          </button>

          <button className="arithmo-header-avatar" type="button" aria-label="Account settings" onClick={onOpenSettings}>
            {user?.avatar ? <img src={user.avatar} alt="User" /> : <span>{initial}</span>}
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="arithmo-mobile-header">
      <div className="arithmo-mobile-header-top">
        <div className="arithmo-mobile-header-left">
          <button
            className={`arithmo-mobile-brand sidebar-logo-toggle ${sidebarOpen ? 'active' : ''}`}
            onClick={onToggleSidebar || onOpenSidebar}
            type="button"
            aria-label={sidebarOpen ? 'Close chat history' : 'Open chat history'}
          >
            <img src="/logo.png" alt="Arithmo Logo" />
            <span>Arithmo</span>
          </button>
        </div>

        <div className="arithmo-mobile-header-actions">
          <button
            className="arithmo-header-pill arithmo-model-pill mobile"
            type="button"
            onClick={onCycleModelMode}
            aria-label="Switch model mode"
          >
            {modelModeLabel(modelMode)}
          </button>

          {!isPremium && (
            <button className="arithmo-header-pill arithmo-upgrade-pill mobile" type="button" onClick={onUpgradeClick}>
              Upgrade
            </button>
          )}

          <button className="arithmo-header-circle" type="button" aria-label="New chat" onClick={onCreateNewChat}>
            <Plus size={14} />
          </button>

          <button className="arithmo-mobile-avatar" type="button" onClick={onOpenSettings} aria-label="Open profile settings">
            {user?.avatar ? <img src={user.avatar} alt="User" /> : initial}
          </button>
        </div>
      </div>
    </header>
  );
}
