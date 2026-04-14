const MAX_RESULTS = 5;
const CACHE_TTL_MS = Number(process.env.SEARCH_CACHE_TTL_MS || 90_000);
const SEARCH_TIMEOUT_MS = Number(process.env.SEARCH_TIMEOUT_MS || 10_000);
const REALTIME_QUERY_PATTERN =
  /\b(latest|news|today|current|updates?|recent|happening|new|trend(?:ing)?|this week|this month)\b/i;

const searchCache = new Map();

function sanitizeQuery(query) {
  return String(query || '').replace(/\s+/g, ' ').trim().slice(0, 400);
}

function truncateText(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function toResult(title, url, snippet, provider) {
  const safeTitle = truncateText(title, 180);
  const safeUrl = String(url || '').trim();
  const safeSnippet = truncateText(snippet, 260);
  if (!safeTitle || !safeUrl) return null;
  return {
    title: safeTitle,
    url: safeUrl,
    snippet: safeSnippet,
    provider,
  };
}

function buildTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const ms = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : SEARCH_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(new Error('Search request timed out.')), ms);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeoutId),
  };
}

function getDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function dedupeResults(results, targetCount) {
  const byUrl = new Set();
  const byDomain = new Set();
  const primary = [];
  const secondary = [];

  for (const result of results) {
    if (!result?.url) continue;
    const normalizedUrl = result.url.toLowerCase();
    if (byUrl.has(normalizedUrl)) continue;
    byUrl.add(normalizedUrl);

    const domain = getDomain(result.url);
    if (domain && !byDomain.has(domain)) {
      byDomain.add(domain);
      primary.push(result);
    } else {
      secondary.push(result);
    }
  }

  return [...primary, ...secondary].slice(0, targetCount);
}

function getCacheKey({ query, limit, mode }) {
  return `${mode || 'search'}::${limit}::${String(query || '').toLowerCase()}`;
}

function getCachedSearch(key) {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    searchCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedSearch(key, value) {
  searchCache.set(key, { value, timestamp: Date.now() });
  if (searchCache.size > 100) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey) searchCache.delete(oldestKey);
  }
}

async function searchWithSerpApi(query, limit, timeoutMs) {
  const key = process.env.SERPAPI_KEY;
  if (!key) return null;

  const q = encodeURIComponent(query);
  const num = Math.max(1, Math.min(10, limit));
  const endpoint =
    `https://serpapi.com/search.json?engine=google&q=${q}&num=${num}&api_key=${encodeURIComponent(key)}`;
  const { signal, cleanup } = buildTimeoutSignal(timeoutMs);

  try {
    const response = await fetch(endpoint, { signal });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`SerpAPI failed (${response.status}): ${errorBody.slice(0, 300)}`);
    }

    const data = await response.json().catch(() => ({}));
    const organic = Array.isArray(data?.organic_results) ? data.organic_results : [];
    const results = organic
      .map((item) => toResult(item?.title, item?.link, item?.snippet, 'serpapi'))
      .filter(Boolean);

    return { provider: 'serpapi', results };
  } finally {
    cleanup();
  }
}

async function searchWithBing(query, limit, timeoutMs) {
  const key = process.env.BING_SEARCH_API_KEY;
  if (!key) return null;

  const endpoint = process.env.BING_SEARCH_ENDPOINT || 'https://api.bing.microsoft.com/v7.0/search';
  const url = new URL(endpoint);
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(Math.max(1, Math.min(10, limit))));
  url.searchParams.set('mkt', 'en-US');

  const { signal, cleanup } = buildTimeoutSignal(timeoutMs);
  try {
    const response = await fetch(url.toString(), {
      headers: { 'Ocp-Apim-Subscription-Key': key },
      signal,
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Bing failed (${response.status}): ${errorBody.slice(0, 300)}`);
    }

    const data = await response.json().catch(() => ({}));
    const pages = Array.isArray(data?.webPages?.value) ? data.webPages.value : [];
    const results = pages
      .map((item) => toResult(item?.name, item?.url, item?.snippet, 'bing'))
      .filter(Boolean);

    return { provider: 'bing', results };
  } finally {
    cleanup();
  }
}

export function shouldUseWebSearch({ query, chatMode = 'chat' }) {
  const mode = String(chatMode || '').toLowerCase();
  if (mode === 'search' || mode === 'research') return true;
  return REALTIME_QUERY_PATTERN.test(sanitizeQuery(query));
}

export function formatSearchResultsForPrompt(results) {
  if (!Array.isArray(results) || results.length === 0) return '';
  return results
    .map(
      (item, index) =>
        `${index + 1}. Title: ${item.title}\nURL: ${item.url}\nSnippet: ${item.snippet || 'N/A'}`
    )
    .join('\n\n');
}

export function formatSourcesMarkdown(results) {
  if (!Array.isArray(results) || results.length === 0) return '';
  const lines = results.map((item) => `- [${item.title}](${item.url})`);
  return `Sources:\n${lines.join('\n')}`;
}

export function summarizeSearchFailure(errorMessage) {
  if (!errorMessage) return 'Search is temporarily unavailable.';
  return `Search unavailable right now (${String(errorMessage).slice(0, 160)}).`;
}

export async function runWebSearch({
  query,
  limit = MAX_RESULTS,
  timeoutMs = SEARCH_TIMEOUT_MS,
  mode = 'search',
}) {
  const normalizedQuery = sanitizeQuery(query);
  if (!normalizedQuery) {
    return { used: false, provider: 'none', results: [], error: 'Search query is empty.' };
  }

  const targetCount = mode === 'research' ? 5 : Math.max(1, Math.min(MAX_RESULTS, limit));
  const cacheKey = getCacheKey({ query: normalizedQuery, limit: targetCount, mode });
  const cached = getCachedSearch(cacheKey);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const providers = [searchWithSerpApi, searchWithBing];
  const errors = [];
  const collected = [];
  const providerHits = [];

  for (const searchFn of providers) {
    try {
      const requestedCount = mode === 'research' ? 10 : targetCount + 3;
      const output = await searchFn(normalizedQuery, requestedCount, timeoutMs);
      if (!output) continue;

      providerHits.push(output.provider);
      if (Array.isArray(output.results) && output.results.length > 0) {
        collected.push(...output.results);
      }

      const deduped = dedupeResults(collected, targetCount);
      if (mode === 'search' && deduped.length > 0) {
        const value = {
          used: true,
          provider: output.provider,
          results: deduped,
          error: null,
        };
        setCachedSearch(cacheKey, value);
        return value;
      }

      if (mode === 'research' && deduped.length >= targetCount) {
        const value = {
          used: true,
          provider: providerHits.join('+'),
          results: deduped.slice(0, targetCount),
          error: null,
        };
        setCachedSearch(cacheKey, value);
        return value;
      }
    } catch (error) {
      errors.push(error?.message || 'Unknown search failure.');
    }
  }

  const deduped = dedupeResults(collected, targetCount);
  if (deduped.length > 0) {
    const value = {
      used: true,
      provider: providerHits.join('+') || 'serpapi',
      results: deduped,
      error:
        mode === 'research' && deduped.length < targetCount
          ? `Limited coverage: only ${deduped.length} unique sources found.`
          : null,
    };
    setCachedSearch(cacheKey, value);
    return value;
  }

  const hasConfiguredProvider = Boolean(process.env.SERPAPI_KEY || process.env.BING_SEARCH_API_KEY);
  if (!hasConfiguredProvider) {
    return {
      used: false,
      provider: 'none',
      results: [],
      error: 'Search is not configured. Add SERPAPI_KEY or BING_SEARCH_API_KEY.',
    };
  }

  return {
    used: false,
    provider: 'none',
    results: [],
    error: errors[0] || 'Search failed.',
  };
}
