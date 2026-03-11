import { memo, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, LogOut, Pencil, Pin, Plus, Search, Settings, Sparkles, Trash2 } from "lucide-react";
import { Logo } from "./Logo";

export const ChatSidebar = memo(function ChatSidebar({
  chats,
  currentChatId,
  onSelect,
  onDelete,
  onNewChat,
  onRename,
  onSearch,
  onSettings,
  onOpenPromptLibrary,
  onLogout,
  pinnedMessages = [],
  bookmarkedChats = [],
  user,
  className = ""
}) {
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);
  const filteredChats = useMemo(() => chats, [chats]);
  const initials = (user?.name || "A")
    .split(" ")
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    const focusSearch = () => searchRef.current?.focus();
    window.addEventListener("arithmo-focus-search", focusSearch);
    return () => window.removeEventListener("arithmo-focus-search", focusSearch);
  }, []);

  return (
    <aside className={`glass-sidebar flex h-full min-h-[calc(100vh-1.5rem)] w-full flex-col rounded-3xl p-4 ${className}`}>
      <div className="mb-4">
        <Logo />
      </div>

      <button
        onClick={onNewChat}
        className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/30 bg-gradient-to-r from-cyan-300/60 via-indigo-300/55 to-pink-300/60 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg transition hover:brightness-105 dark:from-cyan-500/30 dark:via-violet-500/30 dark:to-fuchsia-500/30 dark:text-white"
      >
        <Plus size={15} /> New Chat
      </button>

      <div className="mb-3 flex items-center gap-2 rounded-2xl border border-white/25 bg-white/20 px-3 py-2 backdrop-blur-xl dark:bg-slate-900/35">
        <Search size={14} className="opacity-70" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            onSearch?.(next);
          }}
          placeholder="Search conversations"
          className="w-full bg-transparent text-sm outline-none placeholder:opacity-60"
        />
      </div>

      <div className="hide-scrollbar flex-1 space-y-2 overflow-y-auto">
        {!!bookmarkedChats.length && (
          <div className="rounded-xl border border-white/20 bg-white/15 p-2">
            <p className="mb-2 text-xs font-semibold opacity-75">Bookmarked Chats</p>
            <div className="space-y-1">
              {bookmarkedChats.map((chat) => (
                <button
                  key={`bm-${chat._id}`}
                  onClick={() => onSelect(chat._id)}
                  className="inline-flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs hover:bg-white/20"
                >
                  <Bookmark size={12} className="text-cyan-500" />
                  <span className="truncate">{chat.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!!pinnedMessages.length && (
          <div className="rounded-xl border border-white/20 bg-white/15 p-2">
            <p className="mb-2 text-xs font-semibold opacity-75">Pinned Messages</p>
            <div className="space-y-1">
              {pinnedMessages.slice(0, 6).map((pin) => (
                <button
                  key={pin._id}
                  onClick={() => onSelect(pin.chatId)}
                  className="inline-flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs hover:bg-white/20"
                >
                  <Pin size={12} className="text-cyan-500" />
                  <span className="truncate">{pin.content}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {filteredChats.map((chat) => (
          <motion.div
            key={chat._id}
            whileHover={{ scale: 1.01 }}
            className={`group flex items-center justify-between rounded-2xl border p-2 text-sm ${
              currentChatId === chat._id
                ? "border-white/40 bg-white/30 dark:border-slate-500/60 dark:bg-slate-800/55"
                : "border-transparent bg-white/10 hover:border-white/25 hover:bg-white/20 dark:bg-slate-900/25 dark:hover:bg-slate-800/35"
            }`}
          >
            <button onClick={() => onSelect(chat._id)} className="w-full text-left">
              <p className="truncate font-medium">{chat.title || "Untitled Chat"}</p>
              <p className="text-xs opacity-70">{chat.mode}</p>
            </button>
            <div className="ml-2 flex items-center gap-1 opacity-70 transition group-hover:opacity-100">
              <button onClick={() => onRename(chat)} className="rounded-lg p-1 hover:bg-white/30" title="Rename chat">
                <Pencil size={14} />
              </button>
              <button onClick={() => onDelete(chat._id)} className="rounded-lg p-1 hover:bg-red-500/20" title="Delete chat">
                <Trash2 size={14} />
              </button>
            </div>
          </motion.div>
        ))}
        {!filteredChats.length && <p className="px-2 py-1 text-xs opacity-70">No chats found</p>}
      </div>

      <div className="mt-4 space-y-2 border-t border-white/20 pt-3">
        <button
          onClick={onSettings}
          className="inline-flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-white/20 dark:hover:bg-slate-800/45"
        >
          <Settings size={15} /> Settings
        </button>
        <button
          onClick={onOpenPromptLibrary}
          className="inline-flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-white/20 dark:hover:bg-slate-800/45"
        >
          <Sparkles size={15} /> Prompt Library
        </button>
        <div className="glass-panel flex items-center justify-between rounded-2xl p-2">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-cyan-300/70 via-violet-300/70 to-pink-300/70 text-xs font-bold text-slate-900 dark:from-cyan-500/40 dark:via-violet-500/40 dark:to-fuchsia-500/40 dark:text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.name || "Arithmo User"}</p>
              <p className="truncate text-xs opacity-70">{user?.email || ""}</p>
            </div>
          </div>
          <button onClick={onLogout} className="rounded-lg p-2 hover:bg-white/20" title="Logout">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
});
