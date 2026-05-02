'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, MessageSquare, Plus, Search, Settings, Trash2, X } from 'lucide-react';

function formatChatTimestamp(chat) {
  const rawValue = chat?.updatedAt || chat?.createdAt || chat?.timestamp;
  if (!rawValue) return '';

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return '';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86400000);

  if (dayDiff === 0) {
    return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (dayDiff === 1) {
    return 'Yesterday';
  }
  if (dayDiff > 1 && dayDiff < 7) {
    return `${dayDiff} days ago`;
  }

  return parsed.toLocaleDateString();
}

export default function ChatSidebar({
  user,
  chats,
  activeChatId,
  onSelectChat,
  onDeleteChat,
  onCreateNewChat,
  sidebarOpen,
  onCloseSidebar,
  onOpenSettings,
  deviceType,
  tabletOrientation,
  onToggleCollapse,
  isCollapsed,
  recentChatsExpanded,
  onToggleRecentChats,
  showChatTimestamps,
  onUpgradeClick,
}) {
  const isDesktop = deviceType === 'desktop';
  const isTablet = deviceType === 'tablet';
  const showFullSidebar = isDesktop || isTablet;
  const allRecentChats = Array.isArray(chats) ? chats : [];
  const userInitial = (user?.name || user?.email || 'A')[0]?.toUpperCase();
  const isPremium = Boolean(user?.isPremium || user?.isLifetime);
  const [chatSearch, setChatSearch] = useState('');
  const normalizedSearch = chatSearch.trim().toLowerCase();
  const filteredChats = useMemo(() => {
    if (!normalizedSearch) return allRecentChats;
    return allRecentChats.filter((chat) =>
      String(chat?.title || '').toLowerCase().includes(normalizedSearch)
    );
  }, [allRecentChats, normalizedSearch]);
  const recentChats = recentChatsExpanded ? filteredChats : filteredChats.slice(0, 4);

  // In portrait tablet mode, the overlay dims and blurs the background
  const isTabletPortraitOverlay = isTablet && tabletOrientation === 'portrait' && sidebarOpen;

  // ── COLLAPSED VIEW (Desktop only) ──
  // Ultra-minimal: Logo (toggle) → New Chat icon → Profile avatar
  if (isDesktop && isCollapsed) {
    return (
      <>
        <aside className="sidebar arithmo-sidebar collapsed">
          {/* Logo — acts as expand toggle */}
          <div className="collapsed-top">
            <button
              className="collapsed-logo-btn"
              type="button"
              aria-label="Expand sidebar"
              title="Expand sidebar"
              onClick={onToggleCollapse}
            >
              <img src="/logo.png" alt="Arithmo" />
            </button>
          </div>

          {/* New Chat — icon only */}
          <div className="collapsed-center">
            <button
              className="collapsed-icon-btn"
              type="button"
              aria-label="New Chat"
              title="New Chat"
              onClick={onCreateNewChat}
            >
              <Plus size={20} />
            </button>
          </div>

          {/* Profile — avatar only */}
          <div className="collapsed-bottom">
            <button
              className="collapsed-avatar-btn"
              type="button"
              aria-label="Profile & Settings"
              title="Profile & Settings"
              onClick={onOpenSettings}
            >
              {user?.avatar ? (
                <img src={user.avatar} alt={user?.name || 'User'} />
              ) : (
                userInitial
              )}
            </button>
          </div>
        </aside>
      </>
    );
  }

  // ── EXPANDED VIEW (Desktop, Tablet, Mobile) ──
  return (
    <>
      {/* Overlay: blur + dim in portrait tablet, standard dim for mobile */}
      <div
        className={`mobile-overlay ${sidebarOpen ? 'visible' : ''} ${isTabletPortraitOverlay ? 'tablet-portrait-overlay' : ''}`}
        onClick={onCloseSidebar}
      />
      <aside className={`sidebar arithmo-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="arithmo-sidebar-top">
          <div className="arithmo-brand-row">
            {isDesktop ? (
              <button
                className="arithmo-brand-toggle"
                type="button"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                onClick={onToggleCollapse}
              >
                <img src="/logo.png" alt="Arithmo" className="arithmo-brand-logo" />
                <h2>Arithmo</h2>
              </button>
            ) : (
              <>
                <img src="/logo.png" alt="Arithmo" className="arithmo-brand-logo" />
                <h2>Arithmo</h2>
              </>
            )}
          </div>
          {isTablet && (
            <button className="tablet-sidebar-close-btn" type="button" aria-label="Close sidebar" onClick={onCloseSidebar}>
              <X size={18} />
            </button>
          )}
        </div>

        <div className="arithmo-sidebar-scroll">

          <button
            type="button"
            className="arithmo-new-chat-btn"
            onClick={() => {
              onCreateNewChat?.();
              if (isTablet && tabletOrientation === 'portrait') {
                onCloseSidebar?.();
              }
            }}
          >
            <Plus size={15} />
            <span>New Chat</span>
          </button>

          {showFullSidebar && (
            <div className="arithmo-chat-search">
              <Search size={16} />
              <input
                type="text"
                value={chatSearch}
                onChange={(event) => setChatSearch(event.target.value)}
                placeholder="Search chats"
                aria-label="Search chats"
              />
            </div>
          )}

          {showFullSidebar && (
            <section className="arithmo-sidebar-section chat-history">
              <div className="arithmo-section-head">
                <h3>Recent Chats</h3>
                <button type="button" onClick={onToggleRecentChats}>{recentChatsExpanded ? 'See less' : 'See all'}</button>
              </div>

              <div className="arithmo-recent-list">
                {recentChats.length > 0 ? (
                  recentChats.map((chat) => (
                    <div className={`arithmo-recent-row ${activeChatId === chat.id ? 'active' : ''}`} key={chat.id}>
                      <button
                        className="arithmo-recent-select"
                        onClick={() => {
                          onSelectChat?.(chat.id);
                          if (isTablet && tabletOrientation === 'portrait') {
                            onCloseSidebar?.();
                          }
                        }}
                        type="button"
                      >
                        <MessageSquare size={14} />
                        <span>{chat.title || 'Untitled chat'}</span>
                        {showChatTimestamps !== false && <small>{formatChatTimestamp(chat)}</small>}
                      </button>
                      <button
                        className="arithmo-recent-delete"
                        type="button"
                        aria-label={`Delete ${chat.title || 'chat'}`}
                        onClick={() => onDeleteChat?.(chat.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="arithmo-empty-history">No recent chats</div>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="arithmo-sidebar-footer">
          {!isPremium && (
            <button className="arithmo-sidebar-upgrade" type="button" onClick={onUpgradeClick}>
              <span>Upgrade to Pro</span>
              <small>Unlock Deep Mode and higher limits</small>
            </button>
          )}

          {user?.isLifetime && (
            <div className="arithmo-sidebar-plan lifetime">Lifetime access active</div>
          )}
          {!user?.isLifetime && user?.isPremium && (
            <div className="arithmo-sidebar-plan pro">Pro access active</div>
          )}

          <button className="arithmo-settings-link" onClick={onOpenSettings} type="button">
            <Settings size={18} /> Settings
          </button>

          <button className="arithmo-profile-row" onClick={onOpenSettings} type="button">
            <span className="arithmo-profile-main">
              <span className="arithmo-profile-avatar">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user?.name || 'User'} />
                ) : (
                  userInitial
                )}
              </span>
              <span className="arithmo-profile-text">
                <strong>{user?.name || 'User'}</strong>
                {showFullSidebar && <small>{user?.email || 'Free access'}</small>}
              </span>
            </span>
            <ChevronDown size={14} />
          </button>
        </div>
      </aside>
    </>
  );
}
