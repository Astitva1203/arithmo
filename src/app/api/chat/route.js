import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are Arithmo AI, a smart, friendly assistant.
- Give clear and useful answers.
- Use markdown when helpful.
- For code, use fenced code blocks with language labels.
- If unsure, say so honestly.`;

const MAX_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_IMAGE_DATA_URL_LENGTH = 5700000;
const MAX_IMAGES_PER_REQUEST = 5;
const DEFAULT_IMAGE_DAILY_LIMIT = 3;
const DEFAULT_FREEPIK_POLL_INTERVAL_MS = 1500;
const DEFAULT_FREEPIK_POLL_TIMEOUT_MS = 45000;
const GROQ_TEXT_MODEL = 'llama-3.3-70b-versatile';
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const NVIDIA_MODEL = 'nvidia/nemotron-3-super-120b-a12b';
const imageGenerationUsage = new Map();

function readApiKeys(...sources) {
  const unique = new Set();

  for (const source of sources) {
    if (typeof source !== 'string') continue;

    for (const item of source.split(',')) {
      const key = item.trim();
      if (!key || key.includes('your_')) continue;
      unique.add(key);
    }
  }

  return Array.from(unique);
}

function sanitizeText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}

function normalizeProvider(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  if (normalized === 'groq' || normalized === 'nvidia' || normalized === 'auto') {
    return normalized;
  }

  return 'auto';
}

function getCurrentUtcDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function getClientIdentifier(request) {
  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  const realIp = request.headers.get('x-real-ip') || '';
  const firstIp = forwardedFor
    .split(',')
    .map((part) => part.trim())
    .find(Boolean);

  return firstIp || realIp || 'unknown-client';
}

function getUsageRecordKey(request) {
  const dayKey = getCurrentUtcDateKey();
  const clientId = getClientIdentifier(request);
  return `${dayKey}:${clientId}`;
}

function cleanupOldUsageCounters(dayKey) {
  for (const existingKey of imageGenerationUsage.keys()) {
    if (!existingKey.startsWith(`${dayKey}:`)) {
      imageGenerationUsage.delete(existingKey);
    }
  }
}

function getImageQuotaState(request, limit) {
  const dailyLimit = Number.isFinite(limit) ? limit : DEFAULT_IMAGE_DAILY_LIMIT;
  const dayKey = getCurrentUtcDateKey();
  cleanupOldUsageCounters(dayKey);

  if (dailyLimit <= 0) {
    return {
      allowed: true,
      remaining: Infinity,
      used: 0,
      limit: 0,
      resetAtUtc: `${dayKey}T23:59:59.999Z`,
    };
  }

  const key = getUsageRecordKey(request);
  const used = imageGenerationUsage.get(key) || 0;
  const allowed = used < dailyLimit;

  return {
    allowed,
    remaining: Math.max(dailyLimit - used, 0),
    used,
    limit: dailyLimit,
    resetAtUtc: `${dayKey}T23:59:59.999Z`,
  };
}

function consumeImageGenerationQuota(request, limit) {
  const quota = getImageQuotaState(request, limit);
  if (!quota.allowed || quota.limit <= 0) return quota;

  const key = getUsageRecordKey(request);
  const nextUsed = quota.used + 1;
  imageGenerationUsage.set(key, nextUsed);

  return {
    ...quota,
    used: nextUsed,
    remaining: Math.max(quota.limit - nextUsed, 0),
  };
}

function isAllowedImageUrl(url) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();

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
    const mergedText = content
      .filter((part) => part?.type === 'text' && typeof part?.text === 'string')
      .map((part) => sanitizeText(part.text))
      .filter(Boolean)
      .join(' ');

    return sanitizeText(mergedText);
  }

  const parts = [];

  for (const part of content) {
    if (part?.type === 'text' && typeof part?.text === 'string') {
      const text = sanitizeText(part.text);
      if (text) {
        parts.push({ type: 'text', text });
      }
      continue;
    }

    const imageUrl = part?.image_url?.url;
    if (part?.type === 'image_url' && isAllowedImageUrl(imageUrl)) {
      parts.push({ type: 'image_url', image_url: { url: imageUrl.trim() } });
    }
  }

  const hasTextPart = parts.some((p) => p.type === 'text');
  const hasImagePart = parts.some((p) => p.type === 'image_url');

  if (hasImagePart && !hasTextPart) {
    parts.unshift({ type: 'text', text: 'Please analyze this image.' });
  }

  return parts.length > 0 ? parts : '';
}

function getMessageText(content) {
  if (typeof content === 'string') {
    return sanitizeText(content);
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .filter((part) => part?.type === 'text' && typeof part?.text === 'string')
    .map((part) => sanitizeText(part.text))
    .filter(Boolean)
    .join(' ')
    .trim();
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

function resolveIncomingMessages(body) {
  const fromMessages = toSafeMessages(body?.messages);
  if (fromMessages.length > 0) return fromMessages;

  const fallbackText = sanitizeText(
    body?.message || body?.prompt || body?.input || body?.query || ''
  );
  if (!fallbackText) return [];

  return [{ role: 'user', content: fallbackText }];
}

function countImages(messages) {
  let count = 0;

  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;
    count += msg.content.filter((part) => part.type === 'image_url').length;
  }

  return count;
}

function getLatestUserPrompt(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== 'user') continue;

    const text = getMessageText(message.content);
    if (text) return text;
  }

  return '';
}

function getGroqConfig() {
  return {
    apiKeys: readApiKeys(process.env.GROQ_API_KEY),
    baseUrl: 'https://api.groq.com/openai/v1',
    textModel: GROQ_TEXT_MODEL,
    visionModel: GROQ_VISION_MODEL,
  };
}

function getNvidiaConfig() {
  return {
    apiKeys: readApiKeys(process.env.NVIDIA_API_KEY),
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    textModel: NVIDIA_MODEL,
    visionModel: NVIDIA_MODEL,
    maxTokens: 16384,
    temperature: 1,
    topP: 0.95,
    reasoningBudget: 16384,
    includeReasoning: false,
  };
}

function getFreepikConfig() {
  return {
    apiKeys: readApiKeys(process.env.FREEPIK_API_KEY),
    baseUrl: 'https://api.freepik.com',
    imageDailyLimit: DEFAULT_IMAGE_DAILY_LIMIT,
    pollIntervalMs: DEFAULT_FREEPIK_POLL_INTERVAL_MS,
    pollTimeoutMs: DEFAULT_FREEPIK_POLL_TIMEOUT_MS,
  };
}

function buildOpenAiCompatibleChatUrl(baseUrl, fallback) {
  const clean = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!clean) return fallback;
  if (clean.endsWith('/chat/completions')) return clean;
  return `${clean}/chat/completions`;
}

function buildFreepikApiUrl(baseUrl, path) {
  const cleanBase = (baseUrl || 'https://api.freepik.com').replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

function pickProvider(preferred, hasGroqKey, hasNvidiaKey) {
  if (preferred === 'groq') {
    if (hasGroqKey) return 'groq';
    if (hasNvidiaKey) return 'nvidia';
    return 'groq';
  }

  if (preferred === 'nvidia') {
    if (hasNvidiaKey) return 'nvidia';
    if (hasGroqKey) return 'groq';
    return 'nvidia';
  }

  if (hasGroqKey) return 'groq';
  if (hasNvidiaKey) return 'nvidia';
  return 'groq';
}

async function requestWithFallback(apiKeys, requestFn) {
  let lastResponse = null;

  for (let i = 0; i < apiKeys.length; i += 1) {
    const response = await requestFn(apiKeys[i]);
    lastResponse = response;

    if (response.ok && response.body) {
      return response;
    }

    const canTryNextKey = i < apiKeys.length - 1;
    const retriableStatus =
      response.status === 401 || response.status === 403 || response.status === 429;

    if (!canTryNextKey || !retriableStatus) {
      return response;
    }
  }

  return lastResponse;
}

async function createGroqUpstream({ safeMessages, hasImageInput, config }) {
  const model = hasImageInput ? config.visionModel : config.textModel;
  const chatUrl = buildOpenAiCompatibleChatUrl(
    config.baseUrl,
    'https://api.groq.com/openai/v1/chat/completions'
  );

  return requestWithFallback(config.apiKeys, async (apiKey) =>
    fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        temperature: 0.7,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...safeMessages],
      }),
    })
  );
}

async function createNvidiaUpstream({ safeMessages, hasImageInput, config }) {
  const model = hasImageInput ? config.visionModel : config.textModel;
  const chatUrl = buildOpenAiCompatibleChatUrl(
    config.baseUrl,
    'https://integrate.api.nvidia.com/v1/chat/completions'
  );

  return requestWithFallback(config.apiKeys, async (apiKey) => {
    const basePayload = {
      model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...safeMessages],
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      top_p: config.topP,
      stream: true,
    };

    const richPayload = {
      ...basePayload,
      chat_template_kwargs: { enable_thinking: true },
      reasoning_budget: config.reasoningBudget,
    };

    const primary = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(richPayload),
    });

    // Some NVIDIA setups reject reasoning fields with 400.
    if (primary.status !== 400) {
      return primary;
    }

    return fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(basePayload),
    });
  });
}

function extractOpenAiCompatibleToken(parsed, includeReasoning = false) {
  const delta = parsed?.choices?.[0]?.delta;
  if (!delta) return '';

  let out = '';
  if (includeReasoning && typeof delta.reasoning_content === 'string') {
    out += delta.reasoning_content;
  }
  if (typeof delta.content === 'string') {
    out += delta.content;
  }
  return out;
}

function createTokenResponse(upstream, options = {}) {
  const includeReasoning = Boolean(options.includeReasoning);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = '';

      const emitFromLine = (line) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) return;

        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') return;

        try {
          const parsed = JSON.parse(payload);
          const token = extractOpenAiCompatibleToken(parsed, includeReasoning);
          if (token) {
            controller.enqueue(encoder.encode(token));
          }
        } catch {
          // Ignore malformed partial lines.
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            emitFromLine(line);
          }
        }

        if (buffer) {
          emitFromLine(buffer);
        }
      } catch (error) {
        controller.enqueue(
          encoder.encode(`\n\n[Stream error] ${error?.message || 'Unknown error'}`)
        );
      } finally {
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
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeFreepikStatus(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

async function createFreepikTask({ prompt, config }) {
  const url = buildFreepikApiUrl(config.baseUrl, '/v1/ai/mystic');
  const payload = { prompt };

  return requestWithFallback(config.apiKeys, async (apiKey) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-freepik-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    })
  );
}

async function getFreepikTaskStatus({ taskId, config }) {
  const url = buildFreepikApiUrl(
    config.baseUrl,
    `/v1/ai/mystic/${encodeURIComponent(taskId)}`
  );

  return requestWithFallback(config.apiKeys, async (apiKey) =>
    fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-freepik-api-key': apiKey,
      },
    })
  );
}

function extractGeneratedImageUrl(taskData) {
  const generated = Array.isArray(taskData?.generated) ? taskData.generated : [];
  return generated.find((url) => typeof url === 'string' && url.trim()) || '';
}

async function waitForFreepikImage({ taskId, config }) {
  const timeoutMs =
    config.pollTimeoutMs > 0 ? config.pollTimeoutMs : DEFAULT_FREEPIK_POLL_TIMEOUT_MS;
  const intervalMs =
    config.pollIntervalMs > 0
      ? config.pollIntervalMs
      : DEFAULT_FREEPIK_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const pollResponse = await getFreepikTaskStatus({ taskId, config });
    if (!pollResponse || !pollResponse.ok) {
      const status = pollResponse?.status || 500;
      const rawError = pollResponse ? await pollResponse.text().catch(() => '') : '';
      return {
        ok: false,
        status,
        error: `Freepik status API error (${status}). ${rawError || 'Request failed.'}`,
      };
    }

    const data = await pollResponse.json().catch(() => null);
    const taskData = data?.data || {};
    const status = normalizeFreepikStatus(taskData?.status);
    const imageUrl = extractGeneratedImageUrl(taskData);

    if (imageUrl && (status === 'COMPLETED' || !status)) {
      return { ok: true, imageUrl, status: status || 'COMPLETED' };
    }

    if (status === 'COMPLETED' && imageUrl) {
      return { ok: true, imageUrl, status };
    }

    if (status === 'FAILED' || status === 'ERROR' || status === 'CANCELLED') {
      return {
        ok: false,
        status: 502,
        error: `Freepik image task ended with status ${status}.`,
      };
    }

    await sleep(intervalMs);
  }

  return {
    ok: false,
    status: 504,
    error:
      'Freepik image generation timed out. Try a shorter prompt or try again in a moment.',
  };
}

function getErrorLabel(provider) {
  if (provider === 'nvidia') return 'Nemotron';
  return 'Groq';
}

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const requestedProvider = normalizeProvider(
      body?.provider || 'auto'
    );
    const generateImage = Boolean(body?.generateImage);
    const safeMessages = resolveIncomingMessages(body);
    const imageCount = countImages(safeMessages);
    const hasImageInput = imageCount > 0;

    if (!generateImage && safeMessages.length === 0) {
      return NextResponse.json(
        { error: 'At least one message is required.' },
        { status: 400 }
      );
    }

    if (imageCount > MAX_IMAGES_PER_REQUEST) {
      return NextResponse.json(
        {
          error: `Too many images in one request. Maximum ${MAX_IMAGES_PER_REQUEST} images are allowed.`,
        },
        { status: 400 }
      );
    }

    const groq = getGroqConfig();
    const nvidia = getNvidiaConfig();
    const freepik = getFreepikConfig();
    const hasGroqKey = groq.apiKeys.length > 0;
    const hasNvidiaKey = nvidia.apiKeys.length > 0;

    if (generateImage) {
      if (freepik.apiKeys.length === 0) {
        return NextResponse.json(
          {
            error:
              'Missing Freepik API key. Set FREEPIK_API_KEY in your environment variables.',
          },
          { status: 500 }
        );
      }

      const quotaState = getImageQuotaState(request, freepik.imageDailyLimit);
      if (!quotaState.allowed) {
        return NextResponse.json(
          {
            error: `Daily image generation limit reached (${quotaState.limit}/day). Try again tomorrow.`,
            limit: quotaState.limit,
            used: quotaState.used,
            remaining: quotaState.remaining,
            resetAtUtc: quotaState.resetAtUtc,
          },
          { status: 429 }
        );
      }

      const prompt = sanitizeText(body?.imagePrompt || getLatestUserPrompt(safeMessages));
      if (!prompt) {
        return NextResponse.json({ error: 'Image prompt is required.' }, { status: 400 });
      }

      const createTaskResponse = await createFreepikTask({ prompt, config: freepik });
      if (!createTaskResponse || !createTaskResponse.ok) {
        const status = createTaskResponse?.status || 500;
        const rawError = createTaskResponse
          ? await createTaskResponse.text().catch(() => '')
          : '';
        return NextResponse.json(
          {
            error: `Freepik image API error (${status}). ${rawError || 'Request failed.'}`,
          },
          { status }
        );
      }

      const taskPayload = await createTaskResponse.json().catch(() => null);
      const taskData = taskPayload?.data || {};
      const taskId = String(taskData?.task_id || '').trim();
      let imageUrl = extractGeneratedImageUrl(taskData);

      if (!taskId && !imageUrl) {
        return NextResponse.json(
          { error: 'Freepik image task could not be started.' },
          { status: 502 }
        );
      }

      if (!imageUrl && taskId) {
        const taskResult = await waitForFreepikImage({ taskId, config: freepik });
        if (!taskResult.ok) {
          return NextResponse.json(
            { error: taskResult.error || 'Freepik image generation failed.' },
            { status: taskResult.status || 502 }
          );
        }
        imageUrl = taskResult.imageUrl;
      }

      if (!imageUrl) {
        return NextResponse.json(
          { error: 'Freepik returned no image URL.' },
          { status: 502 }
        );
      }

      const quotaAfter = consumeImageGenerationQuota(request, freepik.imageDailyLimit);

      return NextResponse.json({
        type: 'image',
        provider: 'freepik',
        model: 'freepik/mystic',
        content: 'Image generated successfully.',
        imageDataUrl: imageUrl,
        quota: {
          limit: quotaAfter.limit,
          used: quotaAfter.used,
          remaining: quotaAfter.remaining,
          resetAtUtc: quotaAfter.resetAtUtc,
        },
      });
    }

    if (!hasGroqKey && !hasNvidiaKey) {
      return NextResponse.json(
        {
          error:
            'Missing API keys. Set GROQ_API_KEY and/or NVIDIA_API_KEY in your environment variables.',
        },
        { status: 500 }
      );
    }

    const activeProvider = pickProvider(requestedProvider, hasGroqKey, hasNvidiaKey);
    const providerForRequest =
      hasImageInput && activeProvider === 'nvidia' && hasGroqKey ? 'groq' : activeProvider;

    let upstream;
    if (providerForRequest === 'nvidia') {
      upstream = await createNvidiaUpstream({
        safeMessages,
        hasImageInput,
        config: nvidia,
      });
    } else {
      upstream = await createGroqUpstream({
        safeMessages,
        hasImageInput,
        config: groq,
      });
    }

    if (!upstream || !upstream.ok || !upstream.body) {
      const rawError = upstream ? await upstream.text().catch(() => '') : '';
      const label = getErrorLabel(providerForRequest);
      const status = upstream?.status || 500;

      if (status === 401) {
        return NextResponse.json(
          {
            error: `Invalid ${label} API key (401).`,
          },
          { status: 401 }
        );
      }

      if (status === 404) {
        return NextResponse.json(
          {
            error: `${label} API error (404). Check your model and base URL environment variables.`,
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: `${label} API error (${status}). ${rawError || 'Request failed.'}`,
        },
        { status }
      );
    }

    return createTokenResponse(upstream, {
      includeReasoning: providerForRequest === 'nvidia' && nvidia.includeReasoning,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
