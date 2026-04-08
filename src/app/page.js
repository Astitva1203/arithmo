'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useTheme } from '@/components/ThemeProvider';

function createId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const MAX_ATTACH_IMAGE_SIZE = 4 * 1024 * 1024;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected file.'));
    reader.readAsDataURL(file);
  });
}

/* ===== KATEX RENDERING ===== */
function renderLatex(text) {
  if (typeof window === 'undefined' || typeof text !== 'string') return text;
  try {
    const katex = require('katex');
    // Display math $$...$$
    let result = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
      } catch { return _; }
    });
    // Inline math $...$
    result = result.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
      } catch { return _; }
    });
    return result;
  } catch { return text; }
}

/* ===== CODE BLOCK ===== */
function CodeBlock({ className, children, inline, ...props }) {
  const match = /language-(\w+)/.exec(className || '');
  const [copied, setCopied] = useState(false);
  const lang = match?.[1] || 'text';
  const code = String(children).replace(/\n$/, '');

  if (inline) {
    return <code className={className} {...props}>{children}</code>;
  }

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="code-block-wrap">
      <div className="code-block-header">
        <span className="code-lang">{lang}</span>
        <button className="code-copy-btn" onClick={handleCopy}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={lang}
        PreTag="div"
        customStyle={{ margin: 0, borderRadius: '0 0 14px 14px' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

/* ===== MESSAGE COMPONENT ===== */
function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const imageSrc = message.imageDataUrl || message.imageUrl || '';

  function handleCopy() {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className={`msg-row ${isUser ? 'user' : 'assistant'}`}>
      <div className={`msg-bubble ${isUser ? 'user' : 'assistant'}`}>
        {imageSrc && (
          <div className="msg-image-wrap">
            <img src={imageSrc} alt={isUser ? 'Attached image' : 'Generated image'} />
          </div>
        )}
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code: CodeBlock,
              p: ({ children }) => {
                if (typeof children === 'string') {
                  return <p dangerouslySetInnerHTML={{ __html: renderLatex(children) }} />;
                }
                return <p>{children}</p>;
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
        <div className="msg-meta">
          <span className="msg-time">{formatTime(message.timestamp)}</span>
          {!isUser && (
            <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== MAIN PAGE ===== */
export default function HomePage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  // Auth state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Chat state
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState('');

  // Provider selection
  const [provider, setProvider] = useState('auto');
  const [responseMode, setResponseMode] = useState('deep');

  // Image generation
  const [imageLoading, setImageLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const abortRef = useRef(null);
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // ===== Auth check =====
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        } else {
          router.push('/auth');
        }
      })
      .catch(() => router.push('/auth'))
      .finally(() => setAuthLoading(false));
  }, [router]);

  // ===== Load chats =====
  useEffect(() => {
    if (!user) return;
    fetch('/api/chats')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.chats) setChats(data.chats);
      })
      .catch(() => {});
  }, [user]);

  // ===== Load chat messages =====
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      setSelectedImage(null);
      return;
    }
    setSelectedImage(null);
    fetch(`/api/chats/${activeChatId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.messages) {
          setMessages(data.messages.map((m) => ({
            ...m,
            timestamp: m.timestamp ? new Date(m.timestamp).getTime() : Date.now(),
          })));
        }
      })
      .catch(() => {});
  }, [activeChatId]);

  // ===== Auto scroll =====
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // ===== Focus input =====
  useEffect(() => {
    if (!authLoading && user) textareaRef.current?.focus();
  }, [authLoading, user, activeChatId]);

  // ===== Visible messages =====
  const visibleMessages = useMemo(() => {
    if (!isLoading || !streamingText) return messages;
    return [
      ...messages,
      {
        id: 'streaming',
        role: 'assistant',
        content: streamingText,
        timestamp: Date.now(),
      },
    ];
  }, [messages, isLoading, streamingText]);

  // ===== Create new chat =====
  const createNewChat = useCallback(async () => {
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat' }),
      });
      const data = await res.json();
      if (data?.chat) {
        setChats((prev) => [data.chat, ...prev]);
        setActiveChatId(data.chat.id);
        setMessages([]);
        setError('');
        setSidebarOpen(false);
      }
    } catch {
      setError('Failed to create chat.');
    }
  }, []);

  const onAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onImageChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please attach a valid image file.');
      return;
    }
    if (file.size > MAX_ATTACH_IMAGE_SIZE) {
      setError('Image too large. Use an image under 4MB.');
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setSelectedImage({
        name: file.name,
        dataUrl,
      });
      setError('');
      textareaRef.current?.focus();
    } catch {
      setError('Could not read image file.');
    }
  }, []);

  const removeSelectedImage = useCallback(() => {
    setSelectedImage(null);
    textareaRef.current?.focus();
  }, []);

  // ===== Send message =====
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    const hasImage = Boolean(selectedImage?.dataUrl);
    if ((!text && !hasImage) || isLoading) return;

    setError('');
    let chatId = activeChatId;

    // Create a chat if none active
    if (!chatId) {
      try {
        const res = await fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New Chat' }),
        });
        const data = await res.json();
        if (data?.chat) {
          chatId = data.chat.id;
          setChats((prev) => [data.chat, ...prev]);
          setActiveChatId(chatId);
        }
      } catch {
        setError('Failed to create chat.');
        return;
      }
    }

    const userMessage = {
      id: createId(),
      role: 'user',
      content: text || 'Please analyze this image.',
      ...(hasImage ? { imageDataUrl: selectedImage.dataUrl } : {}),
      timestamp: Date.now(),
    };

    const allMessages = [...messages, userMessage];
    setMessages(allMessages);
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);
    setStreamingText('');

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const apiMessages = allMessages.map((m) => {
        if (m.role === 'user' && m.imageDataUrl) {
          return {
            role: 'user',
            content: [
              { type: 'text', text: m.content || 'Please analyze this image.' },
              { type: 'image_url', image_url: { url: m.imageDataUrl } },
            ],
          };
        }
        return { role: m.role, content: m.content };
      });

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, chatId, provider, mode: responseMode }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      if (!res.body) throw new Error('No response stream.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) {
          full += chunk;
          setStreamingText(full);
        }
      }

      if (!full.trim()) throw new Error('No response from AI.');

      setMessages((prev) => [
        ...prev,
        { id: createId(), role: 'assistant', content: full, timestamp: Date.now() },
      ]);

      // Refresh chat list to get auto-title
      fetch('/api/chats')
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data?.chats) setChats(data.chats); })
        .catch(() => {});

    } catch (err) {
      if (err?.name === 'AbortError') return;
      const msg = err?.message || 'Something went wrong.';
      setError(msg);
    } finally {
      setIsLoading(false);
      setStreamingText('');
      abortRef.current = null;
    }
  }, [input, isLoading, messages, activeChatId, provider, responseMode, selectedImage]);

  // ===== Generate Image =====
  const generateImage = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || isLoading || imageLoading) return;

    setError('');
    setImageLoading(true);

    let chatId = activeChatId;
    if (!chatId) {
      try {
        const res = await fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New Chat' }),
        });
        const data = await res.json();
        if (data?.chat) {
          chatId = data.chat.id;
          setChats((prev) => [data.chat, ...prev]);
          setActiveChatId(chatId);
        }
      } catch {
        setError('Failed to create chat.');
        setImageLoading(false);
        return;
      }
    }

    const userMessage = {
      id: createId(),
      role: 'user',
      content: `🎨 Generate image: ${prompt}`,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generateImage: true, imagePrompt: prompt, chatId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Image generation failed.');

      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: 'assistant',
          content: data.content || 'Image generated!',
          imageUrl: data.imageUrl,
          timestamp: Date.now(),
        },
      ]);

      fetch('/api/chats').then((r) => r.ok ? r.json() : null).then((d) => { if (d?.chats) setChats(d.chats); }).catch(() => {});
    } catch (err) {
      setError(err?.message || 'Image generation failed.');
    } finally {
      setImageLoading(false);
    }
  }, [input, isLoading, imageLoading, activeChatId]);

  // ===== Stop =====
  const stopGeneration = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setIsLoading(false);
    setStreamingText('');
  }, []);

  // ===== Rename chat =====
  const startRename = useCallback((chat) => {
    setRenamingId(chat.id);
    setRenameValue(chat.title);
  }, []);

  const submitRename = useCallback(async () => {
    if (!renamingId || !renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      await fetch(`/api/chats/${renamingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: renameValue.trim() }),
      });
      setChats((prev) =>
        prev.map((c) => c.id === renamingId ? { ...c, title: renameValue.trim() } : c)
      );
    } catch {}
    setRenamingId(null);
  }, [renamingId, renameValue]);

  // ===== Delete chat =====
  const deleteChat = useCallback(async (chatId) => {
    try {
      await fetch(`/api/chats/${chatId}`, { method: 'DELETE' });
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (activeChatId === chatId) {
        setActiveChatId(null);
        setMessages([]);
      }
    } catch {}
  }, [activeChatId]);

  // ===== Logout =====
  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/auth');
  }, [router]);

  // ===== Export chat =====
  const exportChat = useCallback(() => {
    if (messages.length === 0) return;
    const activeChat = chats.find((c) => c.id === activeChatId);
    const title = activeChat?.title || 'Chat';
    const lines = messages.map((m) =>
      `[${m.role === 'user' ? 'You' : 'Arithmo AI'}] ${new Date(m.timestamp).toLocaleString()}\n${m.content}\n`
    );
    const blob = new Blob([`${title}\n${'='.repeat(40)}\n\n${lines.join('\n')}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, chats, activeChatId]);

  // ===== Keydown =====
  const onKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      sendMessage();
    }
  }, [isLoading, sendMessage]);

  // ===== Loading state =====
  if (authLoading) {
    return (
      <div className="auth-page">
        <div className="auth-bg-glow" />
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="auth-spinner" style={{ margin: '0 auto 16px', width: 32, height: 32, borderWidth: 3 }} />
          Loading...
        </div>
      </div>
    );
  }

  if (!user) return null;

  const activeChat = chats.find((c) => c.id === activeChatId);

  return (
    <>
      <div className="bg-glow" />
      <div className="app-layout">
        {/* Mobile overlay */}
        <div
          className={`mobile-overlay ${sidebarOpen ? 'visible' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* ===== SIDEBAR ===== */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <div className="sidebar-brand">
              <img src="/logo.png" alt="Arithmo" />
              <h2>Arithmo AI</h2>
            </div>
            <button className="new-chat-btn" onClick={createNewChat}>
              + New Chat
            </button>
          </div>

          <div className="sidebar-chats">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`chat-item ${activeChatId === chat.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveChatId(chat.id);
                  setError('');
                  setSidebarOpen(false);
                }}
              >
                {renamingId === chat.id ? (
                  <input
                    className="rename-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={submitRename}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenamingId(null); }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <span className="chat-item-title">{chat.title}</span>
                    <div className="chat-item-actions">
                      <button
                        className="chat-action-btn"
                        onClick={(e) => { e.stopPropagation(); startRename(chat); }}
                        title="Rename"
                      >
                        ✏️
                      </button>
                      <button
                        className="chat-action-btn delete"
                        onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {chats.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '12px', textAlign: 'center' }}>
                No chats yet. Start a conversation!
              </p>
            )}
          </div>

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="user-avatar">
                {(user.name || user.email || '?')[0].toUpperCase()}
              </div>
              <div className="user-info">
                <div className="user-name">{user.name}</div>
                <div className="user-email">{user.email}</div>
              </div>
            </div>
            <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
          </div>
        </aside>

        {/* ===== MAIN AREA ===== */}
        <main className="main-area">
          <header className="app-header">
            <div className="header-left">
              <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
                ☰
              </button>
              <span className="chat-title">{activeChat?.title || 'Arithmo AI'}</span>
            </div>
            <div className="header-right">
              <select
                className="model-select"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                disabled={isLoading}
                title="Choose AI provider"
              >
                <option value="auto">Auto</option>
                <option value="groq">Groq (Llama 3.3)</option>
                <option value="nvidia">Nemotron</option>
              </select>
              <select
                className="model-select"
                value={responseMode}
                onChange={(e) => setResponseMode(e.target.value)}
                disabled={isLoading}
                title="Choose response mode"
              >
                <option value="deep">Deep Mode</option>
                <option value="speed">Speed Mode</option>
              </select>
              <span className={`status-badge ${isLoading || imageLoading ? 'thinking' : 'online'}`}>
                {isLoading ? '● Thinking...' : imageLoading ? '● Creating...' : '● Online'}
              </span>
              {activeChatId && messages.length > 0 && (
                <button
                  className="theme-toggle"
                  onClick={exportChat}
                  title="Export chat"
                  style={{ fontSize: '0.82rem' }}
                >
                  📥
                </button>
              )}
              <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>
          </header>

          <div className="chat-body">
            {visibleMessages.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">🧠</div>
                <h2>What can I help you with?</h2>
                <p>Ask me anything — math problems, code debugging, explanations, creative writing, and more.</p>
                <div className="empty-suggestions">
                  {[
                    'Explain quantum computing simply',
                    'Write a Python sorting algorithm',
                    'Solve: ∫ x² dx from 0 to 5',
                    'Help me debug my React code',
                  ].map((s) => (
                    <button key={s} className="suggestion-chip" onClick={() => { setInput(s); textareaRef.current?.focus(); }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {visibleMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {isLoading && !streamingText && (
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            )}

            <div ref={endRef} />
          </div>

          {error && <div className="error-banner">⚠️ {error}</div>}

          <div className="input-area">
            {selectedImage && (
              <div className="image-chip">
                <img src={selectedImage.dataUrl} alt={selectedImage.name || 'Attached image'} />
                <div className="image-chip-meta">
                  <strong>{selectedImage.name}</strong>
                  <span>Attached for analysis</span>
                </div>
                <button className="image-remove-btn" onClick={removeSelectedImage} type="button">
                  Remove
                </button>
              </div>
            )}
            <div className="input-row">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Message Arithmo AI..."
                rows={1}
              />
              <button
                className="image-gen-btn"
                onClick={onAttachClick}
                disabled={isLoading || imageLoading}
                title="Attach image to ask about it"
              >
                📎
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                hidden
                onChange={onImageChange}
              />
              <button
                className="image-gen-btn"
                onClick={generateImage}
                disabled={!input.trim() || isLoading || imageLoading}
                title="Generate image from prompt"
              >
                {imageLoading ? '⏳' : '🎨'}
              </button>
              {isLoading ? (
                <button className="send-btn stop" onClick={stopGeneration}>⬛</button>
              ) : (
                <button
                  className="send-btn"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() && !selectedImage}
                >
                  ➤
                </button>
              )}
            </div>
            <p className="input-disclaimer">
              Arithmo AI may produce incorrect information.{' '}
              <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · astitvapandey1203@gmail.com
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
