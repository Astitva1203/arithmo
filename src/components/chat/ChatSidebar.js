'use client';

import { useMemo, useState } from 'react';
import { MessageSquare, Plus, Edit2, Trash2, Check, X, Search, LogOut } from 'lucide-react';

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
  const [deletingId, setDeletingId] = useState(null);

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
            <img src="/logo.png" alt="Arithmo AI logo" />
            <div>
              <h2>Arithmo AI</h2>
              <p>Conversations</p>
            </div>
          </div>
          <button className="new-chat-btn" onClick={onCreateNewChat} type="button">
            <Plus size={16} /> New Chat
          </button>
          
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="chat-search"
              style={{ paddingLeft: '32px' }}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setLimit(PAGE_SIZE);
              }}
              placeholder="Search chats..."
            />
          </div>
        </div>

        <div className="sidebar-chats">
          {visibleChats.map((chat) => (
            <div
              key={chat.id}
              className={`chat-item ${activeChatId === chat.id ? 'active' : ''}`}
              onClick={() => onSelectChat(chat.id)}
            >
              <MessageSquare size={16} style={{ minWidth: '16px', opacity: activeChatId === chat.id ? 1 : 0.6 }} />
              
              {renamingId === chat.id ? (
                <input
                  className="rename-input"
                  style={{ marginLeft: '4px' }}
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
              ) : deletingId === chat.id ? (
                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                   <span style={{ fontSize: '0.78rem', color: 'var(--warning)', fontWeight: 600 }}>Delete?</span>
                   <div style={{ display: 'flex', gap: '4px' }}>
                     <button
                       className="chat-action-btn"
                       onClick={(event) => {
                         event.stopPropagation();
                         onDeleteChat(chat.id);
                         setDeletingId(null);
                       }}
                       style={{ color: 'var(--error)' }}
                       type="button"
                     >
                       <Check size={14} />
                     </button>
                     <button
                       className="chat-action-btn"
                       onClick={(event) => {
                         event.stopPropagation();
                         setDeletingId(null);
                       }}
                       type="button"
                     >
                       <X size={14} />
                     </button>
                   </div>
                 </div>
              ) : (
                <>
                  <span className="chat-item-title" title={chat.title}>
                    {chat.title}
                  </span>
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
                      <Edit2 size={13} />
                    </button>
                    <button
                      className="chat-action-btn delete"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeletingId(chat.id);
                      }}
                      title="Delete"
                      type="button"
                    >
                      <Trash2 size={13} />
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
          <button className="logout-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} type="button" onClick={onLogout}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
