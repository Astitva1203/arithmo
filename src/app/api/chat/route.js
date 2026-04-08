import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAuthUser } from '@/lib/auth';

export const runtime = 'nodejs';

const BASE_SYSTEM_PROMPT = `You are Arithmo AI, an intelligent adaptive tutor.

Primary goal:
- Do not only answer; teach, guide, and adapt in real time.

Adaptive level behavior:
- Beginner: very simple language, step-by-step, avoid jargon.
- Intermediate: clear explanation with moderate detail.
- Advanced: concise, efficient, technical.
- If level is unknown, start simple and adapt from user signals.

How to infer level:
- Simple/basic questions usually indicate beginner.
- Conceptual questions usually indicate intermediate.
- Technical, compact, or expert wording usually indicates advanced.
- Also track whether the user asks for steps, makes mistakes, or asks follow-ups.
- Update your level assumption continuously within the conversation.

Teaching mode rules:
- For problem solving, show logic instead of only final answers.
- Prefer this structure for learners:
  Step 1 ->
  Step 2 ->
  Final Answer ->
- Highlight key ideas and do not skip important reasoning steps.

Mistake handling:
- If the user is incorrect, do not just say "wrong".
- Explain why and show correct reasoning with a constructive tone.

Follow-up behavior:
- Optionally ask one helpful follow-up question after the answer.
- Examples: "Do you want a simpler explanation?", "Want a shortcut?", "Try a similar one?"
- Do not ask many questions.

Formatting:
- Keep answers clear and structured.
- Use bullets/steps when useful.
- Use fenced code blocks with language labels for programming.
- Use LaTeX-style math when needed.
- Avoid unnecessary long paragraphs.

Confidence meter (MANDATORY):
- Every response must end with:
  Confidence: High / Medium / Low
  Reason: <one short sentence>
- Choose confidence honestly, never always "High", and do not fake certainty.

Important:
- Do not overwhelm beginners.
- Do not oversimplify for advanced users.
- Do not give only final answers unless the user explicitly asks for only the final answer.`;

const MAX_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 4000;
const TITLE_REFINE_MIN_USER_MESSAGES = 2;
const TITLE_REFINE_SEED_LIMIT = 8;

// ===== PROVIDER CONFIGS =====
const GROQ_CONFIG = {
  baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
  model: 'llama-3.3-70b-versatile',
  visionModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
};

const NVIDIA_CONFIG = {
  baseUrl: 'https://integrate.api.nvidia.com/v1/chat/completions',
  model: 'nvidia/nemotron-3-super-120b-a12b',
  maxTokens: 16384,
  temperature: 1,
  topP: 0.95,
};

// Image generation (Freepik)
const FREEPIK_POLL_INTERVAL_MS = 1500;
const FREEPIK_POLL_TIMEOUT_MS = 45000;
const MAX_IMAGE_DATA_URL_LENGTH = 6_000_000;
const MAX_IMAGES_PER_REQUEST = 5;
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

function sanitizeText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
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
  return trimmed.startsWith('https://') || trimmed.startsWith('http://');
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
  const imagePart = content.find(
    (part) => part?.type === 'image_url' && isAllowedImageUrl(part?.image_url?.url)
  );
  return imagePart?.image_url?.url?.trim() || '';
}

function normalizeMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'speed' || mode === 'deep') return mode;
  return null;
}

function inferModeFromText(text) {
  const normalized = String(text || '').toLowerCase();
  if (!normalized) return 'deep';

  const speedPattern = /\b(quick|quickly|just answer|fast|short answer|brief|only answer|final answer only)\b/i;
  const deepPattern = /\b(explain|how|steps|step by step|detailed|teach me|why)\b/i;

  if (speedPattern.test(normalized)) return 'speed';
  if (deepPattern.test(normalized)) return 'deep';
  return 'deep';
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
  if (priorTopic) {
    rewritten[latestIndex] = {
      ...latest,
      content:
        command === 'harder'
          ? `Re-explain the previous topic at a harder level with deeper technical detail and less hand-holding. Topic: ${priorTopic}`
          : `Re-explain the previous topic at an easier level with simple language and clear step-by-step guidance. Topic: ${priorTopic}`,
    };
  } else {
    rewritten[latestIndex] = {
      ...latest,
      content:
        command === 'harder'
          ? 'Use a harder level from now on. Briefly confirm and ask for the next question.'
          : 'Use an easier level from now on. Briefly confirm and ask for the next question.',
    };
  }

  return { messages: rewritten, command };
}

function getLatestUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') {
      return String(messages[i]?.content || '');
    }
  }
  return '';
}

function buildSystemPrompt(mode, difficultyShift = 0) {
  const modeBlock =
    mode === 'speed'
      ? `Mode: SPEED
- Give fast, concise, direct answers.
- Prefer final result with minimal text.
- Keep correctness high.
- Still include the mandatory confidence meter at the end.`
      : `Mode: DEEP
- Give detailed, step-by-step explanations.
- Explain reasoning clearly with structure.
- Add examples only when helpful, not excessive.
- Still include the mandatory confidence meter at the end.`;

  let difficultyBlock = `Difficulty preference: Adaptive baseline.`;
  if (difficultyShift >= 2) {
    difficultyBlock =
      'Difficulty preference: Much harder. Use advanced technical depth, concise expert language, and higher challenge.';
  } else if (difficultyShift === 1) {
    difficultyBlock =
      'Difficulty preference: Harder. Use somewhat more advanced depth and reduced hand-holding.';
  } else if (difficultyShift === -1) {
    difficultyBlock =
      'Difficulty preference: Easier. Use simpler words, more guidance, and explicit step-by-step structure.';
  } else if (difficultyShift <= -2) {
    difficultyBlock =
      'Difficulty preference: Much easier. Keep explanations very simple, slow, and beginner-friendly with minimal jargon.';
  }

  return `${BASE_SYSTEM_PROMPT}\n\n${modeBlock}\n\n${difficultyBlock}`;
}

function hasConfidenceMeter(text) {
  const content = String(text || '');
  return /\bConfidence\s*:\s*(High|Medium|Low)\b/i.test(content) && /\bReason\s*:/i.test(content);
}

function buildFallbackConfidence(mode) {
  if (mode === 'speed') {
    return '\n\nConfidence: Medium\nReason: Quick response based on available context with limited detail.';
  }
  return '\n\nConfidence: Medium\nReason: Based on the provided context, but some assumptions may still apply.';
}

function toSafeMessages(input) {
  if (!Array.isArray(input)) return [];
  return input
    .slice(-MAX_MESSAGES)
    .map((m) => {
      const role = m?.role === 'assistant' ? 'assistant' : 'user';
      const content = sanitizeMessageContent(role, m?.content);
      if (!content) return null;
      return { role, content };
    })
    .filter(Boolean);
}

function countImages(messages) {
  let count = 0;
  for (const message of messages) {
    if (!Array.isArray(message?.content)) continue;
    count += message.content.filter((p) => p?.type === 'image_url').length;
  }
  return count;
}

function extractToken(parsed) {
  const delta = parsed?.choices?.[0]?.delta;
  if (!delta) return '';
  return typeof delta.content === 'string' ? delta.content : '';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ===== Resolve which provider to use =====
function resolveProvider(requested) {
  const groqKey = process.env.GROQ_API_KEY;
  const nvidiaKey = process.env.NVIDIA_API_KEY;

  if (requested === 'nvidia' && nvidiaKey) return 'nvidia';
  if (requested === 'groq' && groqKey) return 'groq';

  // Auto: prefer groq, fallback nvidia
  if (requested === 'auto') {
    if (groqKey) return 'groq';
    if (nvidiaKey) return 'nvidia';
  }

  // Fallback
  if (groqKey) return 'groq';
  if (nvidiaKey) return 'nvidia';
  return null;
}

function resolveTitleProvider(preferred) {
  const groqKey = process.env.GROQ_API_KEY;
  const nvidiaKey = process.env.NVIDIA_API_KEY;

  if (preferred === 'groq' && groqKey) return 'groq';
  if (preferred === 'nvidia' && nvidiaKey) return 'nvidia';

  // Prefer Groq for short title generation for stability.
  if (groqKey) return 'groq';
  if (nvidiaKey) return 'nvidia';
  return null;
}

// ===== Call upstream LLM =====
async function callUpstream(provider, messages, systemPrompt, options = {}) {
  const hasImageInput = Boolean(options.hasImageInput);
  if (provider === 'nvidia') {
    const apiKey = process.env.NVIDIA_API_KEY;
    return fetch(NVIDIA_CONFIG.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: NVIDIA_CONFIG.model,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens: NVIDIA_CONFIG.maxTokens,
        temperature: NVIDIA_CONFIG.temperature,
        top_p: NVIDIA_CONFIG.topP,
        stream: true,
      }),
    });
  }

  // Default: Groq
  const apiKey = process.env.GROQ_API_KEY;
  return fetch(GROQ_CONFIG.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: hasImageInput ? GROQ_CONFIG.visionModel : GROQ_CONFIG.model,
      stream: true,
      temperature: 0.7,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  });
}

function normalizeGeneratedTitle(rawTitle, fallback) {
  const cleaned = String(rawTitle || '')
    .replace(/[`"'“”‘’]/g, '')
    .replace(/[:;.,!?/\\|[\]{}()<>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ').filter(Boolean).slice(0, 6);
  if (words.length >= 3) {
    return words.join(' ');
  }

  const safeFallback = sanitizeText(fallback || 'New Chat')
    .replace(/[:;.,!?/\\|[\]{}()<>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (safeFallback) {
    return safeFallback
      .split(' ')
      .filter(Boolean)
      .slice(0, 6)
      .join(' ');
  }

  return 'New Chat';
}

function normalizeTitleForCompare(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[:;.,!?/\\|[\]{}()<>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function generateSmartTitle(seedMessages, preferredProvider) {
  const transcript = (seedMessages || [])
    .map((line) => sanitizeText(line))
    .filter(Boolean)
    .slice(0, 5)
    .join('\n');

  if (!transcript) return 'New Chat';

  const fallback = transcript.split('\n')[0] || 'New Chat';
  const provider = resolveTitleProvider(preferredProvider || 'auto');
  if (!provider) return normalizeGeneratedTitle('', fallback);

  const payload = {
    messages: [
      { role: 'system', content: TITLE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Create title from these messages:\n${transcript}`,
      },
    ],
    stream: false,
    temperature: 0.2,
  };

  try {
    if (provider === 'nvidia') {
      const apiKey = process.env.NVIDIA_API_KEY;
      const response = await fetch(NVIDIA_CONFIG.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: NVIDIA_CONFIG.model,
          ...payload,
          max_tokens: 32,
        }),
      });
      if (!response.ok) {
        return normalizeGeneratedTitle('', fallback);
      }
      const data = await response.json().catch(() => null);
      const titleText = data?.choices?.[0]?.message?.content || '';
      return normalizeGeneratedTitle(titleText, fallback);
    }

    const apiKey = process.env.GROQ_API_KEY;
    const response = await fetch(GROQ_CONFIG.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_CONFIG.model,
        ...payload,
      }),
    });

    if (!response.ok) {
      return normalizeGeneratedTitle('', fallback);
    }
    const data = await response.json().catch(() => null);
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

  const provider = resolveTitleProvider(preferredProvider || 'auto');
  if (!provider) return normalizeGeneratedTitle('', safeExisting);

  const payload = {
    messages: [
      { role: 'system', content: TITLE_REFINER_PROMPT },
      {
        role: 'user',
        content: `Old Title: ${safeExisting}\nLatest Conversation:\n${transcript}\n\nReturn only improved title.`,
      },
    ],
    stream: false,
    temperature: 0.2,
  };

  try {
    if (provider === 'nvidia') {
      const apiKey = process.env.NVIDIA_API_KEY;
      const response = await fetch(NVIDIA_CONFIG.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: NVIDIA_CONFIG.model,
          ...payload,
          max_tokens: 32,
        }),
      });

      if (!response.ok) {
        return normalizeGeneratedTitle('', safeExisting);
      }

      const data = await response.json().catch(() => null);
      const titleText = data?.choices?.[0]?.message?.content || '';
      return normalizeGeneratedTitle(titleText, safeExisting);
    }

    const apiKey = process.env.GROQ_API_KEY;
    const response = await fetch(GROQ_CONFIG.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_CONFIG.model,
        ...payload,
      }),
    });

    if (!response.ok) {
      return normalizeGeneratedTitle('', safeExisting);
    }

    const data = await response.json().catch(() => null);
    const titleText = data?.choices?.[0]?.message?.content || '';
    return normalizeGeneratedTitle(titleText, safeExisting);
  } catch {
    return normalizeGeneratedTitle('', safeExisting);
  }
}

// ===== IMAGE GENERATION (Freepik) =====
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

// ===== RATE LIMITS =====
const DAILY_IMAGE_LIMIT = 2;

function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // "2026-04-01"
}

async function checkAndIncrementUsage(userId, type) {
  if (type !== 'images') {
    return { allowed: true, remaining: null };
  }

  const limit = DAILY_IMAGE_LIMIT;
  try {
    const db = await getDb();
    if (!db) return { allowed: true, remaining: limit }; // skip if no DB

    const today = getTodayKey();
    const key = `${userId}_${today}`;

    const usage = await db.collection('usage').findOne({ _id: key });
    const currentImages = usage?.images || 0;
    const current = currentImages;

    if (current >= limit) {
      return { allowed: false, remaining: 0, used: current, limit };
    }

    await db.collection('usage').updateOne(
      { _id: key },
      { $inc: { [type]: 1 }, $setOnInsert: { userId, date: today } },
      { upsert: true }
    );

    return { allowed: true, remaining: limit - current - 1 };
  } catch (err) {
    console.error('Rate limit check error (non-fatal):', err.message);
    return { allowed: true, remaining: limit }; // allow on error
  }
}

// ===== POST handler =====
export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    // Get auth for rate limiting
    const auth = getAuthUser(request);
    const userId = auth?.userId || 'anonymous';

    // ===== IMAGE GENERATION =====
    if (body?.generateImage) {
      // Rate limit check
      const usage = await checkAndIncrementUsage(userId, 'images');
      if (!usage.allowed) {
        return NextResponse.json({
          error: `Daily image limit reached (${DAILY_IMAGE_LIMIT}/day). Try again tomorrow!`,
        }, { status: 429 });
      }

      const freepikKey = process.env.FREEPIK_API_KEY;
      if (!freepikKey) {
        return NextResponse.json({ error: 'Image generation not configured. Set FREEPIK_API_KEY.' }, { status: 500 });
      }
      const prompt = sanitizeText(body?.imagePrompt || body?.prompt || '');
      if (!prompt) {
        return NextResponse.json({ error: 'Image prompt is required.' }, { status: 400 });
      }
      try {
        const imageUrl = await generateImage(prompt, freepikKey);
        const imageMessage = `Here's the generated image for: "${prompt}"\n\nConfidence: Medium\nReason: Image output quality depends on prompt specificity and model interpretation.`;
        return NextResponse.json({
          type: 'image',
          content: imageMessage,
          imageUrl,
          remaining: usage.remaining,
        });
      } catch (err) {
        return NextResponse.json({ error: err.message || 'Image generation failed.' }, { status: 502 });
      }
    }

    // ===== CHAT COMPLETION =====
    const safeMessages = toSafeMessages(body?.messages);
    if (safeMessages.length === 0) {
      return NextResponse.json({ error: 'At least one message is required.' }, { status: 400 });
    }
    const imageCount = countImages(safeMessages);
    if (imageCount > MAX_IMAGES_PER_REQUEST) {
      return NextResponse.json(
        { error: `Too many images in one request. Max ${MAX_IMAGES_PER_REQUEST}.` },
        { status: 400 }
      );
    }
    const hasImageInput = imageCount > 0;

    const { messages: effectiveMessages } = applyInstantDifficultyCommand(safeMessages);
    const latestUserText = getLatestUserText(effectiveMessages);
    const requestedMode = normalizeMode(body?.mode);
    const mode = requestedMode || inferModeFromText(latestUserText);
    const difficultyShift = getDifficultyShift(safeMessages);
    const systemPrompt = buildSystemPrompt(mode, difficultyShift);

    const requestedProvider = String(body?.provider || 'auto').toLowerCase();
    let provider = resolveProvider(requestedProvider);

    if (!provider) {
      return NextResponse.json({ error: 'No API keys configured. Set GROQ_API_KEY or NVIDIA_API_KEY.' }, { status: 500 });
    }

    // Vision requests currently rely on Groq vision model.
    if (hasImageInput && provider === 'nvidia') {
      if (process.env.GROQ_API_KEY) {
        provider = 'groq';
      } else {
        return NextResponse.json(
          { error: 'Image analysis needs GROQ_API_KEY when using attached images.' },
          { status: 400 }
        );
      }
    }

    let upstream = await callUpstream(provider, effectiveMessages, systemPrompt, {
      hasImageInput,
    });

    // Fallback to Groq if NVIDIA fails and Groq key is available
    if ((!upstream.ok || !upstream.body) && provider === 'nvidia' && process.env.GROQ_API_KEY) {
      console.log(`NVIDIA failed (${upstream.status}), falling back to Groq`);
      provider = 'groq';
      upstream = await callUpstream('groq', effectiveMessages, systemPrompt, {
        hasImageInput,
      });
    }

    if (!upstream.ok || !upstream.body) {
      const rawError = upstream ? await upstream.text().catch(() => '') : '';
      const label = provider === 'nvidia' ? 'Nemotron' : 'Groq';
      return NextResponse.json(
        { error: `${label} API error (${upstream.status}). ${rawError}` },
        { status: upstream.status || 500 }
      );
    }

    // DB persistence info
    const chatId = body?.chatId || null;
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
              if (!trimmed.startsWith('data:')) continue;
              const payload = trimmed.slice(5).trim();
              if (!payload || payload === '[DONE]') continue;
              try {
                const parsed = JSON.parse(payload);
                const token = extractToken(parsed);
                if (token) {
                  fullResponse += token;
                  controller.enqueue(encoder.encode(token));
                }
              } catch { /* ignore malformed */ }
            }
          }
          if (buffer) {
            const trimmed = buffer.trim();
            if (trimmed.startsWith('data:')) {
              const payload = trimmed.slice(5).trim();
              if (payload && payload !== '[DONE]') {
                try {
                  const parsed = JSON.parse(payload);
                  const token = extractToken(parsed);
                  if (token) {
                    fullResponse += token;
                    controller.enqueue(encoder.encode(token));
                  }
                } catch { /* ignore */ }
              }
            }
          }
        } catch (error) {
          controller.enqueue(encoder.encode(`\n\n[Stream error] ${error?.message || 'Unknown error'}`));
        } finally {
          if (fullResponse.trim() && !hasConfidenceMeter(fullResponse)) {
            const confidenceSuffix = buildFallbackConfidence(mode);
            fullResponse += confidenceSuffix;
            controller.enqueue(encoder.encode(confidenceSuffix));
          }
          // Save to DB
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
                  timestamp: new Date(now.getTime() + 1),
                },
              ]);
              const { ObjectId } = await import('mongodb');
              if (ObjectId.isValid(chatId)) {
                const chat = await db.collection('chats').findOne({
                  _id: ObjectId.createFromHexString(chatId),
                  userId: auth.userId,
                });
                if (chat && chat.title === 'New Chat') {
                  const firstUserMessages = await db.collection('messages')
                    .find({ chatId, role: 'user' })
                    .sort({ timestamp: 1 })
                    .limit(5)
                    .project({ content: 1 })
                    .toArray();

                  const seed = firstUserMessages
                    .map((m) => sanitizeText(m?.content))
                    .filter(Boolean);
                  const generatedTitle = await generateSmartTitle(seed, provider);

                  await db.collection('chats').updateOne(
                    { _id: chat._id },
                    { $set: { title: generatedTitle, updatedAt: now } }
                  );
                } else if (chat) {
                  const userCount = await db.collection('messages').countDocuments({
                    chatId,
                    role: 'user',
                  });

                  let nextTitle = chat.title || 'New Chat';
                  // Refine title continuously as the conversation evolves.
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

                    const refinedTitle = await refineSmartTitle(chat.title, seed, provider);
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
              }
            } catch (dbErr) {
              console.error('DB save error (non-fatal):', dbErr);
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
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Internal server error.' }, { status: 500 });
  }
}
