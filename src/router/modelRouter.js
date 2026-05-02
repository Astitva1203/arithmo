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
const FALLBACK_PROVIDER_ORDER = ['gemini', 'groq', 'nvidia'];

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
  return ['groq', 'gemini', 'nvidia'].filter((provider) =>
    isProviderAvailable(provider, context)
  );
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
    return {
      provider: null,
      modelModeUsed: inferredMode,
      complexity,
      routeReason: 'mode_unavailable',
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

function buildProviderOrder(initialProvider, availableProviders = []) {
  const ordered = [];
  if (initialProvider) ordered.push(initialProvider);

  const availableSet = new Set(availableProviders);
  for (const provider of FALLBACK_PROVIDER_ORDER) {
    if (!availableSet.has(provider)) continue;
    if (!ordered.includes(provider)) {
      ordered.push(provider);
    }
  }

  for (const provider of availableProviders) {
    if (!ordered.includes(provider)) ordered.push(provider);
  }

  return ordered;
}

function pickAggregateFailureStatus(attempts = []) {
  if (attempts.some((attempt) => attempt.failureType === 'rate_limit' || attempt.status === 429)) {
    return 429;
  }
  if (attempts.some((attempt) => attempt.failureType === 'timeout' || attempt.status === 408)) {
    return 504;
  }
  if (attempts.some((attempt) => attempt.failureType === 'network_error')) {
    return 503;
  }
  if (attempts.some((attempt) => Number(attempt.status) >= 500 || Number(attempt.status) === 0)) {
    return 503;
  }
  return 502;
}

function buildClientFailureMessage(attempts = []) {
  if (!attempts.length) {
    return 'Unable to generate a response right now. Please try again.';
  }

  if (attempts.some((attempt) => attempt.failureType === 'rate_limit' || attempt.status === 429)) {
    return 'AI providers are currently busy. Please retry in a moment.';
  }
  if (attempts.some((attempt) => attempt.failureType === 'quota_exceeded')) {
    return 'AI capacity is temporarily exhausted. Please try again shortly.';
  }
  if (attempts.some((attempt) => attempt.failureType === 'timeout')) {
    return 'The AI request timed out. Please try again.';
  }
  if (attempts.some((attempt) => attempt.failureType === 'network_error')) {
    return 'A network issue interrupted the AI request. Please try again.';
  }
  if (attempts.some((attempt) => Number(attempt.status) >= 500 || Number(attempt.status) === 0)) {
    return 'AI providers are temporarily unavailable. Please try again in a moment.';
  }

  return 'Unable to generate a response right now. Please try again.';
}

function isAbortLikeError(error) {
  const name = String(error?.name || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return name === 'aborterror' || message.includes('aborted') || message.includes('request aborted');
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
  signal,
}) {
  if (signal?.aborted) {
    throw new AiRouterError('Request cancelled by client.', {
      status: 499,
      details: [],
      metadata: { clientMessage: 'Request cancelled.' },
    });
  }

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
    if (selection.routeReason === 'mode_unavailable' && selection.modelModeUsed !== 'auto') {
      throw new AiRouterError(
        `Selected model mode "${selection.modelModeUsed}" is not configured. Add the required API key or switch model mode.`,
        {
          status: 400,
          details: [{ provider: 'none', reason: 'mode_unavailable' }],
          metadata: {
            modelMode: selection.modelModeUsed,
            complexity: selection.complexity,
          },
        }
      );
    }

    throw new AiRouterError('No AI provider configured. Add GROQ_API_KEY, GEMINI_API_KEY, or NVIDIA_API_KEY.', {
      status: 500,
      details: [{ provider: 'none', reason: 'missing_api_keys' }],
      metadata: {
        modelMode: selection.modelModeUsed,
        complexity: selection.complexity,
      },
    });
  }

  const attempts = [];
  const providerOrder = buildProviderOrder(initialProvider, selection.availableProviders);

  for (const provider of providerOrder) {
    const callStart = Date.now();

    try {
      const response = await callProvider(provider, {
        messages,
        systemPrompt,
        hasImageInput,
        timeoutMs,
        signal,
      });

      if (signal?.aborted) {
        throw new AiRouterError('Request cancelled by client.', {
          status: 499,
          details: attempts,
          metadata: { clientMessage: 'Request cancelled.' },
        });
      }

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
      const status = response.status && Number(response.status) > 0 ? Number(response.status) : 502;
      attempts.push({
        provider,
        attempt: attempts.length + 1,
        status,
        failureType: detectFailureType({ status, errorText: providerError }),
        error: providerError,
        elapsedMs: Date.now() - callStart,
      });
    } catch (error) {
      if (error instanceof AiRouterError && error.status === 499) {
        throw error;
      }

      if (signal?.aborted || isAbortLikeError(error)) {
        throw new AiRouterError('Request cancelled by client.', {
          status: 499,
          details: attempts,
          metadata: { clientMessage: 'Request cancelled.' },
        });
      }

      const message = error?.message || 'Unknown request failure.';
      attempts.push({
        provider,
        attempt: attempts.length + 1,
        status: 0,
        failureType: detectFailureType({ status: 0, errorText: message }),
        error: message,
        elapsedMs: Date.now() - callStart,
      });
    }
  }

  const clientMessage = buildClientFailureMessage(attempts);
  throw new AiRouterError(clientMessage, {
    status: pickAggregateFailureStatus(attempts),
    details: attempts,
    metadata: {
      modelMode: selection.modelModeUsed,
      complexity: selection.complexity,
      initialProvider,
      providerOrder,
      clientMessage,
      elapsedMs: Date.now() - routeStart,
    },
  });
}
