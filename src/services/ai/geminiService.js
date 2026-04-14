const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

function buildTimeoutSignal(timeoutMs, parentSignal) {
  const controller = new AbortController();
  let timeoutId = null;

  if (typeof timeoutMs === 'number' && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      controller.abort(new Error('Gemini request timed out.'));
    }, timeoutMs);
  }

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort(parentSignal.reason || new Error('Request aborted.'));
    } else {
      parentSignal.addEventListener(
        'abort',
        () => controller.abort(parentSignal.reason || new Error('Request aborted.')),
        { once: true }
      );
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timeoutId) clearTimeout(timeoutId);
    },
  };
}

function parseImageDataUrl(url) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(String(url || ''));
  if (!match) return null;
  return {
    mimeType: match[1],
    data: match[2],
  };
}

function toGeminiParts(content) {
  if (typeof content === 'string') {
    const text = content.trim();
    return text ? [{ text }] : [];
  }

  if (!Array.isArray(content)) return [];

  const parts = [];
  for (const part of content) {
    if (part?.type === 'text' && typeof part?.text === 'string') {
      const text = part.text.trim();
      if (text) parts.push({ text });
      continue;
    }

    if (part?.type === 'image_url') {
      const rawUrl = String(part?.image_url?.url || '').trim();
      if (!rawUrl) continue;

      const inlineImage = parseImageDataUrl(rawUrl);
      if (inlineImage) {
        parts.push({ inlineData: inlineImage });
        continue;
      }

      if (/^https?:\/\//i.test(rawUrl)) {
        parts.push({ text: `Image URL: ${rawUrl}` });
      }
    }
  }

  return parts;
}

function buildContents(messages) {
  const contents = [];

  for (const message of messages || []) {
    const role = message?.role === 'assistant' ? 'model' : 'user';
    const parts = toGeminiParts(message?.content);
    if (parts.length === 0) continue;

    const prev = contents[contents.length - 1];
    if (prev && prev.role === role) {
      prev.parts.push(...parts);
    } else {
      contents.push({ role, parts });
    }
  }

  return contents;
}

function extractTextFromGeminiResponse(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
}

function chunkText(text, chunkSize = 120) {
  const input = String(text || '');
  if (!input) return [];
  const chunks = [];
  for (let i = 0; i < input.length; i += chunkSize) {
    chunks.push(input.slice(i, i + chunkSize));
  }
  return chunks;
}

function createSyntheticStreamResponse(text) {
  const encoder = new TextEncoder();
  const chunks = chunkText(text, 120);

  const stream = new ReadableStream({
    start(controller) {
      for (const token of chunks) {
        const payload = JSON.stringify({
          choices: [{ delta: { content: token } }],
        });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}

async function requestGeminiGenerate({
  messages,
  systemPrompt,
  model,
  temperature,
  maxTokens,
  timeoutMs,
  signal,
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing.');

  const contents = buildContents(messages);
  if (contents.length === 0) {
    throw new Error('Gemini request requires at least one valid content part.');
  }

  const generationConfig = {
    ...(typeof temperature === 'number' ? { temperature } : {}),
    ...(typeof maxTokens === 'number' ? { maxOutputTokens: maxTokens } : {}),
  };

  const payload = {
    contents,
    ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
    ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
  };

  const modelName = model || GEMINI_DEFAULT_MODEL;
  const endpoint = `${GEMINI_BASE_URL}/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const { signal: mergedSignal, cleanup } = buildTimeoutSignal(timeoutMs, signal);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: mergedSignal,
    });

    const data = await response.json().catch(() => null);
    return { response, data };
  } finally {
    cleanup();
  }
}

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function getGeminiModel() {
  return GEMINI_DEFAULT_MODEL;
}

export async function requestGeminiChatStream({
  messages,
  systemPrompt,
  temperature = 0.7,
  maxTokens,
  timeoutMs = 75_000,
  signal,
}) {
  const { response, data } = await requestGeminiGenerate({
    messages,
    systemPrompt,
    temperature,
    maxTokens,
    timeoutMs,
    signal,
  });

  if (!response.ok) {
    const body = data ? JSON.stringify(data) : await response.text().catch(() => '');
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const text = extractTextFromGeminiResponse(data);
  return createSyntheticStreamResponse(text);
}

export async function requestGeminiChatCompletion({
  messages,
  systemPrompt,
  model,
  temperature = 0.2,
  maxTokens = 96,
  timeoutMs = 30_000,
  signal,
}) {
  const { response, data } = await requestGeminiGenerate({
    messages,
    systemPrompt,
    model,
    temperature,
    maxTokens,
    timeoutMs,
    signal,
  });

  const text = extractTextFromGeminiResponse(data);

  return {
    response,
    data: {
      choices: [
        {
          message: {
            content: text,
          },
        },
      ],
      raw: data,
    },
  };
}
