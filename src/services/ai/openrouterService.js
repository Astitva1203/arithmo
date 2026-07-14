/**
 * OpenRouter AI Service — DeepSeek V4 Flash (Free)
 * Used as the primary provider for Smart Mode.
 *
 * Endpoint: https://openrouter.ai/api/v1/chat/completions
 * Model:    deepseek/deepseek-v4-flash:free
 */

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_SMART_MODEL =
  process.env.OPENROUTER_SMART_MODEL || 'deepseek/deepseek-v4-flash:free';
const OPENROUTER_REFERER =
  process.env.OPENROUTER_REFERER || 'https://arithmo.vercel.app';
const OPENROUTER_TITLE = 'Arithmo AI';

function buildTimeoutSignal(timeoutMs, parentSignal) {
  const controller = new AbortController();
  let timeoutId = null;

  if (typeof timeoutMs === 'number' && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      controller.abort(new Error('OpenRouter request timed out.'));
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

export function isOpenRouterConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function getOpenRouterSmartModel() {
  return OPENROUTER_SMART_MODEL;
}

/**
 * Stream chat completion for Smart Mode via OpenRouter.
 * Uses DeepSeek V4 Flash (Free) with OpenAI-compatible format.
 */
export async function requestOpenRouterChatStream({
  messages,
  systemPrompt,
  temperature = 0.7,
  topP = 1,
  maxTokens = 8192,
  timeoutMs = 120_000,
  signal,
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is missing.');

  const { signal: mergedSignal, cleanup } = buildTimeoutSignal(timeoutMs, signal);
  const startTime = Date.now();

  try {
    const response = await fetch(OPENROUTER_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': OPENROUTER_REFERER,
        'X-Title': OPENROUTER_TITLE,
      },
      body: JSON.stringify({
        model: OPENROUTER_SMART_MODEL,
        stream: true,
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        messages: buildMessages(messages, systemPrompt),
      }),
      signal: mergedSignal,
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      console.error({
        mode: 'smart',
        provider: 'openrouter',
        model: OPENROUTER_SMART_MODEL,
        error: `HTTP ${response.status} from OpenRouter`,
        responseTimeMs: elapsed,
      });
    }

    return response;
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error({
      mode: 'smart',
      provider: 'openrouter',
      model: OPENROUTER_SMART_MODEL,
      error: error.message,
      responseTimeMs: elapsed,
    });
    throw error;
  } finally {
    cleanup();
  }
}

/**
 * Non-streaming chat completion via OpenRouter (used for title generation etc).
 */
export async function requestOpenRouterChatCompletion({
  messages,
  systemPrompt,
  model,
  temperature = 0.2,
  maxTokens = 96,
  timeoutMs = 30_000,
  signal,
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is missing.');

  const { signal: mergedSignal, cleanup } = buildTimeoutSignal(timeoutMs, signal);
  try {
    const response = await fetch(OPENROUTER_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': OPENROUTER_REFERER,
        'X-Title': OPENROUTER_TITLE,
      },
      body: JSON.stringify({
        model: model || OPENROUTER_SMART_MODEL,
        stream: false,
        temperature,
        max_tokens: maxTokens,
        messages: buildMessages(messages, systemPrompt),
      }),
      signal: mergedSignal,
    });

    const data = await response.json().catch(() => null);
    return { response, data };
  } catch (error) {
    console.error({
      mode: 'smart',
      provider: 'openrouter',
      model: model || OPENROUTER_SMART_MODEL,
      error: error.message,
    });
    throw error;
  } finally {
    cleanup();
  }
}
