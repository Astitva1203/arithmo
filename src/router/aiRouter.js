import {
  isGroqConfigured,
  groqSupportsVision,
  requestGroqChatStream,
} from '@/services/ai/groqService';
import { isNvidiaConfigured, requestNvidiaChatStream } from '@/services/ai/nvidiaService';

const COMPLEX_QUERY_PATTERN =
  /\b(why|prove|derive|optimi[sz]e|architecture|design|trade[\s-]?off|debug|analy[sz]e|reason|compare|evaluate|step by step|algorithm)\b/i;

const SIMPLE_QUERY_PATTERN =
  /^\s*(hi|hello|hey|thanks|thank you|ok|yes|no|what is|who is|define)\b/i;

function isComplexQuery(text) {
  const normalized = String(text || '').trim();
  if (!normalized) return false;
  if (normalized.length > 240) return true;
  if (COMPLEX_QUERY_PATTERN.test(normalized)) return true;
  if (SIMPLE_QUERY_PATTERN.test(normalized)) return false;
  return normalized.split(/\s+/).length > 28;
}

function pickAutoProvider({ latestUserText, hasImageInput, chatMode }) {
  const groqAvailable = isGroqConfigured();
  const nvidiaAvailable = isNvidiaConfigured();

  if (!groqAvailable && !nvidiaAvailable) return null;

  if (hasImageInput) {
    if (groqAvailable && groqSupportsVision()) return 'groq';
    if (nvidiaAvailable) return 'nvidia';
    return null;
  }

  const complex = isComplexQuery(latestUserText);
  if (chatMode === 'search' && nvidiaAvailable && complex) return 'nvidia';
  if (complex && nvidiaAvailable) return 'nvidia';
  if (groqAvailable) return 'groq';
  if (nvidiaAvailable) return 'nvidia';
  return null;
}

function resolveRequestedProvider(requestedProvider, context) {
  const requested = String(requestedProvider || 'auto').toLowerCase();
  if (requested === 'groq' && isGroqConfigured()) return { provider: 'groq', reason: 'user_selected' };
  if (requested === 'nvidia' && isNvidiaConfigured()) {
    if (context.hasImageInput && isGroqConfigured()) {
      return { provider: 'groq', reason: 'vision_routed_to_groq' };
    }
    return { provider: 'nvidia', reason: 'user_selected' };
  }

  const auto = pickAutoProvider(context);
  return { provider: auto, reason: 'auto_router' };
}

function getFallbackProvider(provider, hasImageInput) {
  if (provider === 'groq') {
    if (isNvidiaConfigured() && !hasImageInput) return 'nvidia';
    return null;
  }
  if (provider === 'nvidia') {
    if (isGroqConfigured()) return 'groq';
    return null;
  }
  return null;
}

function shouldRetryStatus(status) {
  return (
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    status === 499 ||
    status >= 500
  );
}

function shouldRetryError(error) {
  const text = String(error?.message || '').toLowerCase();
  return text.includes('timeout') || text.includes('timed out') || text.includes('network');
}

async function callProvider(provider, args) {
  if (provider === 'groq') return requestGroqChatStream(args);
  if (provider === 'nvidia') return requestNvidiaChatStream(args);
  throw new Error('Unknown provider.');
}

async function readResponseError(response) {
  const raw = await response.text().catch(() => '');
  return raw ? raw.slice(0, 800) : `HTTP ${response.status}`;
}

export class AiRouterError extends Error {
  constructor(message, { status = 500, details = [] } = {}) {
    super(message);
    this.name = 'AiRouterError';
    this.status = status;
    this.details = details;
  }
}

export async function routeChatRequest({
  requestedProvider = 'auto',
  messages,
  systemPrompt,
  latestUserText,
  hasImageInput = false,
  chatMode = 'chat',
  timeoutMs,
}) {
  const selection = resolveRequestedProvider(requestedProvider, {
    latestUserText,
    hasImageInput,
    chatMode,
  });

  const initialProvider = selection.provider;
  if (!initialProvider) {
    throw new AiRouterError('No AI provider configured. Add GROQ_API_KEY or NVIDIA_API_KEY.', {
      status: 500,
      details: [{ provider: 'none', reason: 'missing_api_keys' }],
    });
  }

  const providerOrder = [initialProvider];
  const fallback = getFallbackProvider(initialProvider, hasImageInput);
  if (fallback && fallback !== initialProvider) providerOrder.push(fallback);

  const attempts = [];

  for (const provider of providerOrder) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await callProvider(provider, {
          messages,
          systemPrompt,
          hasImageInput,
          timeoutMs,
        });

        if (response.ok && response.body) {
          return {
            providerUsed: provider,
            fallbackUsed: provider !== initialProvider,
            routeReason: selection.reason,
            attempts,
            response,
          };
        }

        const providerError = await readResponseError(response);
        attempts.push({
          provider,
          attempt,
          status: response.status,
          error: providerError,
        });

        if (attempt < 2 && shouldRetryStatus(response.status)) {
          continue;
        }
        break;
      } catch (error) {
        attempts.push({
          provider,
          attempt,
          status: 0,
          error: error?.message || 'Unknown request failure.',
        });

        if (attempt < 2 && shouldRetryError(error)) {
          continue;
        }
        break;
      }
    }
  }

  const last = attempts[attempts.length - 1];
  throw new AiRouterError(
    `AI providers failed. Last error: ${last?.error || 'Unknown failure.'}`,
    {
      status: last?.status && Number(last.status) > 0 ? Number(last.status) : 502,
      details: attempts,
    }
  );
}

