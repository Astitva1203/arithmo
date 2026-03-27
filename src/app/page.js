'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

const STORAGE_KEY = 'arithmo_messages_v2';
const MAX_IMAGE_FILE_SIZE = 3.5 * 1024 * 1024;

function createId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function CodeBlock({ className, children, inline, ...props }) {
  const match = /language-(\w+)/.exec(className || '');

  if (inline) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }

  return (
    <SyntaxHighlighter
      style={oneDark}
      language={match?.[1] || 'text'}
      PreTag="div"
      customStyle={{ margin: 0, borderRadius: '12px' }}
    >
      {String(children).replace(/\n$/, '')}
    </SyntaxHighlighter>
  );
}

function Message({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`msg-row ${isUser ? 'user' : 'assistant'}`}>
      <div className={`msg-bubble ${isUser ? 'user' : 'assistant'}`}>
        {message.imageDataUrl && (
          <div className="msg-image-wrap">
            <img src={message.imageDataUrl} alt={message.imageName || 'Attached image'} />
          </div>
        )}

        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>
            {message.content}
          </ReactMarkdown>
        )}

        <div className="msg-time">{formatTime(message.timestamp)}</div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const abortRef = useRef(null);
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const speechPrefixRef = useRef('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {
      // ignore broken local storage
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100)));
    } catch {
      // ignore local storage write errors
    }
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    setSpeechSupported(true);
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      setError(`Voice input error: ${event.error || 'microphone unavailable'}`);
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      const merged = `${speechPrefixRef.current}${transcript}`.trim();
      setInput(merged);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, []);

  const visibleMessages = useMemo(() => {
    if (!isLoading || !streamingText) return messages;
    return [
      ...messages,
      {
        id: 'streaming-message',
        role: 'assistant',
        content: streamingText,
        timestamp: Date.now(),
      },
    ];
  }, [messages, isLoading, streamingText]);

  const toggleVoiceInput = useCallback(() => {
    setError('');

    if (!recognitionRef.current) {
      setError('Voice input is not supported in this browser.');
      return;
    }

    try {
      if (isListening) {
        recognitionRef.current.stop();
      } else {
        speechPrefixRef.current = input.trim() ? `${input.trim()} ` : '';
        recognitionRef.current.start();
        textareaRef.current?.focus();
      }
    } catch {
      setError('Could not access microphone. Please allow microphone permission and try again.');
      setIsListening(false);
    }
  }, [input, isListening]);

  const onAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onImageChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError('');

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, JPEG, or WEBP).');
      return;
    }

    if (file.size > MAX_IMAGE_FILE_SIZE) {
      setError('Image is too large. Please use an image under 3.5MB.');
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setSelectedImage({
        dataUrl,
        name: file.name,
        type: file.type,
        size: file.size,
      });
      textareaRef.current?.focus();
    } catch {
      setError('Could not read the selected image. Please try another file.');
    }
  }, []);

  const removeSelectedImage = useCallback(() => {
    setSelectedImage(null);
    textareaRef.current?.focus();
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    const hasImage = Boolean(selectedImage?.dataUrl);

    if ((!text && !hasImage) || isLoading) return;

    setError('');

    const userMessage = {
      id: createId(),
      role: 'user',
      content: text || 'Please analyze this image.',
      timestamp: Date.now(),
      imageDataUrl: selectedImage?.dataUrl || '',
      imageName: selectedImage?.name || '',
    };

    const conversation = [...messages, userMessage];

    const apiConversation = conversation.map((m) => {
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

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);
    setStreamingText('');

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiConversation }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${response.status})`);
      }

      const reader = response.body.getReader();
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

      if (!full.trim()) {
        throw new Error('No response received from model.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: 'assistant',
          content: full,
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      if (err?.name === 'AbortError') return;

      const msg = err?.message || 'Something went wrong. Please try again.';
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: 'assistant',
          content: `[Error] ${msg}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setStreamingText('');
      abortRef.current = null;
    }
  }, [input, isLoading, messages, selectedImage]);

  const stopGeneration = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setIsLoading(false);
    setStreamingText('');
  }, []);

  const clearChat = useCallback(() => {
    if (isLoading) return;
    setMessages([]);
    setError('');
    setStreamingText('');
    setSelectedImage(null);
    localStorage.removeItem(STORAGE_KEY);
  }, [isLoading]);

  const onKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !isLoading) {
        event.preventDefault();
        sendMessage();
      }
    },
    [isLoading, sendMessage]
  );

  return (
    <main className="page">
      <div className="background-glow" />

      <section className="chat-shell">
        <header className="chat-header">
          <div className="brand">
            <img src="/logo.png" alt="Arithmo logo" className="brand-logo" />
            <div>
              <h1>Arithmo AI</h1>
              <p>Groq-powered assistant</p>
            </div>
          </div>
          <div className="header-actions">
            <span className={`status ${isLoading ? 'busy' : 'ready'}`}>
              {isLoading ? 'Thinking...' : 'Online'}
            </span>
            <button className="ghost-btn" onClick={clearChat} disabled={isLoading || messages.length === 0}>
              Clear Chat
            </button>
          </div>
        </header>

        <div className="chat-body">
          {visibleMessages.length === 0 && (
            <div className="welcome">
              <h2>Start chatting</h2>
              <p>Use text, voice, or image attachment. Arithmo will help you instantly.</p>
            </div>
          )}

          {visibleMessages.map((message) => (
            <Message key={message.id} message={message} />
          ))}

          <div ref={endRef} />
        </div>

        {error && <div className="error-banner">{error}</div>}

        <footer className="chat-input-wrap">
          <div className="input-tools">
            <button className="ghost-btn tool-btn" onClick={onAttachClick} type="button">
              Attach Image
            </button>

            <button
              className={`ghost-btn tool-btn ${isListening ? 'listening' : ''}`}
              onClick={toggleVoiceInput}
              type="button"
              disabled={!speechSupported}
              title={speechSupported ? 'Start voice input' : 'Voice input not supported in this browser'}
            >
              {isListening ? 'Stop Mic' : 'Voice Input'}
            </button>

            <span className="tool-hint">Image limit: 3.5MB</span>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              hidden
              onChange={onImageChange}
            />
          </div>

          {selectedImage && (
            <div className="image-chip">
              <img src={selectedImage.dataUrl} alt={selectedImage.name || 'Selected image'} />
              <div className="image-chip-meta">
                <strong>{selectedImage.name}</strong>
                <span>Attached and ready to send</span>
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
              placeholder="Type your message..."
              rows={1}
            />

            {isLoading ? (
              <button className="send-btn stop" onClick={stopGeneration}>
                Stop
              </button>
            ) : (
              <button className="send-btn" onClick={sendMessage} disabled={!input.trim() && !selectedImage}>
                Send
              </button>
            )}
          </div>
        </footer>
      </section>
    </main>
  );
}
