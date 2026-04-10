const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_DEFAULT_MODEL =
  process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-super-120b-a12b';

function buildTimeoutSignal(timeoutMs, parentSignal) {
  const controller = new AbortController();
  let timeoutId = null;

  if (typeof timeoutMs === 'number' && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      controller.abort(new Error('NVIDIA request timed out.'));
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

export function isNvidiaConfigured() {
  return Boolean(process.env.NVIDIA_API_KEY);
}

export function getNvidiaModel() {
  return NVIDIA_DEFAULT_MODEL;
}

export async function requestNvidiaChatStream({
  messages,
  systemPrompt,
  temperature = 1,
  topP = 0.95,
  maxTokens = 16_384,
  timeoutMs = 75_000,
  signal,
}) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error('NVIDIA_API_KEY is missing.');

  const { signal: mergedSignal, cleanup } = buildTimeoutSignal(timeoutMs, signal);
  try {
    return await fetch(NVIDIA_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: NVIDIA_DEFAULT_MODEL,
        stream: true,
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        // Keep reasoning hidden and concise output-focused.
        extra_body: { chat_template_kwargs: { enable_thinking: false } },
        messages: buildMessages(messages, systemPrompt),
      }),
      signal: mergedSignal,
    });
  } finally {
    cleanup();
  }
}

export async function requestNvidiaChatCompletion({
  messages,
  systemPrompt,
  model,
  temperature = 0.2,
  maxTokens = 96,
  timeoutMs = 35_000,
  signal,
}) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error('NVIDIA_API_KEY is missing.');

  const { signal: mergedSignal, cleanup } = buildTimeoutSignal(timeoutMs, signal);
  try {
    const response = await fetch(NVIDIA_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || NVIDIA_DEFAULT_MODEL,
        stream: false,
        temperature,
        max_tokens: maxTokens,
        extra_body: { chat_template_kwargs: { enable_thinking: false } },
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

