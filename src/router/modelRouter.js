import {
  isGroqConfigured,
  groqSupportsVision,
  requestGroqChatStream,
} from '@/services/ai/groqService';
import { isGeminiConfigured, requestGeminiChatStream } from '@/services/ai/geminiService';
import { isNvidiaConfigured, requestNvidiaChatStream } from '@/services/ai/nvidiaService';

const COMPLEX_QUERY_PATTERN =
  /\b(why|prove|derive|optimi[sz]e|architecture|design|trade[\s-]?off|debug|analy[sz]e|reason|compare|evaluate|step by step|algorithm|system design|multi model|fallback|performance|latency|security)\b/i;

const SIMPLE_QUERY_PATTERN =
  /^\s*(hi|hello|hey|thanks|thank you|ok|yes|no|what is|who is|define|solve|answer|help)\b/i;

const MODEL_MODE_VALUES = new Set(['auto', 'fast', 'smart', 'deep']);
const LEGACY_PROVIDER_VALUES = new Set(['auto', 'groq', 'gemini', 'nvidia']);
const FALLBACK_PRIORITY = ['gemini', 'groq', 'nvidia'];

function normalizeProvider(value) {
  const provider = String(value || 'auto').trim().toLowerCase();
  if (!LEGACY_PROVIDER_VALUES.has(provider)) return 'auto';
  return provider;
}

function normalizeModelMode(value) {
  const mode = String(value || 'auto').trim().toLowerCase();
  if (!MODEL_MODE_VALUES.has(mode)) return 'auto';
  return mode;
}

function providerToMode(provider) {
  if (provider === 'groq') return 'fast';
  if (provider === 'gemini') return 'smart';
  if (provider === 'nvidia') return 'deep';
  return 'auto';
}

function modeToPreferredProvider(mode) {
  if (mode === 'fast') return 'groq';
  if (mode === 'smart') return 'gemini';
  if (mode === 'deep') return 'nvidia';
  return null;
}

function classifyQueryComplexity(text) {
  const normalized = String(text || '').trim();
  if (!normalized) return 'medium';

  const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
  const sentenceCount = normalized.split(/[.!?]+/).filter(Boolean).length;

  if (
    tokenCount >= 34 ||
    normalized.length >= 260 ||
    COMPLEX_QUERY_PATTERN.test(normalized) ||
    sentenceCount >= 3
  ) {
    return 'complex';
  }

  if (
    tokenCount <= 10 ||
    normalized.length <= 60 ||
    SIMPLE_QUERY_PATTERN.test(normalized)
  ) {
    return 'simple';
  }

  return 'medium';
}

function isProviderAvailable(provider, { hasImageInput = false } = {}) {
  if (provider === 'groq') {
    return isGroqConfigured() && (!hasImageInput || groqSupportsVision());
  }
  if (provider === 'gemini') {
    return isGeminiConfigured();
  }
  if (provider === 'nvidia') {
    // NVIDIA route currently handles text-only reliably in this app.
    return isNvidiaConfigured() && !hasImageInput;
  }
  return false;
}

function getAvailableProviders(context) {
  return ['groq', 'gemini', 'nvidia'].filter((provider) => isProviderAvailable(provider, context));
}

function chooseAutoProvider({
  complexity,
  chatMode = 'chat',
  responseMode = 'deep',
  hasImageInput = false,
  availableProviders,
}) {
  if (hasImageInput) {
    if (availableProviders.includes('groq')) return 'groq';
    if (availableProviders.includes('gemini')) return 'gemini';
    return availableProviders[0] || null;
  }

  // Real-time mode should prefer faster/balanced models.
  if (chatMode === 'search') {
    if (complexity === 'simple' && availableProviders.includes('groq')) return 'groq';
    if (availableProviders.includes('gemini')) return 'gemini';
    if (availableProviders.includes('groq')) return 'groq';
    return availableProviders[0] || null;
  }

  // Research generally benefits from better synthesis before deep escalation.
  if (chatMode === 'research') {
    if (complexity === 'complex' && responseMode === 'deep' && availableProviders.includes('nvidia')) {
      return 'nvidia';
    }
    if (availableProviders.includes('gemini')) return 'gemini';
    if (availableProviders.includes('groq')) return 'groq';
    if (availableProviders.includes('nvidia')) return 'nvidia';
    return null;
  }

  if (complexity === 'simple') {
    if (availableProviders.includes('groq')) return 'groq';
    if (availableProviders.includes('gemini')) return 'gemini';
    if (availableProviders.includes('nvidia')) return 'nvidia';
    return null;
  }

  if (complexity === 'medium') {
    if (availableProviders.includes('gemini')) return 'gemini';
    if (availableProviders.includes('groq')) return 'groq';
    if (availableProviders.includes('nvidia')) return 'nvidia';
    return null;
  }

  // complex
  if (responseMode === 'deep' && availableProviders.includes('nvidia')) return 'nvidia';
  if (availableProviders.includes('gemini')) return 'gemini';
  if (availableProviders.includes('nvidia')) return 'nvidia';
  if (availableProviders.includes('groq')) return 'groq';
  return null;
}

function resolveModelSelection({
  requestedProvider,
  modelMode,
  latestUserText,
  hasImageInput,
  chatMode,
  responseMode,
}) {
  const normalizedProvider = normalizeProvider(requestedProvider);
  const normalizedMode = normalizeModelMode(modelMode);
  const inferredMode = normalizedMode !== 'auto' ? normalizedMode : providerToMode(normalizedProvider);

  const availableProviders = getAvailableProviders({ hasImageInput });
  const complexity = classifyQueryComplexity(latestUserText);

  if (availableProviders.length === 0) {
    return {
      provider: null,
      modelModeUsed: inferredMode,
      complexity,
      routeReason: 'missing_api_keys',
      availableProviders,
    };
  }

  const preferredByMode = modeToPreferredProvider(inferredMode);
  if (preferredByMode) {
    if (availableProviders.includes(preferredByMode)) {
      return {
        provider: preferredByMode,
        modelModeUsed: inferredMode,
        complexity,
        routeReason: 'mode_override',
        availableProviders,
      };
    }

    const fallbackForMode = chooseAutoProvider({
      complexity,
      chatMode,
      responseMode,
      hasImageInput,
      availableProviders,
    });

    return {
      provider: fallbackForMode,
      modelModeUsed: inferredMode,
      complexity,
      routeReason: 'mode_unavailable_auto_fallback',
      availableProviders,
    };
  }

  const autoProvider = chooseAutoProvider({
    complexity,
    chatMode,
    responseMode,
    hasImageInput,
    availableProviders,
  });

  return {
    provider: autoProvider,
    modelModeUsed: 'auto',
    complexity,
    routeReason: 'auto_router',
    availableProviders,
  };
}

function buildProviderOrder(primaryProvider, availableProviders) {
  const normalizedAvailable = FALLBACK_PRIORITY.filter((provider) => availableProviders.includes(provider));
  if (!primaryProvider) return normalizedAvailable;
  return [primaryProvider, ...normalizedAvailable.filter((provider) => provider !== primaryProvider)];
}

function shouldRetryStatus(status) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function shouldRetryError(error) {
  const text = String(error?.message || '').toLowerCase();
  return (
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('network') ||
    text.includes('socket') ||
    text.includes('fetch failed')
  );
}

function detectFailureType({ status = 0, errorText = '' }) {
  const text = String(errorText || '').toLowerCase();
  if (status === 429 || text.includes('rate limit')) return 'rate_limit';
  if (text.includes('quota')) return 'quota_exceeded';
  if (status === 408 || text.includes('timeout') || text.includes('timed out')) return 'timeout';
  if (status === 0 && (text.includes('network') || text.includes('socket') || text.includes('fetch'))) {
    return 'network_error';
  }
  return 'api_error';
}

async function callProvider(provider, args) {
  if (provider === 'groq') return requestGroqChatStream(args);
  if (provider === 'gemini') return requestGeminiChatStream(args);
  if (provider === 'nvidia') return requestNvidiaChatStream(args);
  throw new Error('Unknown provider.');
}

async function readResponseError(response) {
  const raw = await response.text().catch(() => '');
  return raw ? raw.slice(0, 800) : `HTTP ${response.status}`;
}

export class AiRouterError extends Error {
  constructor(message, { status = 500, details = [], metadata = {} } = {}) {
    super(message);
    this.name = 'AiRouterError';
    this.status = status;
    this.details = details;
    this.metadata = metadata;
  }
}

export async function generateResponse({
  query,
  mode = 'auto',
  context,
  messages,
  systemPrompt,
  hasImageInput = false,
  chatMode = 'chat',
  responseMode = 'deep',
  timeoutMs,
}) {
  const latestUserText = String(query || '').trim();
  return routeChatRequest({
    requestedProvider: 'auto',
    modelMode: mode,
    messages: Array.isArray(messages) ? messages : context,
    systemPrompt,
    latestUserText,
    hasImageInput,
    chatMode,
    responseMode,
    timeoutMs,
  });
}

export async function routeChatRequest({
  requestedProvider = 'auto',
  modelMode = 'auto',
  messages,
  systemPrompt,
  latestUserText,
  hasImageInput = false,
  chatMode = 'chat',
  responseMode = 'deep',
  timeoutMs,
}) {
  const routeStart = Date.now();
  const selection = resolveModelSelection({
    requestedProvider,
    modelMode,
    latestUserText,
    hasImageInput,
    chatMode,
    responseMode,
  });

  const initialProvider = selection.provider;
  if (!initialProvider) {
    throw new AiRouterError('No AI provider configured. Add GROQ_API_KEY, GEMINI_API_KEY, or NVIDIA_API_KEY.', {
      status: 500,
      details: [{ provider: 'none', reason: 'missing_api_keys' }],
      metadata: {
        modelMode: selection.modelModeUsed,
        complexity: selection.complexity,
      },
    });
  }

  const providerOrder = buildProviderOrder(initialProvider, selection.availableProviders);
  const attempts = [];

  for (const provider of providerOrder) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const callStart = Date.now();
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
            primaryProvider: initialProvider,
            fallbackUsed: provider !== initialProvider,
            fallbackFrom: provider !== initialProvider ? initialProvider : null,
            routeReason: selection.routeReason,
            attempts,
            response,
            queryComplexity: selection.complexity,
            modelMode: selection.modelModeUsed,
            elapsedMs: Date.now() - routeStart,
            providerElapsedMs: Date.now() - callStart,
          };
        }

        const providerError = await readResponseError(response);
        attempts.push({
          provider,
          attempt,
          status: response.status,
          failureType: detectFailureType({ status: response.status, errorText: providerError }),
          error: providerError,
          elapsedMs: Date.now() - callStart,
        });

        if (attempt < 2 && shouldRetryStatus(response.status)) {
          continue;
        }
        break;
      } catch (error) {
        const message = error?.message || 'Unknown request failure.';
        attempts.push({
          provider,
          attempt,
          status: 0,
          failureType: detectFailureType({ status: 0, errorText: message }),
          error: message,
          elapsedMs: Date.now() - callStart,
        });

        if (attempt < 2 && shouldRetryError(error)) {
          continue;
        }
        break;
      }
    }
  }

  const last = attempts[attempts.length - 1];
  throw new AiRouterError(`AI providers failed. Last error: ${last?.error || 'Unknown failure.'}`, {
    status: last?.status && Number(last.status) > 0 ? Number(last.status) : 502,
    details: attempts,
    metadata: {
      modelMode: selection.modelModeUsed,
      complexity: selection.complexity,
      initialProvider,
      elapsedMs: Date.now() - routeStart,
    },
  });
}
