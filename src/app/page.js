'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import ChatComposer from '@/components/chat/ChatComposer';
import ChatHeader from '@/components/chat/ChatHeader';
import ChatSidebar from '@/components/chat/ChatSidebar';
import EmptyState from '@/components/chat/EmptyState';
import MessageBubble from '@/components/chat/MessageBubble';
import TypingIndicator from '@/components/chat/TypingIndicator';
import SettingsModal from '@/components/chat/SettingsModal';
import BottomNav from '@/components/chat/BottomNav';
import { triggerHaptic } from '@/lib/haptics';
import { getFirebaseClientAuth } from '@/lib/firebaseClient';
import { resilientFetch } from '@/lib/resilientFetch';

function createId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const MAX_ATTACH_IMAGE_SIZE = 4 * 1024 * 1024;
const FREE_PERIOD_NOTICE = 'Arithmo is free to use for a limited time. Enjoy it and make full use of it.';
const REALTIME_QUERY_PATTERN =
  /\b(latest(?:\s+version|\s+information)?|news|today|current|updates?|update|recent|happening|new|trend(?:ing)?|this week|this month|this year|live|2026)\b/i;
const COMPLEX_QUERY_PATTERN =
  /\b(compare|comparison|versus|vs\.?|analy[sz]e|analysis|deeply|in depth|research|evaluate|pros and cons|multiple perspectives|case study|strategy|debate|long term|tradeoffs?)\b/i;
const MODEL_MODE_SEQUENCE = ['auto', 'fast', 'smart', 'deep'];
const LEARNING_MODE_SEQUENCE = ['off', 'reverse', 'explain'];
const PIN_STORAGE_KEY = 'arithmo_pinned_messages';

const DEFAULT_USER_SETTINGS = {
  defaultChatMode: 'chat',
  responseMode: 'deep',
  theme: 'dark',
  showChatTimestamps: true,
  sidebarCollapsed: false,
  notificationsEnabled: true,
  compactMessages: false,
  minimalVisuals: true,
};

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

function preferredProviderLabelFromModelMode(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'fast') return 'Groq';
  if (normalized === 'smart') return 'Gemini';
  if (normalized === 'deep') return 'NVIDIA';
  return 'Auto';
}

function modelModeLabel(value) {
  const normalized = String(value || 'auto').toLowerCase();
  if (normalized === 'fast') return 'Fast';
  if (normalized === 'smart') return 'Smart';
  if (normalized === 'deep') return 'Deep';
  return 'Auto';
}

function learningModeLabel(value) {
  const normalized = String(value || 'off').toLowerCase();
  if (normalized === 'reverse') return 'Reverse';
  if (normalized === 'explain') return 'Explain Back';
  return 'Off';
}

function normalizeModelMode(value) {
  const normalized = String(value || 'auto').toLowerCase();
  if (MODEL_MODE_SEQUENCE.includes(normalized)) return normalized;
  return 'auto';
}

function normalizeLearningMode(value) {
  const normalized = String(value || 'off').toLowerCase();
  if (LEARNING_MODE_SEQUENCE.includes(normalized)) return normalized;
  return 'off';
}

function searchProviderLabel(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'serpapi') return 'SerpAPI';
  if (normalized === 'bing') return 'Bing';
  return 'None';
}

function normalizeUserSettings(settings = {}) {
  return {
    defaultChatMode: ['chat', 'search', 'research'].includes(settings.defaultChatMode)
      ? settings.defaultChatMode
      : DEFAULT_USER_SETTINGS.defaultChatMode,
    responseMode: ['deep', 'speed'].includes(settings.responseMode)
      ? settings.responseMode
      : DEFAULT_USER_SETTINGS.responseMode,
    theme: ['light', 'dark'].includes(settings.theme)
      ? settings.theme
      : DEFAULT_USER_SETTINGS.theme,
    showChatTimestamps:
      typeof settings.showChatTimestamps === 'boolean'
        ? settings.showChatTimestamps
        : DEFAULT_USER_SETTINGS.showChatTimestamps,
    sidebarCollapsed:
      typeof settings.sidebarCollapsed === 'boolean'
        ? settings.sidebarCollapsed
        : DEFAULT_USER_SETTINGS.sidebarCollapsed,
    notificationsEnabled:
      typeof settings.notificationsEnabled === 'boolean'
        ? settings.notificationsEnabled
        : DEFAULT_USER_SETTINGS.notificationsEnabled,
    compactMessages:
      typeof settings.compactMessages === 'boolean'
        ? settings.compactMessages
        : DEFAULT_USER_SETTINGS.compactMessages,
    minimalVisuals:
      typeof settings.minimalVisuals === 'boolean'
        ? settings.minimalVisuals
        : DEFAULT_USER_SETTINGS.minimalVisuals,
  };
}

function readLocalSettings() {
  if (typeof window === 'undefined') return DEFAULT_USER_SETTINGS;

  return normalizeUserSettings({
    defaultChatMode: localStorage.getItem('arithmo_default_chat_mode') || undefined,
    responseMode: localStorage.getItem('arithmo_response_mode') || undefined,
    theme: localStorage.getItem('arithmo_theme') || undefined,
    showChatTimestamps: localStorage.getItem('arithmo_show_timestamps') !== '0',
    sidebarCollapsed: localStorage.getItem('arithmo_sidebar_collapsed') === '1',
    notificationsEnabled: localStorage.getItem('arithmo_notifications_enabled') !== '0',
    compactMessages: localStorage.getItem('arithmo_compact_messages') === '1',
    minimalVisuals: localStorage.getItem('arithmo_minimal_visuals') !== '0',
  });
}

function writeLocalSettings(settings) {
  if (typeof window === 'undefined') return;
  const normalized = normalizeUserSettings(settings);
  localStorage.setItem('arithmo_default_chat_mode', normalized.defaultChatMode);
  localStorage.setItem('arithmo_response_mode', normalized.responseMode);
  localStorage.setItem('arithmo_theme', normalized.theme);
  localStorage.setItem('arithmo_show_timestamps', normalized.showChatTimestamps ? '1' : '0');
  localStorage.setItem('arithmo_sidebar_collapsed', normalized.sidebarCollapsed ? '1' : '0');
  localStorage.setItem('arithmo_notifications_enabled', normalized.notificationsEnabled ? '1' : '0');
  localStorage.setItem('arithmo_compact_messages', normalized.compactMessages ? '1' : '0');
  localStorage.setItem('arithmo_minimal_visuals', normalized.minimalVisuals ? '1' : '0');
}

function messageTimestampValue(message) {
  const raw = Number(message?.timestamp);
  if (Number.isFinite(raw)) return raw;
  return Date.now();
}

function messageFingerprint(message) {
  if (!message) return 'message:unknown';

  const role = String(message.role || 'unknown');
  const requestId = String(message.requestId || '').trim();
  if (requestId) return `${role}:request:${requestId}`;

  const id = String(message.id || '').trim();
  if (id) return `${role}:id:${id}`;

  const content =
    typeof message.content === 'string' ? message.content : JSON.stringify(message.content || '');
  const imageDataUrl = String(message.imageDataUrl || message.imageUrl || '').trim();
  const timestamp = messageTimestampValue(message);
  return `${role}:fallback:${content.trim()}:${imageDataUrl}:${timestamp}`;
}

function buildQuickTitle(text) {
  const cleaned = String(text || '')
    .replace(/["'\u201c\u201d\u2018\u2019]/g, '')
    .replace(/[:;.,!?/\\|[\]{}()<>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return 'New Chat';

  const words = cleaned.split(' ').filter(Boolean).slice(0, 6);
  if (words.length >= 3) return words.join(' ');
  return words.join(' ') || 'New Chat';
}

function detectAutoChatMode(text) {
  const normalized = String(text || '').trim();
  if (!normalized) return 'chat';
  if (REALTIME_QUERY_PATTERN.test(normalized)) return 'search';
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 28 || COMPLEX_QUERY_PATTERN.test(normalized)) return 'research';
  return 'chat';
}

function chatModeLabel(value, composerMode = 'chat') {
  if (composerMode === 'image') return 'Image Mode';
  const normalized = String(value || 'chat').toLowerCase();
  if (normalized === 'search') return 'Search Mode';
  if (normalized === 'research') return 'Research Mode';
  return 'Chat Mode';
}

function mergeMessagesWithPending(serverMessages = [], pendingMessages = []) {
  const merged = [];
  const seen = new Set();

  for (const message of [...serverMessages, ...pendingMessages]) {
    if (!message) continue;
    const fingerprint = messageFingerprint(message);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    merged.push(message);
  }

  merged.sort((a, b) => messageTimestampValue(a) - messageTimestampValue(b));
  return merged;
}

function prunePendingMessages(serverMessages = [], pendingMessages = []) {
  const serverFingerprints = new Set(serverMessages.map((message) => messageFingerprint(message)));
  return pendingMessages.filter((message) => !serverFingerprints.has(messageFingerprint(message)));
}

export default function HomePage() {
  const router = useRouter();
  const { theme, setThemeMode } = useTheme();

  // Auth state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Chat state
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pinnedByChat, setPinnedByChat] = useState({});
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState('');

  // Model selection
  const [modelMode, setModelMode] = useState('auto');
  const [responseMode, setResponseMode] = useState('deep');
  const [chatMode, setChatMode] = useState('chat');
  const [learningMode, setLearningMode] = useState('off');
  const [manualModeOverride, setManualModeOverride] = useState(false);
  const [composerMode, setComposerMode] = useState('chat');
  const [modeSwitching, setModeSwitching] = useState(false);
  const [activeProvider, setActiveProvider] = useState('Auto');
  const [fallbackNotice, setFallbackNotice] = useState('');
  const [latencyMs, setLatencyMs] = useState(0);
  const [queryComplexity, setQueryComplexity] = useState('');
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
  const [deviceType, setDeviceType] = useState('desktop');
  const [tabletOrientation, setTabletOrientation] = useState('landscape');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [quickActionsExpanded, setQuickActionsExpanded] = useState(false);
  const [recentChatsExpanded, setRecentChatsExpanded] = useState(false);
  const [showChatTimestamps, setShowChatTimestamps] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [compactMessages, setCompactMessages] = useState(false);
  const [minimalVisuals, setMinimalVisuals] = useState(true);
  const [mobileTab, setMobileTab] = useState('home');
  const [uiNotice, setUiNotice] = useState('');
  const [notificationCount, setNotificationCount] = useState(1);
  const [billingUsage, setBillingUsage] = useState(null);

  const abortRef = useRef(null);
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const voiceBaseInputRef = useRef('');
  const noticeTimeoutRef = useRef(null);
  const errorTimeoutRef = useRef(null);
  const fallbackTimeoutRef = useRef(null);
  const loginNoticeShownRef = useRef(false);
  const sendLockRef = useRef(false);
  const streamReaderRef = useRef(null);
  const stopRequestedRef = useRef(false);
  const streamingTextRef = useRef('');
  const pendingMessagesRef = useRef(new Map());
  const activeChatIdRef = useRef(null);
  const messagesRef = useRef([]);

  const applySettings = useCallback((settings) => {
    const normalized = normalizeUserSettings(settings);
    setChatMode(normalized.defaultChatMode);
    setResponseMode(normalized.responseMode);
    setShowChatTimestamps(normalized.showChatTimestamps);
    setSidebarCollapsed(normalized.sidebarCollapsed);
    setNotificationsEnabled(normalized.notificationsEnabled);
    setCompactMessages(normalized.compactMessages);
    setMinimalVisuals(normalized.minimalVisuals);
    setNotificationCount(normalized.notificationsEnabled ? 1 : 0);
    setThemeMode(normalized.theme);
    writeLocalSettings(normalized);
    return normalized;
  }, [setThemeMode]);

  const currentSettings = useMemo(() => normalizeUserSettings({
    defaultChatMode: chatMode,
    responseMode,
    theme,
    showChatTimestamps,
    sidebarCollapsed,
    notificationsEnabled,
    compactMessages,
    minimalVisuals,
  }), [
    chatMode,
    responseMode,
    theme,
    showChatTimestamps,
    sidebarCollapsed,
    notificationsEnabled,
    compactMessages,
    minimalVisuals,
  ]);

  const persistUserSettings = useCallback(async (settingsPatch = {}, profilePatch = {}) => {
    const nextSettings = normalizeUserSettings({ ...currentSettings, ...settingsPatch });
    writeLocalSettings(nextSettings);

    try {
      const res = await resilientFetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profilePatch, settings: nextSettings }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save settings.');
      if (data?.user) setUser(data.user);
      return data;
    } catch (err) {
      setError(err?.message || 'Failed to save settings.');
      return null;
    }
  }, [currentSettings]);

  const refreshBillingUsage = useCallback(async () => {
    try {
      const res = await resilientFetch('/api/billing/usage');
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) return null;
      setBillingUsage(data);
      setUser((prev) => prev ? {
        ...prev,
        plan: data.plan,
        planExpiresAt: data.planExpiresAt,
        isPremium: data.isPremium,
        isLifetime: data.isLifetime,
        usage: data,
      } : prev);
      return data;
    } catch {
      return null;
    }
  }, []);

  // ===== Auth check =====
  useEffect(() => {
    let firebaseAuth;
    try {
      firebaseAuth = getFirebaseClientAuth();
    } catch {
      setAuthLoading(false);
      router.push('/auth');
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      if (!firebaseUser) {
        setAuthLoading(false);
        router.push('/auth');
        return;
      }

      try {
        await firebaseUser.getIdToken(true);
        const response = await resilientFetch('/api/auth/me');
        const data = response.ok ? await response.json() : null;
        if (data?.user) {
          setUser(data.user);
          if (data.user.usage) setBillingUsage(data.user.usage);
          if (data.user.settings && Object.keys(data.user.settings).length > 0) {
            applySettings(data.user.settings);
          }
        } else {
          router.push('/auth');
        }
      } catch {
        router.push('/auth');
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, applySettings]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    applySettings(readLocalSettings());

    const savedModelMode = normalizeModelMode(localStorage.getItem('arithmo_model_mode'));
    setModelMode(savedModelMode);
    const savedLearningMode = normalizeLearningMode(localStorage.getItem('arithmo_learning_mode'));
    setLearningMode(savedLearningMode);
  }, [applySettings]);

  useEffect(() => {
    setActiveProvider(preferredProviderLabelFromModelMode(modelMode));
    if (typeof window !== 'undefined') {
      localStorage.setItem('arithmo_model_mode', normalizeModelMode(modelMode));
    }
  }, [modelMode]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('arithmo_learning_mode', normalizeLearningMode(learningMode));
    }
  }, [learningMode]);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(PIN_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        setPinnedByChat(parsed);
      }
    } catch { }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(pinnedByChat || {}));
  }, [pinnedByChat]);

  // ===== Load chats (staggered to avoid DDoS triggers) =====
  useEffect(() => {
    if (!user) return;
    // Load chats first, then billing after a short delay
    resilientFetch('/api/chats')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.chats) setChats(data.chats);
      })
      .catch(() => { });
    // Stagger the billing call to avoid burst requests
    const billingTimer = setTimeout(() => refreshBillingUsage(), 500);
    return () => clearTimeout(billingTimer);
  }, [user?.id, refreshBillingUsage]);

  // ===== Load chat messages =====
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      setSelectedImage(null);
      return;
    }

    const requestedChatId = activeChatId;
    setSelectedImage(null);
    resilientFetch(`/api/chats/${requestedChatId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (requestedChatId !== activeChatIdRef.current) return;
        if (!data?.messages) return;

        const serverMessages = data.messages.map((m) => ({
          ...m,
          requestId: m.requestId || '',
          timestamp: m.timestamp ? new Date(m.timestamp).getTime() : Date.now(),
        }));
        const pendingForChat = pendingMessagesRef.current.get(requestedChatId) || [];
        const mergedMessages = mergeMessagesWithPending(serverMessages, pendingForChat);
        const remainingPending = prunePendingMessages(serverMessages, pendingForChat);

        if (remainingPending.length > 0) {
          pendingMessagesRef.current.set(requestedChatId, remainingPending);
        } else {
          pendingMessagesRef.current.delete(requestedChatId);
        }

        setMessages(mergedMessages);
      })
      .catch(() => { });
  }, [activeChatId]);

  // ===== Auto scroll =====
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: isLoading ? 'auto' : 'smooth', block: 'end' });
  }, [messages, streamingText, isLoading]);

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
      } catch { }
      speechRecognitionRef.current = null;
    };
  }, []);

  // ===== Device mode =====
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const tabletQuery = window.matchMedia('(min-width: 768px) and (max-width: 1199px)');
    const tabletLandscapeQuery = window.matchMedia('(min-width: 768px) and (max-width: 1199px) and (orientation: landscape)');
    const tabletPortraitQuery = window.matchMedia('(min-width: 768px) and (max-width: 1199px) and (orientation: portrait)');

    const updateDeviceType = () => {
      if (mobileQuery.matches) {
        setDeviceType('mobile');
        return;
      }
      if (tabletQuery.matches) {
        setDeviceType('tablet');
        if (tabletLandscapeQuery.matches) {
          setTabletOrientation('landscape');
        } else {
          setTabletOrientation('portrait');
        }
        return;
      }
      setDeviceType('desktop');
    };

    const subscribe = (query, callback) => {
      if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', callback);
        return () => query.removeEventListener('change', callback);
      }
      query.addListener(callback);
      return () => query.removeListener(callback);
    };

    updateDeviceType();
    const unsubscribeMobile = subscribe(mobileQuery, updateDeviceType);
    const unsubscribeTablet = subscribe(tabletQuery, updateDeviceType);
    const unsubscribeLandscape = subscribe(tabletLandscapeQuery, updateDeviceType);
    const unsubscribePortrait = subscribe(tabletPortraitQuery, updateDeviceType);

    return () => {
      unsubscribeMobile();
      unsubscribeTablet();
      unsubscribeLandscape();
      unsubscribePortrait();
    };
  }, []);

  // ===== Tablet orientation-aware sidebar =====
  useEffect(() => {
    if (deviceType === 'tablet') {
      if (tabletOrientation === 'landscape') {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    } else if (deviceType !== 'mobile') {
      setSidebarOpen(false);
    }
  }, [deviceType, tabletOrientation]);

  // ===== Swipe gestures for portrait sidebar =====
  useEffect(() => {
    if (typeof window === 'undefined' || !['mobile', 'tablet'].includes(deviceType)) return;

    let touchStartX = 0;
    let touchStartY = 0;
    const SWIPE_THRESHOLD = 60;
    const EDGE_ZONE = 40;

    const handleTouchStart = (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaX = touchEndX - touchStartX;
      const deltaY = Math.abs(touchEndY - touchStartY);

      // Only consider horizontal swipes (not vertical scrolling)
      if (deltaY > Math.abs(deltaX)) return;

      // Swipe right from left edge â†’ open sidebar
      if (deltaX > SWIPE_THRESHOLD && touchStartX < EDGE_ZONE) {
        setSidebarOpen(true);
      }
      // Swipe left â†’ close sidebar
      if (deltaX < -SWIPE_THRESHOLD) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [deviceType]);

  useEffect(() => () => {
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
    }
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    setModeSwitching(true);
    const timeoutId = setTimeout(() => setModeSwitching(false), 240);
    return () => clearTimeout(timeoutId);
  }, [chatMode]);

  useEffect(() => {
    streamingTextRef.current = streamingText;
  }, [streamingText]);

  const showUiNotice = useCallback((message) => {
    if (!message || !notificationsEnabled) return;
    setUiNotice(message);
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
    }
    noticeTimeoutRef.current = setTimeout(() => {
      setUiNotice('');
      noticeTimeoutRef.current = null;
    }, 5000);
  }, [notificationsEnabled]);

  useEffect(() => {
    if (!error) {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }
      return;
    }

    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    errorTimeoutRef.current = setTimeout(() => {
      setError('');
      errorTimeoutRef.current = null;
    }, 5000);

    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }
    };
  }, [error]);

  useEffect(() => {
    if (!fallbackNotice) {
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
      return;
    }

    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
    }
    fallbackTimeoutRef.current = setTimeout(() => {
      setFallbackNotice('');
      fallbackTimeoutRef.current = null;
    }, 5000);

    return () => {
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
    };
  }, [fallbackNotice]);

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
      setError('');
      setInput('');
      setSelectedImage(null);
      setComposerMode('chat');
      setManualModeOverride(false);
      setChatMode(currentSettings.defaultChatMode || 'chat');
      const res = await resilientFetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create chat.');
      if (data?.chat) {
        setChats((prev) => [data.chat, ...prev]);
        setActiveChatId(data.chat.id);
        setMobileTab('chats');
        setMessages([]);
        setSidebarOpen(false);
        window.requestAnimationFrame(() => textareaRef.current?.focus());
      }
    } catch (err) {
      setError(err?.message || 'Failed to create chat.');
    }
  }, [currentSettings.defaultChatMode]);

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

  const getMessagePinKey = useCallback((message) => {
    if (!message) return '';
    return String(message.requestId || message.id || message.timestamp || '').trim();
  }, []);

  const isMessagePinned = useCallback((message) => {
    if (!activeChatId) return false;
    const key = getMessagePinKey(message);
    if (!key) return false;
    const pinned = pinnedByChat?.[activeChatId] || [];
    return pinned.includes(key);
  }, [activeChatId, getMessagePinKey, pinnedByChat]);

  const togglePinnedMessage = useCallback((message) => {
    if (!activeChatId) return;
    const key = getMessagePinKey(message);
    if (!key) return;

    setPinnedByChat((prev) => {
      const current = new Set(prev?.[activeChatId] || []);
      if (current.has(key)) {
        current.delete(key);
      } else {
        current.add(key);
      }

      return {
        ...prev,
        [activeChatId]: Array.from(current),
      };
    });
  }, [activeChatId, getMessagePinKey]);

  // ===== Send message =====
  const sendMessage = useCallback(async ({ action = 'chat', textOverride = '' } = {}) => {
    const requestedAction = action === 'practice' ? 'practice' : 'chat';
    const activeChatTitle = chats.find((chat) => chat.id === activeChatId)?.title || '';
    const latestMessages = [...messagesRef.current];
    const latestUserSeed = latestMessages
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
    if ((!text && !hasImage) || isLoading || sendLockRef.current) return;

    sendLockRef.current = true;
    stopRequestedRef.current = false;

    if (isListening && speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch { }
    }

    triggerHaptic('Medium');
    setError('');
    setRagUsed(false);
    setResearchUsed(false);
    setSearchProvider('None');
    setFallbackNotice('');
    setLatencyMs(0);
    setQueryComplexity('');
    const autoDetectedMode =
      requestedAction === 'chat' && !manualModeOverride
        ? detectAutoChatMode(text)
        : chatMode;
    const effectiveChatMode =
      requestedAction === 'practice'
        ? 'chat'
        : manualModeOverride
          ? chatMode
          : autoDetectedMode;
    const autoSearchTriggered =
      requestedAction === 'chat' && !manualModeOverride && autoDetectedMode === 'search';

    if (autoSearchTriggered) {
      showUiNotice('Searching web...');
    }

    setChatPhase(effectiveChatMode === 'search' || effectiveChatMode === 'research' ? 'searching' : 'generating');
    let chatId = activeChatId;
    let clientRequestId = '';

    // Create a chat if none active
    if (!chatId) {
      try {
        const res = await resilientFetch('/api/chats', {
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
        sendLockRef.current = false;
        return;
      }

      if (!chatId) {
        setError('Failed to create chat.');
        sendLockRef.current = false;
        return;
      }
    }

    clientRequestId = createId();

    const userMessage = {
      id: createId(),
      role: 'user',
      content: text || 'Please analyze this image.',
      requestId: clientRequestId,
      ...(hasImage ? { imageDataUrl: selectedImage.dataUrl } : {}),
      timestamp: Date.now(),
    };

    const quickTitleSeed = text || (hasImage ? 'Image question' : '');
    const quickTitle = buildQuickTitle(quickTitleSeed);
    if (chatId && quickTitle && quickTitle !== 'New Chat') {
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId && (chat.title || 'New Chat') === 'New Chat'
            ? { ...chat, title: quickTitle }
            : chat
        )
      );
    }

    const pendingForChat = pendingMessagesRef.current.get(chatId) || [];
    pendingMessagesRef.current.set(chatId, [...pendingForChat, userMessage]);

    const allMessages = [...latestMessages, userMessage];
    setMessages((prev) => mergeMessagesWithPending(prev, [userMessage]));
    setInput('');
    if (requestedAction !== 'practice') {
      setSelectedImage(null);
    }
    setIsLoading(true);
    setStreamingText('');
    if (!manualModeOverride && requestedAction === 'chat') {
      setChatMode(effectiveChatMode);
    }

    const shouldSearch = effectiveChatMode === 'search' || effectiveChatMode === 'research';
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

      const res = await resilientFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          chatId,
          clientRequestId,
          modelMode,
          learningMode,
          mode: responseMode,
          responseMode,
          chatMode: effectiveChatMode,
          action: requestedAction,
        }),
        signal: controller.signal,
      });

      if (res.status === 499) {
        const abortError = new Error('Request aborted.');
        abortError.name = 'AbortError';
        throw abortError;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const requestError = new Error(data.error || `Request failed (${res.status})`);
        requestError.status = res.status;
        requestError.code = data.code;
        requestError.upgradeUrl = data.upgradeUrl;
        throw requestError;
      }

      if (!res.body) throw new Error('No response stream.');

      const usedProvider = providerLabel(res.headers.get('x-ai-provider'));
      const fallbackUsed = res.headers.get('x-ai-fallback-used') === '1';
      const complexity = String(res.headers.get('x-ai-query-complexity') || '').trim();
      const elapsed = Number(res.headers.get('x-ai-latency-ms') || 0);
      const usedSearchProvider = searchProviderLabel(res.headers.get('x-search-provider'));
      const didUseRag = res.headers.get('x-rag-used') === '1';
      const didUseResearch = res.headers.get('x-research-used') === '1';
      const actualChatMode = didUseResearch ? 'research' : didUseRag ? 'search' : 'chat';
      setActiveProvider(usedProvider);
      setFallbackNotice(fallbackUsed ? `Switched to ${usedProvider} (fallback)` : '');
      setQueryComplexity(complexity ? `${complexity[0].toUpperCase()}${complexity.slice(1)}` : '');
      setLatencyMs(Number.isFinite(elapsed) && elapsed > 0 ? Math.round(elapsed) : 0);
      setRagUsed(didUseRag);
      setResearchUsed(didUseResearch);
      setSearchProvider(usedSearchProvider);
      setIsSearching(false);
      setChatPhase('generating');

      if (autoSearchTriggered && (didUseRag || didUseResearch)) {
        showUiNotice('Search Mode Active');
      }
      if (autoSearchTriggered && requestedAction === 'chat' && !manualModeOverride) {
        if (didUseResearch) {
          setChatMode('research');
        } else if (!didUseRag) {
          setChatMode('chat');
        }
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      streamReaderRef.current = reader;
      let full = '';

      while (true) {
        if (stopRequestedRef.current || controller.signal.aborted) {
          try {
            await reader.cancel();
          } catch { }
          break;
        }
        const { done, value } = await reader.read();
        if (done) break;
        if (stopRequestedRef.current || controller.signal.aborted) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) {
          full += chunk;
          setStreamingText(full);
        }
      }

      if (stopRequestedRef.current || controller.signal.aborted) {
        const abortError = new Error('Request aborted.');
        abortError.name = 'AbortError';
        throw abortError;
      }

      if (!full.trim()) throw new Error('No response from AI.');

      pendingMessagesRef.current.delete(chatId);
      setMessages((prev) => {
        const alreadyHasAssistant = prev.some(
          (message) => message.role === 'assistant' && message.requestId === clientRequestId
        );
        if (alreadyHasAssistant) return prev;

        return [
          ...prev,
          {
            id: createId(),
            role: 'assistant',
            requestId: clientRequestId,
            content: full,
            timestamp: Date.now(),
            mode: actualChatMode,
            ragUsed: didUseRag,
            researchUsed: didUseResearch,
          },
        ];
      });
      setChatPhase('complete');
      refreshBillingUsage();

      // Refresh chat list to get auto-title
      resilientFetch('/api/chats')
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data?.chats) setChats(data.chats); })
        .catch(() => { });

    } catch (err) {
      if (err?.name === 'AbortError' || controller.signal.aborted || stopRequestedRef.current) {
        setChatPhase('idle');
        return;
      }
      const msg = err?.message || 'Something went wrong.';
      setError(msg);
      if (err?.status === 402 || err?.code === 'LIMIT_REACHED' || err?.code === 'PREMIUM_REQUIRED') {
        showUiNotice('Upgrade to Pro for higher limits and premium model access.');
      }
      setFallbackNotice('');
      setChatPhase('error');
    } finally {
      if (chatId && clientRequestId) {
        const pending = pendingMessagesRef.current.get(chatId) || [];
        const remaining = pending.filter((message) => message.requestId !== clientRequestId);
        if (remaining.length > 0) {
          pendingMessagesRef.current.set(chatId, remaining);
        } else {
          pendingMessagesRef.current.delete(chatId);
        }
      }
      streamReaderRef.current = null;
      stopRequestedRef.current = false;
      setIsLoading(false);
      setIsSearching(false);
      setStreamingText('');
      abortRef.current = null;
      sendLockRef.current = false;
    }
  }, [input, isLoading, chats, activeChatId, modelMode, learningMode, responseMode, chatMode, manualModeOverride, selectedImage, isListening, refreshBillingUsage, showUiNotice]);

  // ===== Generate Image =====
  const generateImage = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || isLoading || imageLoading) return;

    setError('');
    setImageLoading(true);

    let chatId = activeChatId;
    if (!chatId) {
      try {
        const res = await resilientFetch('/api/chats', {
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
      const res = await resilientFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generateImage: true, imagePrompt: prompt, chatId }),
      });

      const data = await res.json();
      if (!res.ok) {
        const requestError = new Error(data.error || 'Image generation failed.');
        requestError.status = res.status;
        requestError.code = data.code;
        requestError.upgradeUrl = data.upgradeUrl;
        throw requestError;
      }

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

      resilientFetch('/api/chats').then((r) => r.ok ? r.json() : null).then((d) => { if (d?.chats) setChats(d.chats); }).catch(() => { });
      refreshBillingUsage();
    } catch (err) {
      setError(err?.message || 'Image generation failed.');
      if (err?.status === 402 || err?.code === 'LIMIT_REACHED' || err?.code === 'PREMIUM_REQUIRED') {
        showUiNotice('Upgrade to Pro for more image generation and premium features.');
      }
    } finally {
      setImageLoading(false);
    }
  }, [input, isLoading, imageLoading, activeChatId, refreshBillingUsage, showUiNotice]);

  // ===== Stop =====
  const stopGeneration = useCallback(() => {
    const partial = streamingTextRef.current.trim();
    if (partial) {
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: 'assistant',
          content: `${partial}\n\n_Response stopped._`,
          timestamp: Date.now(),
          mode: chatMode,
          ragUsed,
          researchUsed,
        },
      ]);
    }
    stopRequestedRef.current = true;
    if (streamReaderRef.current) {
      try {
        streamReaderRef.current.cancel();
      } catch { }
      streamReaderRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    sendLockRef.current = false;
    setIsLoading(false);
    setIsSearching(false);
    setChatPhase('idle');
    setStreamingText('');
  }, [chatMode, ragUsed, researchUsed]);

  // ===== Delete chat =====
  const deleteChat = useCallback(async (chatId) => {
    const chat = chats.find((item) => item.id === chatId);
    const title = chat?.title || 'this chat';
    if (typeof window !== 'undefined' && !window.confirm(`Delete "${title}"? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await resilientFetch(`/api/chats/${chatId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete chat.');
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (activeChatId === chatId) {
        setActiveChatId(null);
        setMessages([]);
        setMobileTab('home');
      }
      showUiNotice('Chat deleted.');
    } catch (err) {
      setError(err?.message || 'Failed to delete chat.');
    }
  }, [activeChatId, chats, showUiNotice]);

  // ===== Logout =====
  const handleLogout = useCallback(async () => {
    await signOut(getFirebaseClientAuth());
    await resilientFetch('/api/auth/logout', { method: 'POST' }, { skipAuth: true }).catch(() => null);
    setUser(null);
    setMessages([]);
    setActiveChatId(null);
    router.push('/auth');
  }, [router]);

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
      } catch { }
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
    if (!['chat', 'search', 'research'].includes(nextMode)) return;
    setComposerMode('chat');
    setManualModeOverride(true);
    setChatMode(nextMode);
    showUiNotice(`${chatModeLabel(nextMode)} selected.`);
    triggerHaptic('Light');
  }, [showUiNotice]);

  const handleCreateImageMode = useCallback(() => {
    setComposerMode('image');
    setManualModeOverride(true);
    showUiNotice('Image Mode selected. Describe the image you want to create.');
    triggerHaptic('Light');
    textareaRef.current?.focus();
  }, [showUiNotice]);

  const handleCycleModelMode = useCallback(() => {
    let nextMode = 'auto';
    let blockedPremiumMode = false;
    setModelMode((previousMode) => {
      const normalizedCurrent = normalizeModelMode(previousMode);
      const currentIndex = MODEL_MODE_SEQUENCE.indexOf(normalizedCurrent);
      nextMode = MODEL_MODE_SEQUENCE[(currentIndex + 1) % MODEL_MODE_SEQUENCE.length];
      if (!user?.isPremium && ['smart', 'deep'].includes(nextMode)) {
        blockedPremiumMode = true;
        showUiNotice(`${modelModeLabel(nextMode)} is a Pro feature. Upgrade to unlock it.`);
        nextMode = normalizedCurrent;
        return normalizedCurrent;
      }
      return nextMode;
    });

    if (typeof window !== 'undefined') {
      localStorage.setItem('arithmo_model_mode', nextMode);
    }
    if (!blockedPremiumMode && (user?.isPremium || !['smart', 'deep'].includes(nextMode))) {
      showUiNotice(`Model mode set to ${modelModeLabel(nextMode)}.`);
    }
    triggerHaptic('Light');
  }, [showUiNotice, user?.isPremium]);

  const handleCycleLearningMode = useCallback(() => {
    let nextMode = 'off';
    let blockedPremiumMode = false;
    setLearningMode((previousMode) => {
      const normalizedCurrent = normalizeLearningMode(previousMode);
      const currentIndex = LEARNING_MODE_SEQUENCE.indexOf(normalizedCurrent);
      nextMode = LEARNING_MODE_SEQUENCE[(currentIndex + 1) % LEARNING_MODE_SEQUENCE.length];
      if (!user?.isPremium && ['reverse', 'explain'].includes(nextMode)) {
        blockedPremiumMode = true;
        showUiNotice(`${learningModeLabel(nextMode)} is a Pro learning feature.`);
        nextMode = normalizedCurrent;
        return normalizedCurrent;
      }
      return nextMode;
    });

    if (typeof window !== 'undefined') {
      localStorage.setItem('arithmo_learning_mode', nextMode);
    }
    if (!blockedPremiumMode) {
      showUiNotice(`Learning mode set to ${learningModeLabel(nextMode)}.`);
    }
    triggerHaptic('Light');
  }, [showUiNotice, user?.isPremium]);

  const persistPreference = useCallback((key, value) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, value);
  }, []);

  const handleSetThemePreference = useCallback((nextTheme) => {
    const normalized = nextTheme === 'light' ? 'light' : 'dark';
    setThemeMode(normalized);
    persistUserSettings({ theme: normalized });
  }, [persistUserSettings, setThemeMode]);

  const handleToggleThemePreference = useCallback(() => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    handleSetThemePreference(nextTheme);
  }, [handleSetThemePreference, theme]);

  const handleSetDefaultMode = useCallback((nextMode) => {
    if (!['chat', 'search', 'research'].includes(nextMode)) return;
    setChatMode(nextMode);
    persistPreference('arithmo_default_chat_mode', nextMode);
    persistUserSettings({ defaultChatMode: nextMode });
  }, [persistPreference, persistUserSettings]);

  const handleSetResponseMode = useCallback((nextMode) => {
    if (!['deep', 'speed'].includes(nextMode)) return;
    setResponseMode(nextMode);
    persistPreference('arithmo_response_mode', nextMode);
    persistUserSettings({ responseMode: nextMode });
  }, [persistPreference, persistUserSettings]);

  const handleToggleChatTimestamps = useCallback(() => {
    setShowChatTimestamps((prev) => {
      const next = !prev;
      persistPreference('arithmo_show_timestamps', next ? '1' : '0');
      persistUserSettings({ showChatTimestamps: next });
      return next;
    });
  }, [persistPreference, persistUserSettings]);

  const handleToggleSidebarCollapsedPreference = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      persistPreference('arithmo_sidebar_collapsed', next ? '1' : '0');
      persistUserSettings({ sidebarCollapsed: next });
      return next;
    });
  }, [persistPreference, persistUserSettings]);

  const handleToggleNotificationsPreference = useCallback(() => {
    setNotificationsEnabled((prev) => {
      const next = !prev;
      persistPreference('arithmo_notifications_enabled', next ? '1' : '0');
      if (!next) {
        setUiNotice('');
        setNotificationCount(0);
      } else {
        setNotificationCount(1);
      }
      persistUserSettings({ notificationsEnabled: next });
      return next;
    });
  }, [persistPreference, persistUserSettings]);

  const handleToggleCompactMessages = useCallback(() => {
    setCompactMessages((prev) => {
      const next = !prev;
      persistPreference('arithmo_compact_messages', next ? '1' : '0');
      persistUserSettings({ compactMessages: next });
      return next;
    });
  }, [persistPreference, persistUserSettings]);

  const handleToggleMinimalVisuals = useCallback(() => {
    setMinimalVisuals((prev) => {
      const next = !prev;
      persistPreference('arithmo_minimal_visuals', next ? '1' : '0');
      persistUserSettings({ minimalVisuals: next });
      return next;
    });
  }, [persistPreference, persistUserSettings]);

  const applyQuickActionTemplate = useCallback((mode, template) => {
    setChatMode(mode);
    setComposerMode('chat');
    setManualModeOverride(true);
    setInput(template);
    setError('');
    triggerHaptic('Light');
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  }, []);

  const handleQuickAction = useCallback((actionId) => {
    switch (actionId) {
      case 'image':
        setComposerMode('image');
        setManualModeOverride(true);
        setInput('Create an image of ');
        textareaRef.current?.focus();
        triggerHaptic('Light');
        return;
      case 'solve':
        applyQuickActionTemplate('search', 'Solve this step-by-step: ');
        return;
      case 'write':
        applyQuickActionTemplate('chat', 'Help me write a polished ');
        return;
      case 'code':
        applyQuickActionTemplate('chat', 'Write production-ready code for ');
        return;
      case 'research':
        applyQuickActionTemplate('research', 'Research this topic with recent sources: ');
        return;
      case 'new-chat':
        createNewChat();
        return;
      default:
        applyQuickActionTemplate('chat', 'Show me all capabilities and suggest a good starting action.');
    }
  }, [applyQuickActionTemplate, createNewChat]);

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
    triggerHaptic('Light');
  }, []);

  const handleOpenNotifications = useCallback(() => {
    setNotificationCount(0);
    showUiNotice(FREE_PERIOD_NOTICE);
    triggerHaptic('Light');
  }, [showUiNotice]);

  const handleUpgradeClick = useCallback(() => {
    router.push('/pricing');
  }, [router]);

  const toggleSidebarCollapse = useCallback(() => {
    if (deviceType === 'desktop') {
      setSidebarCollapsed((prev) => {
        const next = !prev;
        persistPreference('arithmo_sidebar_collapsed', next ? '1' : '0');
        persistUserSettings({ sidebarCollapsed: next });
        return next;
      });
      triggerHaptic('Light');
      return;
    }
    // Tablet and mobile: toggle sidebar overlay
    setSidebarOpen((prev) => !prev);
    triggerHaptic('Light');
  }, [deviceType, persistPreference, persistUserSettings]);

  useEffect(() => {
    if (!user || !notificationsEnabled || loginNoticeShownRef.current) return;

    showUiNotice(FREE_PERIOD_NOTICE);
    setNotificationCount(1);
    loginNoticeShownRef.current = true;
  }, [user, notificationsEnabled, showUiNotice]);

  const handleBottomTabSelect = useCallback((tab) => {
    setMobileTab(tab);

    if (tab === 'home') {
      setActiveChatId(null);
      setError('');
      return;
    }
    if (tab === 'chats') {
      setSidebarOpen(true);
      return;
    }
    if (tab === 'new_chat') {
      createNewChat();
      return;
    }
    if (tab === 'tools') {
      handleQuickAction('research');
      return;
    }
    if (tab === 'profile') {
      handleOpenSettings();
    }
  }, [createNewChat, handleOpenSettings, handleQuickAction]);

  // ===== Keydown =====
  const onKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      if (composerMode === 'image') {
        generateImage();
        return;
      }
      sendMessage();
    }
  }, [composerMode, generateImage, isLoading, sendMessage]);

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

  return (
    <>
      <div className="bg-glow" />
      <div
        className={`app-layout device-${deviceType} ${deviceType === 'tablet' ? `tablet-${tabletOrientation}` : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${sidebarOpen && deviceType === 'tablet' ? 'tablet-sidebar-open' : ''} ${compactMessages ? 'compact-messages' : ''} ${minimalVisuals ? 'minimal-visuals' : ''}`}
        data-device={deviceType}
        data-tablet-orientation={deviceType === 'tablet' ? tabletOrientation : undefined}
      >
        <ChatSidebar
          user={user}
          deviceType={deviceType}
          tabletOrientation={tabletOrientation}
          chats={chats}
          activeChatId={activeChatId}
          onSelectChat={(chatId) => {
            setActiveChatId(chatId);
            setMobileTab('chats');
            setError('');
            if (deviceType === 'mobile' || (deviceType === 'tablet' && tabletOrientation === 'portrait')) {
              setSidebarOpen(false);
            }
          }}
          onDeleteChat={deleteChat}
          onCreateNewChat={createNewChat}
          onOpenSettings={handleOpenSettings}
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
          onToggleCollapse={toggleSidebarCollapse}
          isCollapsed={sidebarCollapsed}
          recentChatsExpanded={recentChatsExpanded}
          onToggleRecentChats={() => setRecentChatsExpanded((prev) => !prev)}
          showChatTimestamps={showChatTimestamps}
          onUpgradeClick={handleUpgradeClick}
        />

        {settingsOpen && (
          <SettingsModal
            user={user}
            onClose={() => setSettingsOpen(false)}
            onUpdateUser={(updatedUser) => setUser(updatedUser)}
            theme={theme}
            onToggleTheme={handleToggleThemePreference}
            onSetThemeMode={handleSetThemePreference}
            chatMode={chatMode}
            onChatModeChange={handleSetDefaultMode}
            responseMode={responseMode}
            onResponseModeChange={handleSetResponseMode}
            showChatTimestamps={showChatTimestamps}
            onToggleChatTimestamps={handleToggleChatTimestamps}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebarCollapsed={handleToggleSidebarCollapsedPreference}
            notificationsEnabled={notificationsEnabled}
            onToggleNotifications={handleToggleNotificationsPreference}
            compactMessages={compactMessages}
            onToggleCompactMessages={handleToggleCompactMessages}
            minimalVisuals={minimalVisuals}
            onToggleMinimalVisuals={handleToggleMinimalVisuals}
            settings={currentSettings}
            onPersistSettings={persistUserSettings}
            onLogout={handleLogout}
          />
        )}

        <main className="main-area">
          <ChatHeader
            onOpenSidebar={() => setSidebarOpen(true)}
            onToggleSidebar={toggleSidebarCollapse}
            sidebarOpen={sidebarOpen}
            deviceType={deviceType}
            tabletOrientation={tabletOrientation}
            theme={theme}
            onToggleTheme={handleToggleThemePreference}
            modelMode={modelMode}
            onCycleModelMode={handleCycleModelMode}
            user={user}
            onOpenSettings={handleOpenSettings}
            onOpenNotifications={handleOpenNotifications}
            onCreateNewChat={createNewChat}
            notificationCount={notificationCount}
            onUpgradeClick={handleUpgradeClick}
          />

          <div className={`chat-body ${modeSwitching ? 'mode-switching' : ''}`}>
            {visibleMessages.length === 0 && (
              <EmptyState
                user={user}
                chats={chats}
                chatMode={chatMode}
                deviceType={deviceType}
                minimalVisuals={minimalVisuals}
                onSelectChat={(chatId) => {
                  setActiveChatId(chatId);
                  setMobileTab('chats');
                  setError('');
                }}
                onQuickAction={handleQuickAction}
                quickActionsExpanded={quickActionsExpanded}
                recentChatsExpanded={recentChatsExpanded}
                onToggleQuickActions={() => setQuickActionsExpanded((prev) => !prev)}
                onToggleRecentChats={() => setRecentChatsExpanded((prev) => !prev)}
                showChatTimestamps={showChatTimestamps}
                /* Composer Props for inline rendering */
                input={input}
                onInputChange={setInput}
                onKeyDown={onKeyDown}
                onSend={isLoading ? stopGeneration : composerMode === 'image' ? generateImage : () => sendMessage()}
                onAttachClick={onAttachClick}
                onGenerateImage={handleCreateImageMode}
                onPractice={generatePracticeSet}
                composerMode={composerMode}
                onComposerModeChange={setComposerMode}
                modeLabel={chatModeLabel(chatMode, composerMode)}
                onChatModeChange={handleModeChange}
                fileInputRef={fileInputRef}
                onImageChange={onImageChange}
                selectedImage={selectedImage}
                onRemoveSelectedImage={removeSelectedImage}
                onMic={handleMicTap}
                isListening={isListening}
                micAvailable={canUseVoiceInput}
                isLoading={isLoading}
                imageLoading={imageLoading}
              />
            )}

            {visibleMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                user={user}
                isPinned={isMessagePinned(msg)}
                onTogglePin={() => togglePinnedMessage(msg)}
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

          {(uiNotice || fallbackNotice) && <div className="info-banner"><strong>Notice</strong><span>{uiNotice || fallbackNotice}</span></div>}
          {error && <div className="error-banner"><strong>Warning</strong><span>{error}</span></div>}

          {visibleMessages.length > 0 && (
            <ChatComposer
              input={input}
              onInputChange={setInput}
              onKeyDown={onKeyDown}
              onSend={isLoading ? stopGeneration : composerMode === 'image' ? generateImage : () => sendMessage()}
              onAttachClick={onAttachClick}
              onGenerateImage={handleCreateImageMode}
              onPractice={generatePracticeSet}
              onSummary={createSummaryPrompt}
              chatMode={chatMode}
              onChatModeChange={handleModeChange}
              composerMode={composerMode}
              onComposerModeChange={setComposerMode}
              modeLabel={chatModeLabel(chatMode, composerMode)}
              onCycleLearningMode={handleCycleLearningMode}
              learningMode={learningMode}
              onMic={handleMicTap}
              isListening={isListening}
              micAvailable={canUseVoiceInput}
              isLoading={isLoading}
              imageLoading={imageLoading}
              deviceType={deviceType}
              selectedImage={selectedImage}
              onRemoveSelectedImage={removeSelectedImage}
              textareaRef={textareaRef}
              fileInputRef={fileInputRef}
              onImageChange={onImageChange}
            />
          )}
        </main>

        {deviceType === 'mobile' && (
          <BottomNav
            activeTab={mobileTab}
            onTabSelect={handleBottomTabSelect}
          />
        )}
      </div>
    </>
  );
}
