const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GROQ_VISION_MODEL =
  process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

function buildTimeoutSignal(timeoutMs, parentSignal) {
  const controller = new AbortController();
  let timeoutId = null;

  if (typeof timeoutMs === 'number' && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      controller.abort(new Error('Groq request timed out.'));
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

function buildMessages(messages, systemPrompt) {
  return [{ role: 'system', content: systemPrompt }, ...messages];
}

export function isGroqConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}

export function groqSupportsVision() {
  return true;
}

export function getGroqModel(hasImageInput = false) {
  return hasImageInput ? GROQ_VISION_MODEL : GROQ_DEFAULT_MODEL;
}

export async function requestGroqChatStream({
  messages,
  systemPrompt,
  hasImageInput = false,
  temperature = 0.7,
  maxTokens,
  timeoutMs = 60_000,
  signal,
}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is missing.');

  const { signal: mergedSignal, cleanup } = buildTimeoutSignal(timeoutMs, signal);
  try {
    return await fetch(GROQ_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getGroqModel(hasImageInput),
        stream: true,
        temperature,
        ...(typeof maxTokens === 'number' ? { max_tokens: maxTokens } : {}),
        messages: buildMessages(messages, systemPrompt),
      }),
      signal: mergedSignal,
    });
  } finally {
    cleanup();
  }
}

export async function requestGroqChatCompletion({
  messages,
  systemPrompt,
  model,
  temperature = 0.2,
  maxTokens = 96,
  timeoutMs = 30_000,
  signal,
}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is missing.');

  const { signal: mergedSignal, cleanup } = buildTimeoutSignal(timeoutMs, signal);
  try {
    const response = await fetch(GROQ_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || GROQ_DEFAULT_MODEL,
        stream: false,
        temperature,
        max_tokens: maxTokens,
        messages: buildMessages(messages, systemPrompt),
      }),
      signal: mergedSignal,
    });

    const data = await response.json().catch(() => null);
    return { response, data };
  } finally {
    cleanup();
  }
}

