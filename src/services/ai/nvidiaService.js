const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_DEEP_MODEL = process.env.NVIDIA_DEEP_MODEL || 'openai/gpt-oss-120b';
const NVIDIA_SMART_MODEL = process.env.NVIDIA_SMART_MODEL || 'google/gemma-4-31b-it';

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

export function isNvidiaBackupConfigured() {
  return Boolean(process.env.NVIDIA_BACKUP_API_KEY);
}

export function getNvidiaDeepModel() {
  return NVIDIA_DEEP_MODEL;
}

export function getNvidiaSmartModel() {
  return NVIDIA_SMART_MODEL;
}

/**
 * Stream chat completion for DEEP mode (GPT-OSS-120B).
 * Standard OpenAI-compatible format, no thinking tokens.
 */
export async function requestNvidiaChatStream({
  messages,
  systemPrompt,
  temperature = 0.7,
  topP = 1,
  maxTokens = 4096,
  timeoutMs = 300_000,
  signal,
  apiKey,
  apiKeyName,
}) {
  const resolvedKey = apiKey || process.env.NVIDIA_API_KEY;
  const keyLabel = apiKeyName || 'NVIDIA_API_KEY';
  if (!resolvedKey) throw new Error(`${keyLabel} is missing.`);

  const { signal: mergedSignal, cleanup } = buildTimeoutSignal(timeoutMs, signal);
  try {
    const response = await fetch(NVIDIA_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resolvedKey}`,
      },
      body: JSON.stringify({
        model: NVIDIA_DEEP_MODEL,
        stream: true,
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        messages: buildMessages(messages, systemPrompt),
      }),
      signal: mergedSignal,
    });

    if (!response.ok) {
      console.error({
        provider: keyLabel === 'NVIDIA_BACKUP_API_KEY' ? 'nvidia_backup' : 'nvidia',
        error: `HTTP ${response.status} from NVIDIA NIM (deep)`,
      });
    }

    return response;
  } catch (error) {
    console.error({
      provider: keyLabel === 'NVIDIA_BACKUP_API_KEY' ? 'nvidia_backup' : 'nvidia',
      error: error.message,
    });
    throw error;
  } finally {
    cleanup();
  }
}

/**
 * Stream chat completion for SMART mode (Gemma 4 31B IT).
 * Uses enable_thinking for reasoning capabilities.
 */
export async function requestNvidiaSmartChatStream({
  messages,
  systemPrompt,
  temperature = 1.0,
  topP = 0.95,
  maxTokens = 16_384,
  timeoutMs = 300_000,
  signal,
  apiKey,
  apiKeyName,
}) {
  const resolvedKey = apiKey || process.env.NVIDIA_API_KEY;
  const keyLabel = apiKeyName || 'NVIDIA_API_KEY';
  if (!resolvedKey) throw new Error(`${keyLabel} is missing.`);

  const { signal: mergedSignal, cleanup } = buildTimeoutSignal(timeoutMs, signal);
  try {
    const response = await fetch(NVIDIA_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${resolvedKey}`,
      },
      body: JSON.stringify({
        model: NVIDIA_SMART_MODEL,
        stream: true,
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        chat_template_kwargs: { enable_thinking: true },
        messages: buildMessages(messages, systemPrompt),
      }),
      signal: mergedSignal,
    });

    if (!response.ok) {
      console.error({
        provider: 'nvidia_smart',
        error: `HTTP ${response.status} from NVIDIA NIM (smart/gemma)`,
      });
    }

    return response;
  } catch (error) {
    console.error({
      provider: 'nvidia_smart',
      error: error.message,
    });
    throw error;
  } finally {
    cleanup();
  }
}

/**
 * Non-streaming chat completion (used for title generation etc).
 */
export async function requestNvidiaChatCompletion({
  messages,
  systemPrompt,
  model,
  temperature = 0.2,
  maxTokens = 96,
  timeoutMs = 35_000,
  signal,
  apiKey,
  apiKeyName,
}) {
  const resolvedKey = apiKey || process.env.NVIDIA_API_KEY;
  const keyLabel = apiKeyName || 'NVIDIA_API_KEY';
  if (!resolvedKey) throw new Error(`${keyLabel} is missing.`);

  const { signal: mergedSignal, cleanup } = buildTimeoutSignal(timeoutMs, signal);
  try {
    const response = await fetch(NVIDIA_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resolvedKey}`,
      },
      body: JSON.stringify({
        model: model || NVIDIA_DEEP_MODEL,
        stream: false,
        temperature,
        max_tokens: maxTokens,
        messages: buildMessages(messages, systemPrompt),
      }),
      signal: mergedSignal,
    });

    if (!response.ok) {
      console.error({
        provider: keyLabel === 'NVIDIA_BACKUP_API_KEY' ? 'nvidia_backup' : 'nvidia',
        error: `HTTP ${response.status} from NVIDIA NIM`,
      });
    }

    const data = await response.json().catch(() => null);
    return { response, data };
  } catch (error) {
    console.error({
      provider: keyLabel === 'NVIDIA_BACKUP_API_KEY' ? 'nvidia_backup' : 'nvidia',
      error: error.message,
    });
    throw error;
  } finally {
    cleanup();
  }
}
