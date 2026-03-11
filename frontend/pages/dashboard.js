import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/router";
import { Bookmark, Download, Globe, Keyboard, Menu, RotateCcw, Square, TerminalSquare, X } from "lucide-react";
import toast from "react-hot-toast";
import { ChatComposer } from "../components/ChatComposer";
import { ChatSidebar } from "../components/ChatSidebar";
import { OnboardingTour } from "../components/OnboardingTour";
import { ModeSelect } from "../components/ModeSelect";
import { StatusIndicator } from "../components/StatusIndicator";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button } from "../components/ui/button";
import { useAuthStore } from "../hooks/useAuthStore";
import { useChatStore } from "../hooks/useChatStore";
import { useSpeech } from "../hooks/useSpeech";
import { useTheme } from "../hooks/useTheme";
import { promptTemplates } from "../data/promptTemplates";
import { api, API_BASE } from "../utils/api";

const MessageBubble = dynamic(
  () => import("../components/MessageBubble").then((mod) => mod.MessageBubble),
  { ssr: false }
);

export default function Dashboard() {
  const router = useRouter();
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const micButtonRef = useRef(null);
  const fileButtonRef = useRef(null);
  const templateWrapRef = useRef(null);
  const streamUpdateRef = useRef({ at: 0, text: "" });
  const searchTimeoutRef = useRef(null);
  const abortRef = useRef(null);
  const { user, logout, hydrate, updateUser } = useAuthStore();
  const { chats, setChats, addOrUpdateChat, currentChatId, setCurrentChat, removeChat, mode, setMode } = useChatStore();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [hasStreamStarted, setHasStreamStarted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarChats, setSidebarChats] = useState([]);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [customPrompts, setCustomPrompts] = useState([]);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [exportFormat, setExportFormat] = useState("md");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [status, setStatus] = useState("offline");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const { dark, toggleTheme } = useTheme();
  const cacheKey = `arithmo_chat_history_${user?.id || "guest"}`;

  const friendlyError = () => "Something went wrong. Please try again.";

  const currentChat = useMemo(() => chats.find((c) => c._id === currentChatId) || null, [chats, currentChatId]);
  const bookmarkedChats = useMemo(() => chats.filter((chat) => chat.isBookmarked), [chats]);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await api.get("/chat/history");
      setChats(data);
      setSidebarChats(data);
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
      if (!currentChatId && data[0]) setCurrentChat(data[0]._id);
    } catch {
      toast.error(friendlyError());
    }
  }, [cacheKey, currentChatId, setChats, setCurrentChat]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const token = localStorage.getItem("arithmo_token");
    if (!token) router.replace("/signin");
  }, [router]);

  useEffect(() => {
    if (user) loadHistory();
  }, [user, loadHistory]);

  useEffect(() => {
    const syncUser = async () => {
      if (!localStorage.getItem("arithmo_token")) return;
      try {
        const { data } = await api.get("/auth/me");
        updateUser(data.user);
      } catch {
        // ignore
      }
    };
    syncUser();
  }, [updateUser]);

  const loadPinnedMessages = useCallback(async () => {
    try {
      const { data } = await api.get("/pins");
      setPinnedMessages(data);
    } catch {
      setPinnedMessages([]);
    }
  }, []);

  const loadCustomPrompts = useCallback(async () => {
    try {
      const { data } = await api.get("/prompts");
      setCustomPrompts(data || []);
    } catch {
      setCustomPrompts([]);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadPinnedMessages();
      loadCustomPrompts();
      setOnboardingOpen(!user.hasCompletedOnboarding);
    }
  }, [loadCustomPrompts, loadPinnedMessages, user]);

  useEffect(() => {
    const checkStatus = async () => {
      const start = Date.now();
      try {
        await api.get("/health");
        const latency = Date.now() - start;
        setStatus(latency > 1200 ? "slow" : "online");
      } catch {
        setStatus("offline");
      }
    };
    checkStatus();
    const t = setInterval(checkStatus, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length) {
          setChats(parsed);
          setSidebarChats(parsed);
          if (!currentChatId && parsed[0]) setCurrentChat(parsed[0]._id);
        }
      } catch {
        sessionStorage.removeItem(cacheKey);
      }
    }
  }, [cacheKey, currentChatId, setChats, setCurrentChat]);

  useEffect(() => {
    setSidebarChats(chats);
  }, [chats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChat?.messages?.length, loading, streamText]);

  useEffect(() => {
    const onSlash = (e) => {
      if (e.key === "/" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSidebarOpen(true);
        window.dispatchEvent(new Event("arithmo-focus-search"));
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNew();
      }
    };
    window.addEventListener("keydown", onSlash);
    return () => window.removeEventListener("keydown", onSlash);
  }, []);

  useEffect(() => () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
  }, []);

  const handleVoiceResult = (transcript) => {
    setInput(transcript);
    setTimeout(() => {
      sendMessage(transcript);
    }, 50);
  };

  const { isListening, isSupported, startListening, stopListening, speak } = useSpeech({ onResult: handleVoiceResult });

  const handleMic = () => {
    if (!isSupported) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }
    if (isListening) {
      stopListening();
      return;
    }
    startListening();
  };

  const stopGenerating = () => {
    abortRef.current?.abort();
    setLoading(false);
    setStreamText("");
    toast("Generation stopped");
  };

  const sendMessage = async (forcedText) => {
    const text = (forcedText ?? input).trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);
    setStreamText("");
    setHasStreamStarted(false);

    const optimisticUser = { role: "user", content: text, timestamp: new Date().toISOString() };
    const baseId = currentChatId || `temp-${Date.now()}`;

    const optimisticChat = currentChat
      ? { ...currentChat, messages: [...currentChat.messages, optimisticUser] }
      : {
          _id: baseId,
          title: text.slice(0, 60),
          mode,
          messages: [optimisticUser],
          updatedAt: new Date().toISOString()
        };

    addOrUpdateChat(optimisticChat);

    try {
      const token = localStorage.getItem("arithmo_token");
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch(`${API_BASE}/api/chat/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...(currentChatId ? { chatId: currentChatId } : {}),
          content: text,
          mode,
          useWebSearch,
          stream: true
        }),
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || friendlyError());
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assembled = "";
      let serverChatId = currentChatId;
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const event of events) {
          if (!event.startsWith("data: ")) continue;
          const payload = JSON.parse(event.replace("data: ", ""));
          if (payload.token) {
            setHasStreamStarted(true);
            assembled += payload.token;
            const now = Date.now();
            if (now - streamUpdateRef.current.at > 35) {
              streamUpdateRef.current = { at: now, text: assembled };
              setStreamText(assembled);
            }
          }
          if (payload.chatId) serverChatId = payload.chatId;
        }
      }

      setStreamText(assembled);
      if (assembled) speak(assembled);
      await loadHistory();
      if (serverChatId) setCurrentChat(serverChatId);
      setStreamText("");
    } catch (error) {
      if (error.name !== "AbortError") {
        toast.error(error.message || friendlyError());
      }
      await loadHistory();
      setStreamText("");
    } finally {
      abortRef.current = null;
      setLoading(false);
      setHasStreamStarted(false);
    }
  };

  const regenerate = async () => {
    if (!currentChatId || loading) return;
    try {
      setLoading(true);
      await api.post(`/chat/${currentChatId}/regenerate`);
      await loadHistory();
      toast.success("Response regenerated");
    } catch {
      toast.error(friendlyError());
    } finally {
      setLoading(false);
    }
  };

  const renameChat = async (chat) => {
    const nextTitle = prompt("Rename chat", chat.title || "Untitled Chat");
    if (!nextTitle || !nextTitle.trim()) return;
    try {
      await api.patch(`/chat/${chat._id}/title`, { title: nextTitle.trim() });
      await loadHistory();
      toast.success("Chat renamed");
    } catch {
      toast.error(friendlyError());
    }
  };

  const exportCurrentChat = () => {
    if (!currentChat) {
      toast.error("No active chat to export");
      return;
    }

    const token = localStorage.getItem("arithmo_token");
    fetch(`${API_BASE}/api/chat/export/${currentChat._id}?format=${exportFormat}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Export failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${(currentChat.title || "arithmo-chat").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase()}.${exportFormat}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error("Export failed"));
  };

  const handleDelete = async (chatId) => {
    try {
      await api.delete(`/chat/${chatId}`);
      removeChat(chatId);
      setSidebarChats((prev) => prev.filter((item) => item._id !== chatId));
      toast.success("Chat deleted");
    } catch {
      toast.error(friendlyError());
    }
  };

  const toggleBookmark = async () => {
    if (!currentChatId) return;
    try {
      const current = chats.find((c) => c._id === currentChatId);
      await api.patch(`/chat/${currentChatId}/bookmark`, { isBookmarked: !current?.isBookmarked });
      await loadHistory();
    } catch {
      toast.error(friendlyError());
    }
  };

  const handleNew = () => {
    setCurrentChat(null);
    setInput("");
    setSidebarOpen(false);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append("file", file);
    if (currentChatId) form.append("chatId", currentChatId);
    form.append("mode", mode);

    try {
      setLoading(true);
      if (input.trim()) form.append("prompt", input.trim());
      const { data } = await api.post("/files/analyze", form, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      toast.success("File analysis ready");
      if (data.chatId) setCurrentChat(data.chatId);
      await loadHistory();
    } catch {
      toast.error(friendlyError());
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleImage = async (e) => {
    const image = e.target.files?.[0];
    if (!image) return;

    const form = new FormData();
    form.append("image", image);
    if (currentChatId) form.append("chatId", currentChatId);
    form.append("mode", mode);
    if (input.trim()) form.append("prompt", input.trim());

    try {
      setLoading(true);
      const { data } = await api.post("/files/analyze-image", form, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success("Image analysis ready");
      if (data.chatId) setCurrentChat(data.chatId);
      await loadHistory();
    } catch {
      toast.error(friendlyError());
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleSearch = useCallback(
    (query) => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(async () => {
        const trimmed = query.trim();
        if (!trimmed) {
          setSidebarChats(chats);
          return;
        }
        try {
          const { data } = await api.get("/chat/search", { params: { q: trimmed } });
          setSidebarChats(data);
        } catch {
          toast.error(friendlyError());
        }
      }, 220);
    },
    [chats]
  );

  const copyText = async (text) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const startEditingMessage = (msg) => {
    setEditingMessageId(msg._id);
    setEditingText(msg.content);
  };

  const submitEdit = async () => {
    if (!editingMessageId || !currentChatId || !editingText.trim()) return;
    try {
      await api.patch(`/chat/${currentChatId}/message/${editingMessageId}`, { content: editingText.trim() });
      setEditingMessageId(null);
      setEditingText("");
      await loadHistory();
    } catch {
      toast.error(friendlyError());
    }
  };

  const handlePinMessage = async (msg) => {
    try {
      const exists = pinnedMessages.find((p) => p.messageId === msg._id);
      if (exists) {
        await api.delete(`/pins/${exists._id}`);
      } else {
        await api.post("/pins", {
          messageId: msg._id,
          chatId: currentChatId,
          content: msg.content
        });
      }
      await loadPinnedMessages();
    } catch {
      toast.error(friendlyError());
    }
  };

  const finishOnboarding = async (completed = true) => {
    try {
      const { data } = await api.post("/auth/onboarding", { completed });
      updateUser(data.user);
    } catch {
      // no-op
    } finally {
      setOnboardingOpen(false);
      setOnboardingStep(0);
    }
  };

  const onboardingTargets = useMemo(
    () => ({
      input: inputRef.current,
      voice: micButtonRef.current,
      file: fileButtonRef.current,
      templates: templateWrapRef.current
    }),
    [inputRef.current, micButtonRef.current, fileButtonRef.current, templateWrapRef.current]
  );

  return (
    <main className="h-screen overflow-hidden p-3">
      <div className="mx-auto flex h-full max-w-[1600px] gap-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="glass-panel fixed left-3 top-3 z-40 rounded-xl p-2 md:hidden"
          onClick={() => setSidebarOpen((s) => !s)}
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </motion.button>

        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ x: -18, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -18, opacity: 0 }}
              className="fixed inset-y-3 left-3 z-30 w-[290px] md:hidden"
            >
              <ChatSidebar
                chats={sidebarChats}
                currentChatId={currentChatId}
                pinnedMessages={pinnedMessages}
                bookmarkedChats={bookmarkedChats}
                user={user}
                onSelect={(id) => {
                  setCurrentChat(id);
                  setSidebarOpen(false);
                }}
                onDelete={handleDelete}
                onNewChat={handleNew}
                onRename={renameChat}
                onSearch={handleSearch}
                onSettings={() => router.push("/settings")}
                onOpenPromptLibrary={() => router.push("/prompt-library")}
                onLogout={() => {
                  logout();
                  router.push("/signin");
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="hidden w-[300px] shrink-0 md:block">
          <ChatSidebar
            chats={sidebarChats}
            currentChatId={currentChatId}
            pinnedMessages={pinnedMessages}
            bookmarkedChats={bookmarkedChats}
            user={user}
            onSelect={setCurrentChat}
            onDelete={handleDelete}
            onNewChat={handleNew}
            onRename={renameChat}
            onSearch={handleSearch}
            onSettings={() => router.push("/settings")}
            onOpenPromptLibrary={() => router.push("/prompt-library")}
            onLogout={() => {
              logout();
              router.push("/signin");
            }}
          />
        </div>

        <section className="glass-panel relative flex h-full min-w-0 flex-1 flex-col rounded-3xl border border-white/30 px-3 pb-3 pt-2 md:px-5 md:pb-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-white/20 pb-2">
            <div className="ml-10 flex items-center gap-2 md:ml-0">
              <ModeSelect mode={mode} onChange={setMode} />
              <StatusIndicator status={status} />
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setUseWebSearch((prev) => !prev)}
                className={`rounded-xl p-2 text-xs ${useWebSearch ? "bg-cyan-500 text-white" : "bg-white/30 dark:bg-slate-800/40"}`}
                title="Internet Search Mode"
              >
                <span className="inline-flex items-center gap-1">
                  <Globe size={14} /> Web
                </span>
              </motion.button>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" className="hidden sm:inline-flex" onClick={() => router.push("/playground")}>
                <span className="inline-flex items-center gap-1"><TerminalSquare size={15} /> Playground</span>
              </Button>
              <ThemeToggle dark={dark} onToggle={toggleTheme} />
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowShortcuts((prev) => !prev)}
                className="rounded-xl bg-white/30 p-2 text-xs"
                title="Keyboard shortcuts"
              >
                <Keyboard size={14} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={regenerate}
                disabled={!currentChatId || loading}
                className="rounded-xl bg-white/30 px-3 py-2 text-xs disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-1"><RotateCcw size={13} /> Regenerate</span>
              </motion.button>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className="rounded-xl border border-white/30 bg-white/30 px-2 py-2 text-xs dark:bg-slate-900/35"
                title="Export format"
              >
                <option value="md">Markdown</option>
                <option value="txt">TXT</option>
                <option value="pdf">PDF</option>
              </select>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={exportCurrentChat}
                disabled={!currentChatId}
                className="rounded-xl bg-white/30 px-3 py-2 text-xs disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-1"><Download size={13} /> Export</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={toggleBookmark}
                disabled={!currentChatId}
                className="rounded-xl bg-white/30 p-2 text-xs disabled:opacity-50"
                title="Bookmark chat"
              >
                <Bookmark size={14} className={currentChat?.isBookmarked ? "text-cyan-500" : ""} />
              </motion.button>
              {loading && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={stopGenerating}
                  className="rounded-xl bg-rose-500/85 px-3 py-2 text-xs text-white"
                >
                  <span className="inline-flex items-center gap-1"><Square size={12} /> Stop</span>
                </motion.button>
              )}
            </div>
          </div>

          {showShortcuts && (
            <div className="mb-2 rounded-2xl border border-white/25 bg-white/20 p-3 text-xs backdrop-blur-xl dark:bg-slate-900/35">
              <p><strong>Shortcuts:</strong> `Enter` send, `Shift+Enter` new line, `Ctrl+K` search chats, `Ctrl+N` new chat, `/` focus input.</p>
            </div>
          )}

          <div className="hide-scrollbar flex-1 space-y-4 overflow-y-auto px-1 pb-36 pt-2 md:px-2">
            {editingMessageId && (
              <div className="glass-panel rounded-2xl border border-white/25 p-3">
                <p className="mb-2 text-xs font-semibold opacity-75">Editing message</p>
                <textarea
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  className="min-h-20 w-full rounded-xl border border-white/30 bg-white/20 p-2 text-sm outline-none dark:bg-slate-900/35"
                />
                <div className="mt-2 flex gap-2">
                  <Button onClick={submitEdit}>Save & Regenerate</Button>
                  <Button variant="ghost" onClick={() => setEditingMessageId(null)}>Cancel</Button>
                </div>
              </div>
            )}
            {!currentChat?.messages?.length && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto mt-12 max-w-xl text-center"
              >
                <h2 className="text-2xl font-semibold md:text-3xl">What can I help with today?</h2>
                <p className="mt-2 text-sm opacity-75">Ask anything, upload files or images, and switch AI modes instantly.</p>
              </motion.div>
            )}

            <AnimatePresence>
              {(currentChat?.messages || []).map((msg, idx) => (
                <motion.div key={`${idx}-${msg.timestamp}`}>
                  <MessageBubble
                    msg={msg}
                    onCopy={copyText}
                    onPin={handlePinMessage}
                    onRegenerate={regenerate}
                    onEdit={startEditingMessage}
                    isPinned={!!pinnedMessages.find((p) => p.messageId === msg._id)}
                    canRegenerate={idx === (currentChat?.messages?.length || 1) - 1}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <div>
                {hasStreamStarted && streamText ? (
                  <MessageBubble
                    msg={{
                      role: "assistant",
                      content: streamText,
                      timestamp: new Date().toISOString()
                    }}
                    onCopy={copyText}
                  />
                ) : (
                  <div className="typing-indicator glass-panel inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-xs">
                    <span />
                    <span />
                    <span />
                    <span>Arithmo is thinking...</span>
                  </div>
                )}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="absolute bottom-2 left-2 right-2 md:bottom-3 md:left-3 md:right-3">
            <ChatComposer
              inputRef={inputRef}
              value={input}
              onChange={setInput}
              onSend={() => sendMessage()}
              loading={loading}
              isListening={isListening}
              onMic={handleMic}
              onStopMic={handleMic}
              onFile={handleFile}
              onImage={handleImage}
              templates={[...promptTemplates, ...customPrompts.map((p) => p.promptText)]}
              onTemplateClick={(template) => {
                setInput(template);
                inputRef.current?.focus();
              }}
              inputWrapperRef={inputRef}
              micButtonRef={micButtonRef}
              fileButtonRef={fileButtonRef}
              templateWrapRef={templateWrapRef}
            />
          </div>
        </section>
      </div>

      <OnboardingTour
        open={onboardingOpen}
        step={onboardingStep}
        targets={onboardingTargets}
        onNext={() => {
          if (onboardingStep >= 3) {
            finishOnboarding(true);
            return;
          }
          setOnboardingStep((s) => s + 1);
        }}
        onClose={() => finishOnboarding(true)}
      />
    </main>
  );
}
