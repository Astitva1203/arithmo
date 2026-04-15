import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAuthUser } from '@/lib/auth';
import { AiRouterError, routeChatRequest } from '@/router/aiRouter';
import { isGroqConfigured, requestGroqChatCompletion } from '@/services/ai/groqService';
import { isGeminiConfigured, requestGeminiChatCompletion } from '@/services/ai/geminiService';
import { isNvidiaConfigured, requestNvidiaChatCompletion } from '@/services/ai/nvidiaService';
import {
  formatSearchResultsForPrompt,
  formatSourcesMarkdown,
  runWebSearch,
  summarizeSearchFailure,
  shouldUseWebSearch,
} from '@/services/search/webSearch';

export const runtime = 'nodejs';

const BASE_SYSTEM_PROMPT = `You are Arithmo AI, an intelligent adaptive tutor designed to personalize explanations based on user understanding.

Core behavior:
- Adapt for Beginner, Intermediate, or Advanced users.
- If level is unknown, start simple and adjust dynamically.
- Teach clearly instead of giving only final answers.
- Use structured steps for learner-focused explanations when helpful.
- Detect and correct mistakes with constructive reasoning.

Mode behavior:
- SPEED MODE: concise, direct, minimal text.
- DEEP MODE: detailed, step-by-step, clear logic.

Instruction quality:
- Use clean formatting with bullets and short sections.
- Use code blocks for code.
- Use math-friendly notation where useful.
- Never expose hidden chain-of-thought or internal reasoning.

Confidence meter (mandatory at end of every response):
Confidence: High | Medium | Low
Reason: one short sentence.`;

const TITLE_SYSTEM_PROMPT = `You are Arithmo AI Chat Title Generator.

Generate a short, clear, meaningful title for the conversation.

Rules:
- 3 to 6 words only
- Human readable and specific
- Proper capitalization
- No punctuation like colon or hyphen
- Output only the title`;

const TITLE_REFINER_PROMPT = `You are Arithmo AI Title Refiner.

Update and improve an existing chat title based on the latest conversation.

Rules:
- 3 to 6 words only
- More specific than before
- Reflect the current main topic
- Replace vague titles with precise ones
- Output only the improved title`;

const MAX_MESSAGES = Number(process.env.MAX_MESSAGES_PER_CHAT || 0);
const MAX_MESSAGE_LENGTH = 8_000;
const MAX_IMAGE_DATA_URL_LENGTH = 6_000_000;
const MAX_IMAGES_PER_REQUEST = 5;
const TITLE_REFINE_MIN_USER_MESSAGES = 2;
const TITLE_REFINE_SEED_LIMIT = 8;
const DAILY_IMAGE_LIMIT = Number(process.env.DAILY_IMAGE_LIMIT || 3);
const FREEPIK_POLL_INTERVAL_MS = 1_500;
const FREEPIK_POLL_TIMEOUT_MS = 45_000;
const ACTION_CHAT = 'chat';
const ACTION_PRACTICE = 'practice';

function sanitizeText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}

function isAllowedImageUrl(url) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:image/')) {
    return trimmed.length <= MAX_IMAGE_DATA_URL_LENGTH;
  }
  return /^https?:\/\//i.test(trimmed);
}

function sanitizeMessageContent(role, content) {
  if (typeof content === 'string') {
    return sanitizeText(content);
  }

  if (!Array.isArray(content)) {
    return '';
  }

  if (role !== 'user') {
    const merged = content
      .filter((part) => part?.type === 'text' && typeof part?.text === 'string')
      .map((part) => sanitizeText(part.text))
      .filter(Boolean)
      .join(' ');
    return sanitizeText(merged);
  }

  const parts = [];
  for (const part of content) {
    if (part?.type === 'text' && typeof part?.text === 'string') {
      const text = sanitizeText(part.text);
      if (text) parts.push({ type: 'text', text });
      continue;
    }
    const imageUrl = part?.image_url?.url;
    if (part?.type === 'image_url' && isAllowedImageUrl(imageUrl)) {
      parts.push({ type: 'image_url', image_url: { url: imageUrl.trim() } });
    }
  }

  const hasText = parts.some((p) => p.type === 'text');
  const hasImage = parts.some((p) => p.type === 'image_url');
  if (hasImage && !hasText) {
    parts.unshift({ type: 'text', text: 'Please analyze this image.' });
  }

  return parts.length > 0 ? parts : '';
}

function toSafeMessages(input) {
  if (!Array.isArray(input)) return [];
  const base = MAX_MESSAGES > 0 ? input.slice(-MAX_MESSAGES) : input;
  return base
    .map((m) => {
      const role = m?.role === 'assistant' ? 'assistant' : 'user';
      const content = sanitizeMessageContent(role, m?.content);
      if (!content) return null;
      return { role, content };
    })
    .filter(Boolean);
}

function getMessageText(content) {
  if (typeof content === 'string') return sanitizeText(content);
  if (!Array.isArray(content)) return '';
  return content
    .filter((part) => part?.type === 'text' && typeof part?.text === 'string')
    .map((part) => sanitizeText(part.text))
    .filter(Boolean)
    .join(' ')
    .trim();
}

function getMessageImageUrl(content) {
  if (!Array.isArray(content)) return '';
  const part = content.find(
    (item) => item?.type === 'image_url' && isAllowedImageUrl(item?.image_url?.url)
  );
  return part?.image_url?.url?.trim() || '';
}

function getLatestUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') {
      return getMessageText(messages[i]?.content);
    }
  }
  return '';
}

function normalizeResponseMode(value) {
  const mode = String(value || '')
    .trim()
    .toLowerCase();
  if (mode === 'speed' || mode === 'deep') return mode;
  return null;
}

function inferResponseMode(text) {
  const normalized = String(text || '').toLowerCase();
  if (!normalized) return 'deep';
  const speedPattern = /\b(quick|quickly|just answer|fast|brief|short answer|final answer only)\b/i;
  const deepPattern = /\b(explain|how|step by step|steps|detailed|teach me|why)\b/i;
  if (speedPattern.test(normalized)) return 'speed';
  if (deepPattern.test(normalized)) return 'deep';
  return 'deep';
}

function normalizeChatMode(value) {
  const mode = String(value || '')
    .trim()
    .toLowerCase();
  if (mode === 'search' || mode === 'chat' || mode === 'research') return mode;
  return 'chat';
}

function normalizeAction(value) {
  const action = String(value || '')
    .trim()
    .toLowerCase();
  if (action === ACTION_PRACTICE) return ACTION_PRACTICE;
  return ACTION_CHAT;
}

function normalizeCommandText(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[.!?]+$/g, '');
}

function getDifficultyCommand(text) {
  const normalized = normalizeCommandText(text);
  if (normalized === 'harder') return 'harder';
  if (normalized === 'easier') return 'easier';
  return null;
}

function getDifficultyShift(messages) {
  let shift = 0;
  for (const message of messages) {
    if (message?.role !== 'user') continue;
    const text = getMessageText(message?.content);
    const command = getDifficultyCommand(text);
    if (command === 'harder') shift = Math.min(2, shift + 1);
    if (command === 'easier') shift = Math.max(-2, shift - 1);
  }
  return shift;
}

function applyInstantDifficultyCommand(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { messages, command: null };
  }

  const latestIndex = messages.length - 1;
  const latest = messages[latestIndex];
  if (!latest || latest.role !== 'user') {
    return { messages, command: null };
  }

  const latestText = getMessageText(latest.content);
  const command = getDifficultyCommand(latestText);
  if (!command) {
    return { messages, command: null };
  }

  let priorTopic = '';
  for (let i = latestIndex - 1; i >= 0; i -= 1) {
    const candidate = messages[i];
    if (candidate?.role !== 'user') continue;
    const text = getMessageText(candidate?.content);
    if (!text || getDifficultyCommand(text)) continue;
    priorTopic = text;
    break;
  }

  const rewritten = [...messages];
  rewritten[latestIndex] = {
    ...latest,
    content: priorTopic
      ? command === 'harder'
        ? `Re-explain the previous topic at a harder level with deeper technical detail. Topic: ${priorTopic}`
        : `Re-explain the previous topic at an easier level with simple language and clear steps. Topic: ${priorTopic}`
      : command === 'harder'
        ? 'Use a harder level from now on. Confirm briefly and ask for the next question.'
        : 'Use an easier level from now on. Confirm briefly and ask for the next question.',
  };

  return { messages: rewritten, command };
}

function buildSystemPrompt({
  responseMode,
  difficultyShift,
  chatMode,
  searchContext,
  searchFailed,
  searchError,
}) {
  const modeBlock =
    responseMode === 'speed'
      ? `SPEED MODE:
- Provide concise and direct answers.
- Keep explanation short while preserving correctness.`
      : `DEEP MODE:
- Provide clear step-by-step reasoning.
- Teach with structure and practical clarity.`;

  let difficultyBlock = 'Difficulty preference: Adaptive baseline.';
  if (difficultyShift >= 2) {
    difficultyBlock =
      'Difficulty preference: Much harder. Use advanced technical depth and higher challenge.';
  } else if (difficultyShift === 1) {
    difficultyBlock = 'Difficulty preference: Harder with more technical detail.';
  } else if (difficultyShift === -1) {
    difficultyBlock =
      'Difficulty preference: Easier with simpler words and explicit step-by-step guidance.';
  } else if (difficultyShift <= -2) {
    difficultyBlock =
      'Difficulty preference: Much easier with very simple language and minimal jargon.';
  }

  const reasoningGuard =
    'Do not output hidden reasoning, scratchpad, chain-of-thought, or internal deliberation. Provide only the final helpful answer.';

  const modeInstruction =
    chatMode === 'research'
      ? `RESEARCH MODE REQUIREMENTS:
- Provide sections in this exact order: Summary, Key Points, Perspectives, Conclusion.
- Use evidence from the provided sources and synthesize insights.
- Keep claims grounded in sources; avoid speculation.
- End with "Sources" and markdown links.`
      : chatMode === 'search'
        ? `SEARCH MODE REQUIREMENTS:
- Give a concise, accurate answer grounded in provided evidence.
- End with "Sources" and markdown links.
- Do not copy snippets verbatim; synthesize findings.`
        : `CHAT MODE REQUIREMENTS:
- Use normal tutoring behavior unless real-time evidence is provided.`;

  const searchBlock = searchContext
    ? `Real-time web context (use these findings as grounding for freshness):
${searchContext}

If web context is used, include a short "Sources" section with links.`
    : 'No external web context was provided for this turn.';

  const freshnessBlock =
    searchFailed && (chatMode === 'search' || chatMode === 'research')
      ? `Search retrieval failed this turn. Mention freshness limits briefly and continue with best-effort knowledge.
Search issue: ${searchError || 'unknown error'}.`
      : '';

  return `${BASE_SYSTEM_PROMPT}

${modeBlock}

${difficultyBlock}

${reasoningGuard}

${modeInstruction}

${searchBlock}

${freshnessBlock}`;
}

function hasConfidenceMeter(text) {
  const content = String(text || '');
  return /\bConfidence\s*:\s*(High|Medium|Low)\b/i.test(content) && /\bReason\s*:/i.test(content);
}

function buildFallbackConfidence(responseMode) {
  if (responseMode === 'speed') {
    return '\n\nConfidence: Medium\nReason: Quick response generated from available context.';
  }
  return '\n\nConfidence: Medium\nReason: Response is based on provided context and may require verification.';
}

function countImages(messages) {
  let count = 0;
  for (const message of messages) {
    if (!Array.isArray(message?.content)) continue;
    count += message.content.filter((p) => p?.type === 'image_url').length;
  }
  return count;
}

function parseStreamToken(payload) {
  const delta = payload?.choices?.[0]?.delta;
  if (!delta) return '';
  return typeof delta.content === 'string' ? delta.content : '';
}

function normalizeProvider(value) {
  const provider = String(value || 'auto').trim().toLowerCase();
  if (provider === 'groq' || provider === 'gemini' || provider === 'nvidia' || provider === 'auto') {
    return provider;
  }
  return 'auto';
}

function normalizeModelMode(value) {
  const mode = String(value || 'auto').trim().toLowerCase();
  if (mode === 'auto' || mode === 'fast' || mode === 'smart' || mode === 'deep') {
    return mode;
  }
  return 'auto';
}

function normalizeGeneratedTitle(rawTitle, fallback) {
  const cleaned = String(rawTitle || '')
    .replace(/["'“”‘’]/g, '')
    .replace(/[:;.,!?/\\|[\]{}()<>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ').filter(Boolean).slice(0, 6);
  if (words.length >= 3) return words.join(' ');

  const safeFallback = sanitizeText(fallback || 'New Chat')
    .replace(/[:;.,!?/\\|[\]{}()<>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!safeFallback) return 'New Chat';
  return safeFallback
    .split(' ')
    .filter(Boolean)
    .slice(0, 6)
    .join(' ');
}

function normalizeTitleForCompare(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[:;.,!?/\\|[\]{}()<>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveTitleProvider(preferredProvider) {
  const preferred = normalizeProvider(preferredProvider);
  if (preferred === 'groq' && isGroqConfigured()) return 'groq';
  if (preferred === 'gemini' && isGeminiConfigured()) return 'gemini';
  if (preferred === 'nvidia' && isNvidiaConfigured()) return 'nvidia';
  if (isGroqConfigured()) return 'groq';
  if (isGeminiConfigured()) return 'gemini';
  if (isNvidiaConfigured()) return 'nvidia';
  return null;
}

async function completeWithProvider(provider, payload) {
  if (provider === 'gemini') {
    return requestGeminiChatCompletion(payload);
  }
  if (provider === 'nvidia') {
    return requestNvidiaChatCompletion(payload);
  }
  return requestGroqChatCompletion(payload);
}

async function generateSmartTitle(seedMessages, preferredProvider) {
  const transcript = (seedMessages || [])
    .map((line) => sanitizeText(line))
    .filter(Boolean)
    .slice(0, 5)
    .join('\n');

  if (!transcript) return 'New Chat';

  const fallback = transcript.split('\n')[0] || 'New Chat';
  const provider = resolveTitleProvider(preferredProvider);
  if (!provider) return normalizeGeneratedTitle('', fallback);

  try {
    const { response, data } = await completeWithProvider(provider, {
      systemPrompt: TITLE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Create title from these messages:\n${transcript}` }],
      maxTokens: 32,
      temperature: 0.2,
      timeoutMs: 20_000,
    });

    if (!response.ok) return normalizeGeneratedTitle('', fallback);
    const titleText = data?.choices?.[0]?.message?.content || '';
    return normalizeGeneratedTitle(titleText, fallback);
  } catch {
    return normalizeGeneratedTitle('', fallback);
  }
}

async function refineSmartTitle(existingTitle, seedMessages, preferredProvider) {
  const transcript = (seedMessages || [])
    .map((line) => sanitizeText(line))
    .filter(Boolean)
    .slice(-6)
    .join('\n');

  const safeExisting = sanitizeText(existingTitle || 'New Chat');
  if (!transcript) return normalizeGeneratedTitle('', safeExisting);

  const provider = resolveTitleProvider(preferredProvider);
  if (!provider) return normalizeGeneratedTitle('', safeExisting);

  try {
    const { response, data } = await completeWithProvider(provider, {
      systemPrompt: TITLE_REFINER_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Old Title: ${safeExisting}\nLatest Conversation:\n${transcript}\n\nReturn only improved title.`,
        },
      ],
      maxTokens: 32,
      temperature: 0.2,
      timeoutMs: 20_000,
    });

    if (!response.ok) return normalizeGeneratedTitle('', safeExisting);
    const titleText = data?.choices?.[0]?.message?.content || '';
    return normalizeGeneratedTitle(titleText, safeExisting);
  } catch {
    return normalizeGeneratedTitle('', safeExisting);
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateImage(prompt, apiKey) {
  const createRes = await fetch('https://api.freepik.com/v1/ai/mystic', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-freepik-api-key': apiKey,
    },
    body: JSON.stringify({ prompt }),
  });

  if (!createRes.ok) {
    const err = await createRes.text().catch(() => '');
    throw new Error(`Freepik API error (${createRes.status}). ${err}`);
  }

  const taskPayload = await createRes.json().catch(() => null);
  const taskData = taskPayload?.data || {};
  const taskId = String(taskData?.task_id || '').trim();
  const immediateUrl = (taskData?.generated || []).find((u) => typeof u === 'string' && u.trim());
  if (immediateUrl) return immediateUrl;
  if (!taskId) throw new Error('Freepik image task could not be started.');

  const deadline = Date.now() + FREEPIK_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(FREEPIK_POLL_INTERVAL_MS);
    const pollRes = await fetch(`https://api.freepik.com/v1/ai/mystic/${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json', 'x-freepik-api-key': apiKey },
    });

    if (!pollRes.ok) throw new Error(`Freepik poll error (${pollRes.status}).`);
    const pollData = await pollRes.json().catch(() => null);
    const status = String(pollData?.data?.status || '').toUpperCase();
    const imageUrl = (pollData?.data?.generated || []).find((u) => typeof u === 'string' && u.trim());
    if (imageUrl) return imageUrl;
    if (status === 'FAILED' || status === 'ERROR' || status === 'CANCELLED') {
      throw new Error(`Image generation ${status.toLowerCase()}.`);
    }
  }

  throw new Error('Image generation timed out. Try again.');
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function checkAndIncrementImageUsage(userId) {
  try {
    const db = await getDb();
    if (!db) return { allowed: true, remaining: DAILY_IMAGE_LIMIT };

    const today = getTodayKey();
    const key = `${userId}_${today}`;
    const usage = await db.collection('usage').findOne({ _id: key });
    const used = usage?.images || 0;

    if (used >= DAILY_IMAGE_LIMIT) {
      return { allowed: false, remaining: 0, used, limit: DAILY_IMAGE_LIMIT };
    }

    await db.collection('usage').updateOne(
      { _id: key },
      { $inc: { images: 1 }, $setOnInsert: { userId, date: today } },
      { upsert: true }
    );

    return { allowed: true, remaining: DAILY_IMAGE_LIMIT - used - 1 };
  } catch (error) {
    console.error('Image usage check error (non-fatal):', error?.message || error);
    return { allowed: true, remaining: DAILY_IMAGE_LIMIT };
  }
}

function appendSourcesIfNeeded(responseText, sourcesMarkdown, sourceUrls) {
  if (!sourcesMarkdown) return responseText;
  const text = String(responseText || '');
  const hasAnySourceUrl = (sourceUrls || []).some((url) => text.includes(url));
  if (hasAnySourceUrl || /\bSources\s*:/i.test(text)) return text;
  return `${text}\n\n${sourcesMarkdown}`.trim();
}

function appendSectionIfMissing(responseText, header, body) {
  const text = String(responseText || '');
  if (!body) return text;
  const hasSection = new RegExp(`\\b${header}\\s*:`, 'i').test(text);
  if (hasSection) return text;
  return `${text}\n\n${header}:\n${body}`.trim();
}

function enforceResearchSections(responseText, topicText) {
  let text = String(responseText || '').trim();
  const topic = sanitizeText(topicText || 'the topic');

  text = appendSectionIfMissing(text, 'Summary', `A concise overview of ${topic}.`);
  text = appendSectionIfMissing(
    text,
    'Key Points',
    ['- Core facts and definitions', '- Most important developments', '- Practical takeaway'].join('\n')
  );
  text = appendSectionIfMissing(
    text,
    'Perspectives',
    ['- Current viewpoint', '- Alternative interpretation', '- Common limitation or caveat'].join('\n')
  );
  text = appendSectionIfMissing(text, 'Conclusion', `A grounded conclusion for ${topic}.`);

  return text;
}

function buildNextQuestionSuggestions(topicText) {
  const topic = sanitizeText(topicText || 'this topic').slice(0, 120) || 'this topic';
  return [
    `- What are the latest updates related to ${topic}?`,
    `- How does ${topic} compare with previous trends?`,
    `- What should I learn next about ${topic}?`,
  ].join('\n');
}

function applyPracticeAction(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return messages;
  const latestIndex = messages.length - 1;
  const latest = messages[latestIndex];
  const latestText = getMessageText(latest?.content) || 'general problem solving';

  const rewritten = [...messages];
  rewritten[latestIndex] = {
    ...latest,
    role: 'user',
    content: `Generate a practice set on: ${latestText}

Return exactly:
1) Five practice questions
2) Answer key
3) Difficulty notes (easy, medium, or hard for each question)
4) One short improvement tip`,
  };
  return rewritten;
}

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const auth = getAuthUser(request);
    const userId = auth?.userId || 'anonymous';

    // Image generation mode
    if (body?.generateImage) {
      const usage = await checkAndIncrementImageUsage(userId);
      if (!usage.allowed) {
        return NextResponse.json(
          { error: `Daily image limit reached (${DAILY_IMAGE_LIMIT}/day). Try again tomorrow.` },
          { status: 429 }
        );
      }

      const freepikKey = process.env.FREEPIK_API_KEY;
      if (!freepikKey) {
        return NextResponse.json(
          { error: 'Image generation is not configured. Set FREEPIK_API_KEY.' },
          { status: 500 }
        );
      }

      const prompt = sanitizeText(body?.imagePrompt || body?.prompt || '');
      if (!prompt) {
        return NextResponse.json({ error: 'Image prompt is required.' }, { status: 400 });
      }

      try {
        const imageUrl = await generateImage(prompt, freepikKey);
        return NextResponse.json({
          type: 'image',
          content: `Generated image for: "${prompt}"\n\nConfidence: Medium\nReason: Output quality depends on prompt precision and model interpretation.`,
          imageUrl,
          remaining: usage.remaining,
        });
      } catch (error) {
        return NextResponse.json(
          { error: error?.message || 'Image generation failed.' },
          { status: 502 }
        );
      }
    }

    // Chat mode
    const safeMessages = toSafeMessages(body?.messages);
    if (safeMessages.length === 0) {
      return NextResponse.json({ error: 'At least one message is required.' }, { status: 400 });
    }

    const imageCount = countImages(safeMessages);
    if (imageCount > MAX_IMAGES_PER_REQUEST) {
      return NextResponse.json(
        { error: `Too many images in one request. Maximum is ${MAX_IMAGES_PER_REQUEST}.` },
        { status: 400 }
      );
    }

    const hasImageInput = imageCount > 0;
    const chatId = body?.chatId || null;
    const requestedProvider = normalizeProvider(body?.provider);
    const modelMode = normalizeModelMode(body?.modelMode);
    const chatMode = normalizeChatMode(body?.chatMode);
    const action = normalizeAction(body?.action);

    const difficultyAdjusted = applyInstantDifficultyCommand(safeMessages).messages;
    const effectiveMessages =
      action === ACTION_PRACTICE ? applyPracticeAction(difficultyAdjusted) : difficultyAdjusted;
    const latestUserText = getLatestUserText(effectiveMessages);
    if (!latestUserText && !hasImageInput) {
      return NextResponse.json({ error: 'Message content is required.' }, { status: 400 });
    }
    if (action === ACTION_PRACTICE && hasImageInput) {
      return NextResponse.json(
        { error: 'Practice generation does not support image attachments in the same request.' },
        { status: 400 }
      );
    }
    const requestedResponseMode = normalizeResponseMode(body?.responseMode || body?.mode);
    const responseMode = requestedResponseMode || inferResponseMode(latestUserText);
    const difficultyShift = getDifficultyShift(safeMessages);

    // RAG / search stage
    const wantSearch = shouldUseWebSearch({ query: latestUserText, chatMode });
    let searchResult = {
      used: false,
      provider: 'none',
      results: [],
      error: null,
    };

    if (wantSearch && latestUserText) {
      searchResult = await runWebSearch({
        query: latestUserText,
        limit: chatMode === 'research' ? 5 : 5,
        timeoutMs: 10_000,
        mode: chatMode,
      });
    }

    const searchContext = searchResult.used
      ? formatSearchResultsForPrompt(searchResult.results || [])
      : '';
    const sourceUrls = (searchResult.results || []).map((item) => item.url).filter(Boolean);
    const sourcesMarkdown = formatSourcesMarkdown(searchResult.results || []);

    const systemPrompt = buildSystemPrompt({
      responseMode,
      difficultyShift,
      chatMode,
      searchContext,
      searchFailed: wantSearch && !searchResult.used,
      searchError: searchResult.error,
    });

    let routeResult;
    try {
      routeResult = await routeChatRequest({
        requestedProvider,
        modelMode,
        messages: effectiveMessages,
        systemPrompt,
        latestUserText,
        hasImageInput,
        chatMode,
        responseMode,
        timeoutMs: 75_000,
      });
    } catch (error) {
      if (error instanceof AiRouterError) {
        return NextResponse.json(
          {
            error: error.message,
            details: error.details || [],
          },
          { status: error.status || 502 }
        );
      }
      return NextResponse.json(
        { error: error?.message || 'AI routing failed unexpectedly.' },
        { status: 502 }
      );
    }

    const upstream = routeResult.response;
    const providerUsed = routeResult.providerUsed;
    const fallbackUsed = Boolean(routeResult.fallbackUsed);
    const fallbackFrom = routeResult.fallbackFrom || '';
    const queryComplexity = routeResult.queryComplexity || 'medium';
    const routeReason = routeResult.routeReason || 'auto_router';
    const modelModeUsed = routeResult.modelMode || modelMode || 'auto';
    const elapsedMs = Number(routeResult.elapsedMs || 0);

    const lastUserMessage = [...effectiveMessages].reverse().find((m) => m.role === 'user');
    const userContent = getMessageText(lastUserMessage?.content) || 'Please analyze this image.';
    const userImageDataUrl = getMessageImageUrl(lastUserMessage?.content);

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = upstream.body.getReader();
    let fullResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;

              if (trimmed.startsWith('data:')) {
                const payload = trimmed.slice(5).trim();
                if (!payload || payload === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(payload);
                  const token = parseStreamToken(parsed);
                  if (token) {
                    fullResponse += token;
                    controller.enqueue(encoder.encode(token));
                  }
                } catch {
                  fullResponse += payload;
                  controller.enqueue(encoder.encode(payload));
                }
                continue;
              }

              // Fallback for non-SSE text chunks
              fullResponse += trimmed;
              controller.enqueue(encoder.encode(trimmed));
            }
          }

          if (buffer.trim()) {
            const pending = buffer.trim();
            if (pending.startsWith('data:')) {
              const payload = pending.slice(5).trim();
              if (payload && payload !== '[DONE]') {
                try {
                  const parsed = JSON.parse(payload);
                  const token = parseStreamToken(parsed);
                  if (token) {
                    fullResponse += token;
                    controller.enqueue(encoder.encode(token));
                  }
                } catch {
                  fullResponse += payload;
                  controller.enqueue(encoder.encode(payload));
                }
              }
            } else {
              fullResponse += pending;
              controller.enqueue(encoder.encode(pending));
            }
          }
        } catch (error) {
          const streamError = `\n\n[Stream error] ${error?.message || 'Unknown stream issue'}`;
          fullResponse += streamError;
          controller.enqueue(encoder.encode(streamError));
        } finally {
          if (wantSearch && !searchResult.used && (chatMode === 'search' || chatMode === 'research')) {
            const freshnessNote = appendSectionIfMissing(
              fullResponse,
              'Freshness Notice',
              summarizeSearchFailure(searchResult.error)
            );
            if (freshnessNote !== fullResponse) {
              const suffix = freshnessNote.slice(fullResponse.length);
              fullResponse = freshnessNote;
              if (suffix) controller.enqueue(encoder.encode(suffix));
            }
          }

          if (searchResult.used && searchResult.results?.length) {
            const withSources = appendSourcesIfNeeded(fullResponse, sourcesMarkdown, sourceUrls);
            if (withSources !== fullResponse) {
              const suffix = withSources.slice(fullResponse.length);
              fullResponse = withSources;
              if (suffix) controller.enqueue(encoder.encode(suffix));
            }
          }

          if (chatMode === 'research') {
            const withResearchSections = enforceResearchSections(fullResponse, latestUserText);
            if (withResearchSections !== fullResponse) {
              const suffix = withResearchSections.slice(fullResponse.length);
              fullResponse = withResearchSections;
              if (suffix) controller.enqueue(encoder.encode(suffix));
            }
          }

          if (chatMode === 'search' || chatMode === 'research') {
            const nextQuestionsBlock = buildNextQuestionSuggestions(latestUserText);
            const withNextQuestions = appendSectionIfMissing(
              fullResponse,
              'Next Questions',
              nextQuestionsBlock
            );
            if (withNextQuestions !== fullResponse) {
              const suffix = withNextQuestions.slice(fullResponse.length);
              fullResponse = withNextQuestions;
              if (suffix) controller.enqueue(encoder.encode(suffix));
            }
          }

          if (fullResponse.trim() && !hasConfidenceMeter(fullResponse)) {
            const confidenceSuffix = buildFallbackConfidence(responseMode);
            fullResponse += confidenceSuffix;
            controller.enqueue(encoder.encode(confidenceSuffix));
          }

          if (auth?.userId && chatId && fullResponse.trim()) {
            try {
              const db = await getDb();
              if (!db) throw new Error('DB unavailable');
              const now = new Date();

              await db.collection('messages').insertMany([
                {
                  chatId,
                  role: 'user',
                  content: userContent,
                  ...(userImageDataUrl ? { imageDataUrl: userImageDataUrl } : {}),
                  timestamp: now,
                },
                {
                  chatId,
                  role: 'assistant',
                  content: fullResponse,
                  provider: providerUsed,
                  modelMode: modelModeUsed,
                  routeReason,
                  queryComplexity,
                  fallbackUsed,
                  fallbackFrom,
                  mode: chatMode,
                  action,
                  ragUsed: Boolean(searchResult.used),
                  researchUsed: chatMode === 'research' && Boolean(searchResult.used),
                  sources: searchResult.results || [],
                  timestamp: new Date(now.getTime() + 1),
                },
              ]);

              const { ObjectId } = await import('mongodb');
              if (!ObjectId.isValid(chatId)) {
                controller.close();
                return;
              }

              const chat = await db.collection('chats').findOne({
                _id: ObjectId.createFromHexString(chatId),
                userId: auth.userId,
              });
              if (!chat) {
                controller.close();
                return;
              }

              if (chat.title === 'New Chat') {
                const firstUserMessages = await db.collection('messages')
                  .find({ chatId, role: 'user' })
                  .sort({ timestamp: 1 })
                  .limit(5)
                  .project({ content: 1 })
                  .toArray();

                const seed = firstUserMessages
                  .map((m) => sanitizeText(m?.content))
                  .filter(Boolean);

                const generatedTitle = await generateSmartTitle(seed, providerUsed);
                await db.collection('chats').updateOne(
                  { _id: chat._id },
                  { $set: { title: generatedTitle, updatedAt: now } }
                );
              } else {
                const userCount = await db.collection('messages').countDocuments({
                  chatId,
                  role: 'user',
                });

                let nextTitle = chat.title || 'New Chat';
                if (userCount >= TITLE_REFINE_MIN_USER_MESSAGES) {
                  const recentUserMessages = await db.collection('messages')
                    .find({ chatId, role: 'user' })
                    .sort({ timestamp: -1 })
                    .limit(TITLE_REFINE_SEED_LIMIT)
                    .project({ content: 1 })
                    .toArray();

                  const seed = recentUserMessages
                    .map((m) => sanitizeText(m?.content))
                    .filter(Boolean)
                    .reverse();

                  const refinedTitle = await refineSmartTitle(chat.title, seed, providerUsed);
                  if (
                    refinedTitle &&
                    normalizeTitleForCompare(refinedTitle) !== normalizeTitleForCompare(chat.title)
                  ) {
                    nextTitle = refinedTitle;
                  }
                }

                await db.collection('chats').updateOne(
                  { _id: chat._id },
                  { $set: { title: nextTitle, updatedAt: now } }
                );
              }
            } catch (error) {
              console.error('DB save error (non-fatal):', error);
            }
          }

          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'x-ai-provider': providerUsed,
        'x-ai-model-mode': modelModeUsed,
        'x-ai-route-reason': routeReason,
        'x-ai-query-complexity': queryComplexity,
        'x-ai-fallback-used': fallbackUsed ? '1' : '0',
        'x-ai-fallback-from': fallbackFrom,
        'x-ai-latency-ms': String(elapsedMs),
        'x-rag-used': searchResult.used ? '1' : '0',
        'x-search-provider': searchResult.provider || 'none',
        'x-research-used': chatMode === 'research' && searchResult.used ? '1' : '0',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

