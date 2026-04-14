'use client';

import { useMemo, useState } from 'react';

const PAGE_SIZE = 18;

export default function ChatSidebar({
  user,
  chats,
  activeChatId,
  renamingId,
  renameValue,
  onRenameValueChange,
  onSubmitRename,
  onCancelRename,
  onSelectChat,
  onStartRename,
  onDeleteChat,
  onCreateNewChat,
  onLogout,
  sidebarOpen,
  onCloseSidebar,
}) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const filteredChats = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return chats;
    return chats.filter((chat) => String(chat.title || '').toLowerCase().includes(normalized));
  }, [chats, query]);

  const visibleChats = useMemo(() => filteredChats.slice(0, limit), [filteredChats, limit]);
  const hasMore = filteredChats.length > limit;

  return (
    <>
      <div className={`mobile-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={onCloseSidebar} />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img src="/logo.png" alt="Arithmo" />
            <div>
              <h2>Arithmo AI</h2>
              <p>Conversations</p>
            </div>
          </div>
          <button className="new-chat-btn" onClick={onCreateNewChat} type="button">
            + New Chat
          </button>
          <input
            className="chat-search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(PAGE_SIZE);
            }}
            placeholder="Search chats"
          />
        </div>

        <div className="sidebar-chats">
          {visibleChats.map((chat) => (
            <div
              key={chat.id}
              className={`chat-item ${activeChatId === chat.id ? 'active' : ''}`}
              onClick={() => onSelectChat(chat.id)}
            >
              {renamingId === chat.id ? (
                <input
                  className="rename-input"
                  value={renameValue}
                  onChange={(event) => onRenameValueChange(event.target.value)}
                  onBlur={onSubmitRename}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onSubmitRename();
                    if (event.key === 'Escape') onCancelRename();
                  }}
                  autoFocus
                  onClick={(event) => event.stopPropagation()}
                />
              ) : (
                <>
                  <span className="chat-item-title">{chat.title}</span>
                  <div className="chat-item-actions">
                    <button
                      className="chat-action-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        onStartRename(chat);
                      }}
                      title="Rename"
                      type="button"
                    >
                      Rename
                    </button>
                    <button
                      className="chat-action-btn delete"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteChat(chat.id);
                      }}
                      title="Delete"
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          {visibleChats.length === 0 && (
            <p className="sidebar-empty">No chats found.</p>
          )}

          {hasMore && (
            <button className="load-more-btn" type="button" onClick={() => setLimit((value) => value + PAGE_SIZE)}>
              Load more
            </button>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">{(user?.name || user?.email || '?')[0]?.toUpperCase()}</div>
            <div className="user-info">
              <div className="user-name">{user?.name || 'Arithmo User'}</div>
              <div className="user-email">{user?.email || 'user@arithmo.ai'}</div>
            </div>
          </div>
          <button className="logout-btn" type="button" onClick={onLogout}>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
