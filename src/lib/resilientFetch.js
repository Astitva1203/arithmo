/**
 * Resilient fetch wrapper with automatic retry and exponential backoff.
 * Designed to handle Vercel's DDoS mitigation 403 errors gracefully.
 */

const DEFAULT_OPTIONS = {
  maxRetries: 3,
  baseDelayMs: 800,
  maxDelayMs: 8000,
  retryOnStatuses: [429, 502, 503, 504],
};

/**
 * Sleeps for a specified number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches a URL with automatic retry on transient errors (403/429/5xx).
 * Uses exponential backoff with jitter to avoid thundering herd.
 *
 * @param {string} url - The URL to fetch.
 * @param {RequestInit} [fetchOptions] - Standard fetch options.
 * @param {object} [retryOptions] - Retry configuration overrides.
 * @param {number} [retryOptions.maxRetries] - Max number of retries (default: 3).
 * @param {number} [retryOptions.baseDelayMs] - Base delay in ms (default: 800).
 * @param {number} [retryOptions.maxDelayMs] - Max delay cap in ms (default: 8000).
 * @param {number[]} [retryOptions.retryOnStatuses] - HTTP statuses to retry on.
 * @returns {Promise<Response>}
 */
export async function resilientFetch(url, fetchOptions = {}, retryOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...retryOptions };
  let lastError = null;
  const optionsWithAuth = await withFirebaseAuth(url, fetchOptions, retryOptions);

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const response = await fetch(url, optionsWithAuth);

      // If the response is OK or it's a status we shouldn't retry, return it
      if (response.ok || !opts.retryOnStatuses.includes(response.status)) {
        return response;
      }

      // If we've used all retries, return the last failed response
      if (attempt >= opts.maxRetries) {
        return response;
      }

      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = opts.baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * opts.baseDelayMs * 0.5;
      const delay = Math.min(exponentialDelay + jitter, opts.maxDelayMs);

      await sleep(delay);
    } catch (err) {
      lastError = err;

      // Don't retry on abort
      if (err?.name === 'AbortError' || optionsWithAuth?.signal?.aborted) {
        throw err;
      }

      // If we've used all retries, throw
      if (attempt >= opts.maxRetries) {
        throw err;
      }

      const exponentialDelay = opts.baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * opts.baseDelayMs * 0.5;
      const delay = Math.min(exponentialDelay + jitter, opts.maxDelayMs);

      await sleep(delay);
    }
  }

  // Should not reach here, but just in case
  if (lastError) throw lastError;
  throw new Error('resilientFetch: unexpected end of retry loop');
}

async function withFirebaseAuth(url, fetchOptions = {}, retryOptions = {}) {
  if (retryOptions.skipAuth || typeof window === 'undefined') return fetchOptions;
  const urlText = typeof url === 'string' ? url : String(url || '');
  const isProtectedApi = urlText.startsWith('/api/') || urlText.includes('/api/');
  if (!isProtectedApi) return fetchOptions;

  try {
    const { getFirebaseClientAuth } = await import('@/lib/firebaseClient');
    const firebaseAuth = getFirebaseClientAuth();
    const token = await firebaseAuth.currentUser?.getIdToken();
    if (!token) return fetchOptions;

    return {
      ...fetchOptions,
      headers: {
        ...(fetchOptions.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    };
  } catch {
    return fetchOptions;
  }
}

/**
 * Stagger multiple async operations with a delay between each.
 * Useful for spacing out startup API calls to avoid DDoS triggers.
 *
 * @param {Array<() => Promise<any>>} tasks - Array of async functions to execute.
 * @param {number} [staggerMs=300] - Delay in ms between each task start.
 * @returns {Promise<any[]>} - Array of results in order.
 */
export async function staggeredExecute(tasks, staggerMs = 300) {
  const results = [];
  for (let i = 0; i < tasks.length; i++) {
    if (i > 0) {
      await sleep(staggerMs);
    }
    try {
      results.push(await tasks[i]());
    } catch (err) {
      results.push(null);
    }
  }
  return results;
}
