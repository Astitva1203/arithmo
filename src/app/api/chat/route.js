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

  if (
    normalized === 'groq' ||
    normalized === 'openrouter' ||
    normalized === 'nvidia' ||
    normalized === 'auto'
  ) {
    return normalized;
  }

  return 'auto';
}

function parseBooleanEnv(value, defaultValue = false) {
  if (value == null) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no') {
    return false;
  }
  return defaultValue;
}

function parseIntEnv(value, defaultValue = 0) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultValue;
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

function consumeImageGenerationQuota(request, limit) {
  const dailyLimit = Number.isFinite(limit) ? limit : DEFAULT_IMAGE_DAILY_LIMIT;
  if (dailyLimit <= 0) {
    return { allowed: true, remaining: Infinity, used: 0, limit: 0 };
  }

  const dayKey = getCurrentUtcDateKey();
  const clientId = getClientIdentifier(request);
  const key = `${dayKey}:${clientId}`;

  // Clean previous-day counters to avoid indefinite growth.
  for (const existingKey of imageGenerationUsage.keys()) {
    if (!existingKey.startsWith(`${dayKey}:`)) {
      imageGenerationUsage.delete(existingKey);
    }
  }

  const used = imageGenerationUsage.get(key) || 0;
  if (used >= dailyLimit) {
    return {
      allowed: false,
      remaining: 0,
      used,
      limit: dailyLimit,
      resetAtUtc: `${dayKey}T23:59:59.999Z`,
    };
  }

  const nextUsed = used + 1;
  imageGenerationUsage.set(key, nextUsed);
  return {
    allowed: true,
    remaining: dailyLimit - nextUsed,
    used: nextUsed,
    limit: dailyLimit,
    resetAtUtc: `${dayKey}T23:59:59.999Z`,
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
    apiKeys: readApiKeys(
      process.env.GROQ_API_KEY,
      process.env.GROQ_API_KEY_2,
      process.env.GROQ_API_KEYS
    ),
    baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    textModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    visionModel:
      process.env.GROQ_VISION_MODEL ||
      'meta-llama/llama-4-scout-17b-16e-instruct',
  };
}

function getOpenRouterConfig() {
  return {
    apiKeys: readApiKeys(
      process.env.OPENROUTER_API_KEY,
      process.env.OPENROUTER_API_KEY_2,
      process.env.OPENROUTER_API_KEYS
    ),
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    textModel: process.env.OPENROUTER_MODEL || 'openrouter/auto',
    visionModel: process.env.OPENROUTER_VISION_MODEL || 'openrouter/auto',
    imageModel:
      process.env.OPENROUTER_IMAGE_MODEL || 'bytedance-seed/seedream-4.5',
    imageDailyLimit: parseIntEnv(
      process.env.OPENROUTER_IMAGE_DAILY_LIMIT,
      DEFAULT_IMAGE_DAILY_LIMIT
    ),
    siteUrl: (process.env.OPENROUTER_SITE_URL || '').trim(),
    appName: (process.env.OPENROUTER_APP_NAME || '').trim() || 'Arithmo AI',
  };
}

function getNvidiaConfig() {
  return {
    apiKeys: readApiKeys(
      process.env.NVIDIA_API_KEY,
      process.env.NVIDIA_API_KEY_2,
      process.env.NVIDIA_API_KEYS
    ),
    baseUrl: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    textModel:
      process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-super-120b-a12b',
    visionModel:
      process.env.NVIDIA_VISION_MODEL ||
      process.env.NVIDIA_MODEL ||
      'nvidia/nemotron-3-super-120b-a12b',
    enableThinking: parseBooleanEnv(process.env.NVIDIA_ENABLE_THINKING, true),
    reasoningBudget: parseIntEnv(process.env.NVIDIA_REASONING_BUDGET, 16384),
    includeReasoning: parseBooleanEnv(process.env.NVIDIA_INCLUDE_REASONING, false),
  };
}

function buildOpenAiCompatibleChatUrl(baseUrl, fallback) {
  const clean = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!clean) return fallback;
  if (clean.endsWith('/chat/completions')) return clean;
  return `${clean}/chat/completions`;
}

function pickProvider(preferred, hasGroqKey, hasOpenRouterKey, hasNvidiaKey) {
  if (preferred === 'groq') {
    if (hasGroqKey) return 'groq';
    if (hasOpenRouterKey) return 'openrouter';
    if (hasNvidiaKey) return 'nvidia';
    return 'groq';
  }

  if (preferred === 'openrouter') {
    if (hasOpenRouterKey) return 'openrouter';
    if (hasGroqKey) return 'groq';
    if (hasNvidiaKey) return 'nvidia';
    return 'openrouter';
  }

  if (preferred === 'nvidia') {
    if (hasNvidiaKey) return 'nvidia';
    if (hasGroqKey) return 'groq';
    if (hasOpenRouterKey) return 'openrouter';
    return 'nvidia';
  }

  if (hasGroqKey) return 'groq';
  if (hasOpenRouterKey) return 'openrouter';
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

async function createOpenRouterUpstream({ safeMessages, hasImageInput, config }) {
  const model = hasImageInput ? config.visionModel : config.textModel;
  const chatUrl = buildOpenAiCompatibleChatUrl(
    config.baseUrl,
    'https://openrouter.ai/api/v1/chat/completions'
  );

  return requestWithFallback(config.apiKeys, async (apiKey) => {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'X-Title': config.appName,
    };

    if (config.siteUrl) {
      headers['HTTP-Referer'] = config.siteUrl;
    }

    return fetch(chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        stream: true,
        temperature: 0.7,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...safeMessages],
      }),
    });
  });
}

async function createOpenRouterImageResponse({ prompt, config }) {
  const chatUrl = buildOpenAiCompatibleChatUrl(
    config.baseUrl,
    'https://openrouter.ai/api/v1/chat/completions'
  );

  return requestWithFallback(config.apiKeys, async (apiKey) => {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'X-Title': config.appName,
    };

    if (config.siteUrl) {
      headers['HTTP-Referer'] = config.siteUrl;
    }

    return fetch(chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.imageModel,
        stream: false,
        messages: [{ role: 'user', content: prompt }],
        extra_body: { modalities: ['image'] },
      }),
    });
  });
}

async function createNvidiaUpstream({ safeMessages, hasImageInput, config }) {
  const model = hasImageInput ? config.visionModel : config.textModel;
  const chatUrl = buildOpenAiCompatibleChatUrl(
    config.baseUrl,
    'https://integrate.api.nvidia.com/v1/chat/completions'
  );

  return requestWithFallback(config.apiKeys, async (apiKey) => {
    const extraBody = {};

    if (config.enableThinking) {
      extraBody.chat_template_kwargs = { enable_thinking: true };
    }
    if (config.reasoningBudget > 0) {
      extraBody.reasoning_budget = config.reasoningBudget;
    }

    return fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        temperature: 0.7,
        top_p: 0.95,
        max_tokens: 4096,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...safeMessages],
        ...(Object.keys(extraBody).length > 0 ? { extra_body: extraBody } : {}),
      }),
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

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const safeMessages = toSafeMessages(body?.messages);
    if (safeMessages.length === 0) {
      return NextResponse.json(
        { error: 'At least one message is required.' },
        { status: 400 }
      );
    }

    const imageCount = countImages(safeMessages);
    if (imageCount > MAX_IMAGES_PER_REQUEST) {
      return NextResponse.json(
        {
          error: `Too many images in one request. Maximum ${MAX_IMAGES_PER_REQUEST} images are allowed.`,
        },
        { status: 400 }
      );
    }

    const requestedProvider = normalizeProvider(
      body?.provider || process.env.AI_PROVIDER || 'auto'
    );
    const generateImage = Boolean(body?.generateImage);
    const hasImageInput = imageCount > 0;

    const groq = getGroqConfig();
    const openRouter = getOpenRouterConfig();
    const nvidia = getNvidiaConfig();
    const hasGroqKey = groq.apiKeys.length > 0;
    const hasOpenRouterKey = openRouter.apiKeys.length > 0;
    const hasNvidiaKey = nvidia.apiKeys.length > 0;

    if (!hasGroqKey && !hasOpenRouterKey && !hasNvidiaKey) {
      return NextResponse.json(
        {
          error:
            'Missing API keys. Set GROQ_API_KEY and/or OPENROUTER_API_KEY and/or NVIDIA_API_KEY in .env.local.',
        },
        { status: 500 }
      );
    }

    const activeProvider = pickProvider(
      requestedProvider,
      hasGroqKey,
      hasOpenRouterKey,
      hasNvidiaKey
    );

    if (generateImage) {
      if (activeProvider !== 'openrouter') {
        return NextResponse.json(
          {
            error: 'Image generation is currently available only with OpenRouter provider.',
          },
          { status: 400 }
        );
      }

      const quota = consumeImageGenerationQuota(request, openRouter.imageDailyLimit);
      if (!quota.allowed) {
        return NextResponse.json(
          {
            error: `Daily image generation limit reached (${quota.limit}/day). Try again tomorrow.`,
            limit: quota.limit,
            used: quota.used,
            remaining: quota.remaining,
            resetAtUtc: quota.resetAtUtc,
          },
          { status: 429 }
        );
      }

      const prompt = sanitizeText(body?.imagePrompt || getLatestUserPrompt(safeMessages));
      if (!prompt) {
        return NextResponse.json(
          { error: 'Image prompt is required.' },
          { status: 400 }
        );
      }

      const imageResponse = await createOpenRouterImageResponse({
        prompt,
        config: openRouter,
      });

      const imageLabel = 'OpenRouter';
      if (!imageResponse || !imageResponse.ok) {
        const rawError = imageResponse
          ? await imageResponse.text().catch(() => '')
          : '';
        const status = imageResponse?.status || 500;
        return NextResponse.json(
          {
            error: `${imageLabel} image API error (${status}). ${rawError || 'Request failed.'}`,
          },
          { status }
        );
      }

      const data = await imageResponse.json().catch(() => null);
      const assistantMessage = data?.choices?.[0]?.message || {};
      const images = Array.isArray(assistantMessage?.images)
        ? assistantMessage.images
        : [];
      const imageDataUrl = images?.[0]?.image_url?.url || '';
      const textContent = sanitizeText(
        typeof assistantMessage?.content === 'string'
          ? assistantMessage.content
          : 'Image generated successfully.'
      );

      if (!imageDataUrl) {
        return NextResponse.json(
          { error: 'Image model returned no image data.' },
          { status: 502 }
        );
      }

      return NextResponse.json({
        type: 'image',
        provider: 'openrouter',
        model: openRouter.imageModel,
        content: textContent || 'Image generated successfully.',
        imageDataUrl,
        quota: {
          limit: quota.limit,
          used: quota.used,
          remaining: quota.remaining,
          resetAtUtc: quota.resetAtUtc,
        },
      });
    }

    let upstream;
    if (activeProvider === 'openrouter') {
      upstream = await createOpenRouterUpstream({
        safeMessages,
        hasImageInput,
        config: openRouter,
      });
    } else if (activeProvider === 'nvidia') {
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
      const label =
        activeProvider === 'openrouter'
          ? 'OpenRouter'
          : activeProvider === 'nvidia'
            ? 'NVIDIA'
            : 'Groq';
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
      includeReasoning: activeProvider === 'nvidia' && nvidia.includeReasoning,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
