'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  Calculator,
  Code2,
  Image as ImageIcon,
  MessageSquare,
  Mic,
  MoreHorizontal,
  PenTool,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';

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

export default function EmptyState({
  user,
  chats,
  chatMode,
  deviceType,
  minimalVisuals,
  onSelectChat,
  onQuickAction,
  quickActionsExpanded,
  recentChatsExpanded,
  onToggleQuickActions,
  onToggleRecentChats,
  showChatTimestamps,
  input,
  onInputChange,
  onKeyDown,
  onSend,
  onAttachClick,
  onGenerateImage,
  onChatModeChange,
  composerMode,
  fileInputRef,
  onImageChange,
  selectedImage,
  onRemoveSelectedImage,
  onMic,
  isListening,
  micAvailable,
  isLoading,
  imageLoading,
}) {
  const isDesktop = deviceType === 'desktop';
  const firstName = user?.name ? user.name.split(' ')[0] : 'User';
  const showExtras = !minimalVisuals;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [menuOpen]);

  const chooseMode = (mode) => {
    onChatModeChange?.(mode);
    setMenuOpen(false);
  };
  const quickActions = [
    {
      id: 'image',
      title: 'AI Image',
      subtitle: 'Generate images with AI',
      icon: ImageIcon,
      tone: 'violet',
      mode: 'chat',
    },
    {
      id: 'solve',
      title: 'AI Solve',
      subtitle: 'Solve math and problems',
      icon: Calculator,
      tone: 'green',
      mode: 'search',
    },
    {
      id: 'write',
      title: 'AI Write',
      subtitle: 'Write anything with AI',
      icon: PenTool,
      tone: 'blue',
      mode: 'chat',
    },
    {
      id: 'code',
      title: 'AI Code',
      subtitle: 'Generate and debug code',
      icon: Code2,
      tone: 'amber',
      mode: 'chat',
    },
    {
      id: 'research',
      title: 'Research',
      subtitle: 'Deep web exploration',
      icon: MoreHorizontal,
      tone: 'blue',
      mode: 'research',
    },
    {
      id: 'new-chat',
      title: 'New Chat',
      subtitle: 'Start a fresh thread',
      icon: MessageSquare,
      tone: 'green',
      mode: 'chat',
    },
  ];

  const allRecentChats = Array.isArray(chats) ? chats : [];
  const recentChats = recentChatsExpanded ? allRecentChats : allRecentChats.slice(0, 4);
  const visibleQuickActions = quickActionsExpanded ? quickActions : quickActions.slice(0, 4);

  return (
    <div className={`empty-state-dashboard ${isDesktop ? 'desktop' : 'compact'}`}>
      <div className="empty-state-shell">
        <h2 className="greet-title">
          Hello, <span>{firstName}</span> <span className="wave-emoji" aria-hidden="true">&#128075;</span>
        </h2>
        <p className="greet-subtitle">How can I help you today?</p>

        <div className="ask-input-container">
          {selectedImage && (
            <div className="image-chip">
              <img src={selectedImage.dataUrl} alt={selectedImage.name || 'Attached image'} />
              <div className="image-chip-meta">
                <strong>{selectedImage.name}</strong>
              </div>
              <button className="image-remove-btn" onClick={onRemoveSelectedImage} type="button">
                X
              </button>
            </div>
          )}

          <div className="ask-input-row">
            <div className="attachment-menu-anchor hero" ref={menuRef}>
              <button
                className={`ask-mic-btn plus-btn ${menuOpen ? 'active' : ''}`}
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                disabled={isLoading || imageLoading}
                aria-label="Open attachment menu"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                {menuOpen ? <X size={18} /> : <Plus size={18} />}
              </button>

              {menuOpen && (
                <div className="attachment-menu-popup" role="menu">
                  <button
                    className={`tool-popup-btn mode-btn ${chatMode === 'chat' && composerMode !== 'image' ? 'active' : ''}`}
                    type="button"
                    onClick={() => chooseMode('chat')}
                    disabled={isLoading || imageLoading}
                    role="menuitem"
                  >
                    <MessageSquare size={18} /> <span>Chat Mode</span>
                  </button>
                  <button
                    className="tool-popup-btn"
                    type="button"
                    onClick={() => {
                      onAttachClick?.();
                      setMenuOpen(false);
                    }}
                    disabled={isLoading || imageLoading}
                    role="menuitem"
                  >
                    <ImageIcon size={18} /> <span>Attach Image</span>
                  </button>
                  <button
                    className={`tool-popup-btn mode-btn ${chatMode === 'search' && composerMode !== 'image' ? 'active' : ''}`}
                    type="button"
                    onClick={() => chooseMode('search')}
                    disabled={isLoading || imageLoading}
                    role="menuitem"
                  >
                    <Search size={18} /> <span>Search Mode</span>
                  </button>
                  <button
                    className={`tool-popup-btn mode-btn ${chatMode === 'research' && composerMode !== 'image' ? 'active' : ''}`}
                    type="button"
                    onClick={() => chooseMode('research')}
                    disabled={isLoading || imageLoading}
                    role="menuitem"
                  >
                    <BookOpen size={18} /> <span>Research Mode</span>
                  </button>
                  <button
                    className={`tool-popup-btn mode-btn ${composerMode === 'image' ? 'active' : ''}`}
                    type="button"
                    onClick={() => {
                      onGenerateImage?.();
                      setMenuOpen(false);
                    }}
                    disabled={isLoading || imageLoading}
                    role="menuitem"
                  >
                    <Sparkles size={18} /> <span>Create Image</span>
                  </button>
                </div>
              )}
            </div>

            <input
              type="text"
              className="ask-input"
              placeholder={composerMode === 'image' ? 'Describe the image you want...' : 'Ask anything...'}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={isLoading}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              hidden
              onChange={onImageChange}
            />
            <button
              className={`ask-mic-btn ${isListening ? 'listening' : ''}`}
              type="button"
              onClick={onMic}
              disabled={!micAvailable || isLoading}
            >
              <Mic size={18} />
            </button>
            <button
              className="ask-submit-btn"
              type="button"
              onClick={onSend}
              disabled={(!input?.trim() && !selectedImage) || isLoading}
            >
              <ArrowUp size={20} strokeWidth={3} />
            </button>
          </div>

          {showExtras && (
            <div className="action-buttons-row hero-actions">
              <button
                className="action-pill-btn"
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                disabled={isLoading || imageLoading}
              >
                <ImageIcon size={16} /> Image
              </button>
              <button className="action-pill-btn" type="button" onClick={() => onQuickAction?.('solve')}>
                <Calculator size={16} /> Solve
              </button>
              <button className="action-pill-btn" type="button" onClick={() => onQuickAction?.('write')}>
                <PenTool size={16} /> Write
              </button>
              <button className="action-pill-btn" type="button" onClick={() => onQuickAction?.('research')}>
                <MoreHorizontal size={16} /> More
              </button>
            </div>
          )}
        </div>

        {showExtras && (
          <>
            <div className="section-header">
              <div className="section-title">Quick Actions</div>
              <button type="button" className="section-link" onClick={onToggleQuickActions}>{quickActionsExpanded ? 'See less' : 'See all'}</button>
            </div>
            <div className="quick-action-list">
              {visibleQuickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    className="list-card"
                    key={action.id}
                    onClick={() => onQuickAction?.(action.id)}
                    type="button"
                    data-active={chatMode === action.mode ? 'true' : 'false'}
                  >
                    <div className={`list-card-icon-wrap ${action.tone}`}>
                      <Icon size={19} />
                    </div>
                    <div className="list-card-content">
                      <div className="list-card-title">{action.title}</div>
                      <div className="list-card-subtitle">{action.subtitle}</div>
                    </div>
                    <ArrowRight size={18} className="msg-icon" />
                  </button>
                );
              })}
            </div>

            <div className="section-header">
              <div className="section-title">Recent Chats</div>
              <button type="button" className="section-link" onClick={onToggleRecentChats}>{recentChatsExpanded ? 'See less' : 'See all'}</button>
            </div>
            <div className="recent-chat-list">
              {recentChats.length > 0 ? recentChats.map((chat) => (
                <button className="list-card recent" key={chat.id} onClick={() => onSelectChat?.(chat.id)} type="button">
                  <MessageSquare size={18} className="msg-icon" />
                  <div className="list-card-content recent-chat-content">
                    <div className="list-card-subtitle chat-title-row">{chat.title || 'Untitled chat'}</div>
                  </div>
                  {showChatTimestamps !== false && <span className="chat-time">{formatChatTimestamp(chat)}</span>}
                </button>
              )) : (
                <div className="empty-list">No chats yet</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
