import {
  isGroqConfigured,
  groqSupportsVision,
  requestGroqChatStream,
  getGroqModel,
} from '@/services/ai/groqService';
import {
  isNvidiaConfigured,
  isNvidiaBackupConfigured,
  requestNvidiaChatStream,
  requestNvidiaSmartChatStream,
  getNvidiaDeepModel,
} from '@/services/ai/nvidiaService';
import {
  isOpenRouterConfigured,
  requestOpenRouterChatStream,
  getOpenRouterSmartModel,
} from '@/services/ai/openrouterService';

const COMPLEX_QUERY_PATTERN =
  /\b(why|prove|derive|optimi[sz]e|architecture|design|trade[\s-]?off|debug|analy[sz]e|reason|compare|evaluate|step by step|algorithm|system design|multi model|fallback|performance|latency|security)\b/i;

const SIMPLE_QUERY_PATTERN =
  /^\s*(hi|hello|hey|thanks|thank you|ok|yes|no|what is|who is|define|solve|answer|help)\b/i;

const MODEL_MODE_VALUES = new Set(['auto', 'fast', 'smart', 'deep']);
const LEGACY_PROVIDER_VALUES = new Set([
  'auto', 'groq', 'nvidia', 'nvidia_smart', 'openrouter_smart',
]);

/**
 * Fallback order:
 *   openrouter_smart (DeepSeek, smart) → groq (fast) → nvidia (gpt-oss, deep) → nvidia_backup
 */
const FALLBACK_PROVIDER_ORDER = [
  'openrouter_smart',
  'groq',
  'nvidia',
  'nvidia_backup',
];

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
  if (provider === 'openrouter_smart' || provider === 'nvidia_smart') return 'smart';
  if (provider === 'nvidia') return 'deep';
  return 'auto';
}

function modeToPreferredProvider(mode) {
  if (mode === 'fast') return 'groq';
  if (mode === 'smart') return 'openrouter_smart';
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
  if (provider === 'openrouter_smart') {
    // DeepSeek V4 Flash via OpenRouter — text-only
    return isOpenRouterConfigured() && !hasImageInput;
  }
  if (provider === 'nvidia_smart') {
    // Gemma via NVIDIA NIM — text-only (legacy, kept for fallback)
    return isNvidiaConfigured() && !hasImageInput;
  }
  if (provider === 'nvidia') {
    // GPT-OSS via NVIDIA NIM — text-only
    return isNvidiaConfigured() && !hasImageInput;
  }
  if (provider === 'nvidia_backup') {
    return isNvidiaBackupConfigured() && !hasImageInput;
  }
  return false;
}

function getAvailableProviders(context) {
  return [
    'openrouter_smart',
    'groq',
    'nvidia_smart',
    'nvidia',
    'nvidia_backup',
  ].filter((provider) => isProviderAvailable(provider, context));
}

function chooseAutoProvider({
  hasImageInput = false,
  availableProviders,
  complexity = 'medium',
}) {
  // Image input → Groq (supports vision)
  if (hasImageInput) {
    if (availableProviders.includes('groq')) return 'groq';
    return availableProviders[0] || null;
  }

  // Complexity-based intelligent routing:
  //   simple  → groq         (fast, low-latency)
  //   medium  → openrouter   (smart, balanced)
  //   complex → nvidia       (deep, high-quality reasoning)
  if (complexity === 'simple') {
    if (availableProviders.includes('groq')) return 'groq';
    if (availableProviders.includes('openrouter_smart')) return 'openrouter_smart';
  } else if (complexity === 'complex') {
    if (availableProviders.includes('nvidia')) return 'nvidia';
    if (availableProviders.includes('openrouter_smart')) return 'openrouter_smart';
  } else {
    // medium complexity → smart mode (balanced)
    if (availableProviders.includes('openrouter_smart')) return 'openrouter_smart';
    if (availableProviders.includes('groq')) return 'groq';
  }

  // Ultimate fallback: try any available provider
  for (const provider of FALLBACK_PROVIDER_ORDER) {
    if (availableProviders.includes(provider)) return provider;
  }

  return availableProviders[0] || null;
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
    // Smart mode fallback: try nvidia_smart if openrouter is down
    if (
      preferredByMode === 'openrouter_smart' &&
      availableProviders.includes('nvidia_smart')
    ) {
      return {
        provider: 'nvidia_smart',
        modelModeUsed: inferredMode,
        complexity,
        routeReason: 'mode_override',
        availableProviders,
      };
    }
    // If nvidia_smart or nvidia is preferred but only nvidia_backup is available
    if (
      (preferredByMode === 'nvidia' || preferredByMode === 'nvidia_smart') &&
      availableProviders.includes('nvidia_backup')
    ) {
      return {
        provider: 'nvidia_backup',
        modelModeUsed: inferredMode,
        complexity,
        routeReason: 'mode_override',
        availableProviders,
      };
    }
    // Smart mode: fall back to groq if nothing else is available
    if (preferredByMode === 'openrouter_smart' && availableProviders.includes('groq')) {
      return {
        provider: 'groq',
        modelModeUsed: inferredMode,
        complexity,
        routeReason: 'mode_fallback',
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
    hasImageInput,
    availableProviders,
    complexity,
  });

  // Reflect which mode auto actually chose
  const autoModeUsed = autoProvider ? providerToMode(autoProvider) : 'auto';

  return {
    provider: autoProvider,
    modelModeUsed: autoModeUsed !== 'auto' ? `auto->${autoModeUsed}` : 'auto',
    complexity,
    routeReason: 'auto_router',
    availableProviders,
  };
}

function detectFailureType({ status = 0, errorText = '' }) {
  const text = String(errorText || '').toLowerCase();
  if (
    status === 401 ||
    status === 403 ||
    text.includes('unauthorized') ||
    text.includes('authentication') ||
    text.includes('invalid api key')
  ) {
    return 'auth_error';
  }
  if (status === 429) {
    if (text.includes('quota') || text.includes('limit') || text.includes('insufficient_quota')) {
      return 'api_limit';
    }
    return 'rate_limit';
  }
  if (status === 503 || text.includes('service unavailable')) return 'service_unavailable';
  if (status === 408 || text.includes('timeout') || text.includes('timed out')) return 'timeout';
  if (text.includes('quota') || text.includes('limit exceeded') || text.includes('insufficient_quota')) {
    return 'api_limit';
  }
  if (
    status === 0 &&
    (text.includes('network') ||
      text.includes('socket') ||
      text.includes('fetch') ||
      text.includes('econn') ||
      text.includes('enotfound'))
  ) {
    return 'network_error';
  }
  if (text.includes('fetch failed') || text.includes('network error')) {
    return 'network_error';
  }
  if (Number(status) >= 500) return 'service_unavailable';
  return 'api_error';
}

async function callProvider(provider, args) {
  if (provider === 'openrouter_smart') return requestOpenRouterChatStream(args);
  if (provider === 'groq') return requestGroqChatStream(args);
  if (provider === 'nvidia_smart') return requestNvidiaSmartChatStream(args);
  if (provider === 'nvidia') return requestNvidiaChatStream(args);
  if (provider === 'nvidia_backup') {
    // Backup uses the deep model by default
    return requestNvidiaChatStream({
      ...args,
      apiKey: process.env.NVIDIA_BACKUP_API_KEY,
      apiKeyName: 'NVIDIA_BACKUP_API_KEY',
    });
  }
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
  if (attempts.some((a) => a.failureType === 'auth_error')) return 401;
  if (attempts.some((a) => a.failureType === 'api_limit')) return 429;
  if (attempts.some((a) => a.failureType === 'rate_limit' || a.status === 429)) return 429;
  if (attempts.some((a) => a.failureType === 'timeout' || a.status === 408)) return 504;
  if (attempts.some((a) => a.failureType === 'network_error' || a.failureType === 'service_unavailable')) return 503;
  if (attempts.some((a) => Number(a.status) >= 500 || Number(a.status) === 0)) return 503;
  return 502;
}

function buildClientFailureMessage(attempts = []) {
  if (!attempts.length) return 'Arithmo AI is temporarily busy. Please try again in a few seconds.';
  if (attempts.some((a) => a.failureType === 'auth_error')) return 'Authentication issue detected.';
  if (attempts.some((a) => a.failureType === 'rate_limit' || a.status === 429)) return 'Too many requests. Please wait a moment.';
  if (attempts.some((a) => a.failureType === 'api_limit')) return 'Service limit reached temporarily.';
  if (attempts.some((a) => a.failureType === 'timeout')) return 'Request took too long.';
  if (attempts.some((a) => a.failureType === 'network_error')) return 'Connection problem detected.';
  if (attempts.some((a) => a.failureType === 'service_unavailable' || Number(a.status) >= 500 || Number(a.status) === 0)) return 'Arithmo AI is temporarily busy.';
  return 'Arithmo AI is temporarily busy. Please try again in a few seconds.';
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
            clientMessage: `Selected model mode "${selection.modelModeUsed}" is not configured. Choose a different mode or add the required API key.`,
          },
        }
      );
    }

    throw new AiRouterError('No AI provider configured. Add OPENROUTER_API_KEY, GROQ_API_KEY, or NVIDIA_API_KEY.', {
      status: 500,
      details: [{ provider: 'none', reason: 'missing_api_keys' }],
      metadata: {
        modelMode: selection.modelModeUsed,
        complexity: selection.complexity,
        clientMessage: 'No AI provider is configured. Please contact support.',
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
        console.error({
          mode: modelMode,
          provider,
          model: provider === 'openrouter_smart' ? getOpenRouterSmartModel()
              : provider === 'groq' ? getGroqModel()
              : (provider === 'nvidia' || provider === 'nvidia_backup') ? getNvidiaDeepModel()
              : provider,
          responseTimeMs: Date.now() - callStart,
        });

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

      console.error({ provider, error: `Provider returned HTTP ${status}` });

      attempts.push({
        provider,
        attempt: attempts.length + 1,
        status,
        failureType: detectFailureType({ status, errorText: providerError }),
        error: providerError,
        elapsedMs: Date.now() - callStart,
      });
    } catch (error) {
      if (error instanceof AiRouterError && error.status === 499) throw error;

      if (signal?.aborted || isAbortLikeError(error)) {
        throw new AiRouterError('Request cancelled by client.', {
          status: 499,
          details: attempts,
          metadata: { clientMessage: 'Request cancelled.' },
        });
      }

      const message = error?.message || 'Unknown request failure.';
      console.error({ provider, error: message });

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
