'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import ChatComposer from '@/components/chat/ChatComposer';
import ChatHeader from '@/components/chat/ChatHeader';
import ChatSidebar from '@/components/chat/ChatSidebar';
import EmptyState from '@/components/chat/EmptyState';
import MessageBubble from '@/components/chat/MessageBubble';
import TypingIndicator from '@/components/chat/TypingIndicator';
import { triggerHaptic } from '@/lib/haptics';

function createId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const MAX_ATTACH_IMAGE_SIZE = 4 * 1024 * 1024;
const REALTIME_QUERY_PATTERN =
  /\b(latest|news|today|current|updates?|recent|happening|new|trend(?:ing)?|this week|this month)\b/i;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected file.'));
    reader.readAsDataURL(file);
  });
}

function providerLabel(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'groq') return 'Groq';
  if (normalized === 'gemini') return 'Gemini';
  if (normalized === 'nvidia') return 'NVIDIA';
  return 'Auto';
}

function searchProviderLabel(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'serpapi') return 'SerpAPI';
  if (normalized === 'bing') return 'Bing';
  return 'None';
}

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
  const [chatMode, setChatMode] = useState('chat');
  const [activeProvider, setActiveProvider] = useState('Auto');
  const [searchProvider, setSearchProvider] = useState('None');
  const [isSearching, setIsSearching] = useState(false);
  const [ragUsed, setRagUsed] = useState(false);
  const [researchUsed, setResearchUsed] = useState(false);
  const [chatPhase, setChatPhase] = useState('idle');

  // Image generation
  const [imageLoading, setImageLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [canUseVoiceInput, setCanUseVoiceInput] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const abortRef = useRef(null);
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const voiceBaseInputRef = useRef('');

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

  useEffect(() => {
    setActiveProvider(providerLabel(provider));
  }, [provider]);

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

  // ===== Voice input =====
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setCanUseVoiceInput(false);
      return;
    }

    setCanUseVoiceInput(true);

    const recognition = new SpeechRecognition();
    recognition.lang = window.navigator.language || 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      const reason = String(event?.error || '');
      if (reason === 'not-allowed' || reason === 'service-not-allowed') {
        setError('Microphone permission is blocked. Please allow mic access and try again.');
        return;
      }
      if (reason === 'no-speech') {
        setError('No speech detected. Try speaking closer to your microphone.');
        return;
      }
      setError('Voice input failed. Please try again.');
    };

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i]?.[0]?.transcript || '';
      }

      const normalizedTranscript = transcript.trim();
      const base = String(voiceBaseInputRef.current || '').trim();
      if (!normalizedTranscript && !base) return;

      setInput(base ? `${base} ${normalizedTranscript}`.trim() : normalizedTranscript);
      textareaRef.current?.focus();
    };

    speechRecognitionRef.current = recognition;

    return () => {
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      try {
        recognition.stop();
      } catch {}
      speechRecognitionRef.current = null;
    };
  }, []);

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
  const sendMessage = useCallback(async ({ action = 'chat', textOverride = '' } = {}) => {
    const requestedAction = action === 'practice' ? 'practice' : 'chat';
    const activeChatTitle = chats.find((chat) => chat.id === activeChatId)?.title || '';
    const latestUserSeed = [...messages]
      .reverse()
      .find((item) => item.role === 'user' && item.content)
      ?.content;
    const defaultPracticeTopic = String(latestUserSeed || activeChatTitle || 'general problem solving');
    const normalizedInput = String(textOverride || input).trim();
    const text =
      requestedAction === 'practice'
        ? (normalizedInput || defaultPracticeTopic)
        : normalizedInput;
    const hasImage = requestedAction === 'practice' ? false : Boolean(selectedImage?.dataUrl);
    if ((!text && !hasImage) || isLoading) return;

    if (isListening && speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
    }

    triggerHaptic('Medium');
    setError('');
    setRagUsed(false);
    setResearchUsed(false);
    setSearchProvider('None');
    setChatPhase(chatMode === 'search' || chatMode === 'research' ? 'searching' : 'generating');
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
    if (requestedAction !== 'practice') {
      setSelectedImage(null);
    }
    setIsLoading(true);
    setStreamingText('');
    const shouldSearch =
      chatMode === 'search' ||
      chatMode === 'research' ||
      REALTIME_QUERY_PATTERN.test(text);
    setIsSearching(shouldSearch);

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
        body: JSON.stringify({
          messages: apiMessages,
          chatId,
          provider,
          mode: responseMode,
          responseMode,
          chatMode,
          action: requestedAction,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      if (!res.body) throw new Error('No response stream.');

      const usedProvider = providerLabel(res.headers.get('x-ai-provider'));
      const usedSearchProvider = searchProviderLabel(res.headers.get('x-search-provider'));
      const didUseRag = res.headers.get('x-rag-used') === '1';
      const didUseResearch = res.headers.get('x-research-used') === '1';
      setActiveProvider(usedProvider);
      setRagUsed(didUseRag);
      setResearchUsed(didUseResearch);
      setSearchProvider(usedSearchProvider);
      setIsSearching(false);
      setChatPhase('generating');

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
        {
          id: createId(),
          role: 'assistant',
          content: full,
          timestamp: Date.now(),
          mode: chatMode,
          ragUsed: didUseRag,
          researchUsed: didUseResearch,
        },
      ]);
      setChatPhase('complete');

      // Refresh chat list to get auto-title
      fetch('/api/chats')
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data?.chats) setChats(data.chats); })
        .catch(() => {});

    } catch (err) {
      if (err?.name === 'AbortError') return;
      const msg = err?.message || 'Something went wrong.';
      setError(msg);
      setChatPhase('error');
    } finally {
      setIsLoading(false);
      setIsSearching(false);
      setStreamingText('');
      abortRef.current = null;
    }
  }, [input, isLoading, chats, messages, activeChatId, provider, responseMode, chatMode, selectedImage, isListening]);

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
      content: `Generate image: ${prompt}`,
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
    setIsSearching(false);
    setChatPhase('idle');
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

  const applyFollowUpQuestion = useCallback((question) => {
    if (!question) return;
    setInput(question);
    textareaRef.current?.focus();
  }, []);

  const generatePracticeSet = useCallback(() => {
    if (isLoading || imageLoading) return;
    sendMessage({ action: 'practice' });
  }, [isLoading, imageLoading, sendMessage]);

  const createSummaryPrompt = useCallback(() => {
    setInput('Summarize this conversation with key takeaways and action items.');
    textareaRef.current?.focus();
    triggerHaptic('Light');
  }, []);

  const regenerateResponse = useCallback(() => {
    if (isLoading || imageLoading) return;
    sendMessage({ textOverride: 'Regenerate the previous answer with a fresh perspective and concise clarity.' });
  }, [isLoading, imageLoading, sendMessage]);

  const toggleDeepMode = useCallback(() => {
    setResponseMode((prev) => (prev === 'deep' ? 'speed' : 'deep'));
    triggerHaptic('Light');
  }, []);

  const handleMicTap = useCallback(() => {
    if (!canUseVoiceInput || !speechRecognitionRef.current) {
      setError('Voice input is not supported in this browser.');
      triggerHaptic('Light');
      return;
    }

    if (isLoading || imageLoading) return;

    if (isListening) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
      triggerHaptic('Light');
      return;
    }

    setError('');
    voiceBaseInputRef.current = input;

    try {
      speechRecognitionRef.current.start();
      triggerHaptic('Medium');
    } catch {
      setError('Could not start voice input. Please try again.');
    }

    textareaRef.current?.focus();
  }, [canUseVoiceInput, isListening, isLoading, imageLoading, input]);

  const handleModeChange = useCallback((nextMode) => {
    setChatMode(nextMode);
    triggerHaptic('Light');
  }, []);

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
  const isBusy = isLoading || imageLoading || isSearching;

  return (
    <>
      <div className="bg-glow" />
      <div className="app-layout">
        <ChatSidebar
          user={user}
          chats={chats}
          activeChatId={activeChatId}
          renamingId={renamingId}
          renameValue={renameValue}
          onRenameValueChange={setRenameValue}
          onSubmitRename={submitRename}
          onCancelRename={() => setRenamingId(null)}
          onSelectChat={(chatId) => {
            setActiveChatId(chatId);
            setError('');
            setSidebarOpen(false);
          }}
          onStartRename={startRename}
          onDeleteChat={deleteChat}
          onCreateNewChat={createNewChat}
          onLogout={handleLogout}
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
        />

        <main className="main-area">
          <ChatHeader
            title={activeChat?.title || 'Arithmo AI'}
            chatMode={chatMode}
            onModeChange={handleModeChange}
            provider={provider}
            onProviderChange={setProvider}
            responseMode={responseMode}
            onResponseModeChange={setResponseMode}
            isBusy={isBusy}
            onOpenSidebar={() => setSidebarOpen(true)}
            theme={theme}
            onToggleTheme={toggleTheme}
            onExport={exportChat}
            canExport={Boolean(activeChatId && messages.length > 0)}
            isSearching={isSearching}
            isLoading={isLoading}
            imageLoading={imageLoading}
            activeProvider={activeProvider}
            ragUsed={ragUsed}
            researchUsed={researchUsed}
            searchProvider={searchProvider}
          />

          <div className="chat-body">
            {visibleMessages.length === 0 && (
              <EmptyState
                onPickSuggestion={(suggestion) => {
                  setInput(suggestion);
                  textareaRef.current?.focus();
                }}
              />
            )}

            {visibleMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onFollowUpClick={applyFollowUpQuestion}
              />
            ))}

            {isLoading && !streamingText && (
              <>
                <div className="skeleton-stack" aria-hidden="true">
                  <div className="skeleton-bubble" />
                  <div className="skeleton-bubble short" />
                </div>
                <TypingIndicator isSearching={isSearching} isGenerating={chatPhase === 'generating'} />
              </>
            )}

            {!isLoading && isSearching && (
              <div className="searching-row">
                <TypingIndicator isSearching isGenerating={false} />
              </div>
            )}

            <div ref={endRef} />
          </div>

          {error && <div className="error-banner">Warning: {error}</div>}

          <ChatComposer
            input={input}
            onInputChange={setInput}
            onKeyDown={onKeyDown}
            onSend={isLoading ? stopGeneration : () => sendMessage()}
            onAttachClick={onAttachClick}
            onGenerateImage={generateImage}
            onPractice={generatePracticeSet}
            onSummary={createSummaryPrompt}
            onRegenerate={regenerateResponse}
            onDeepToggle={toggleDeepMode}
            onMic={handleMicTap}
            isListening={isListening}
            micAvailable={canUseVoiceInput}
            isLoading={isLoading}
            imageLoading={imageLoading}
            responseMode={responseMode}
            selectedImage={selectedImage}
            onRemoveSelectedImage={removeSelectedImage}
            textareaRef={textareaRef}
            fileInputRef={fileInputRef}
            onImageChange={onImageChange}
          />
        </main>
      </div>
    </>
  );
}
