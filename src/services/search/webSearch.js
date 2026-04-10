const MAX_RESULTS = 5;
const REALTIME_QUERY_PATTERN =
  /\b(latest|news|today|current|updates?|recent|happening|new|trend(?:ing)?|this week|this month)\b/i;

function sanitizeQuery(query) {
  return String(query || '').replace(/\s+/g, ' ').trim().slice(0, 400);
}

function toResult(title, url, snippet, provider) {
  const safeTitle = String(title || '').trim();
  const safeUrl = String(url || '').trim();
  const safeSnippet = String(snippet || '').replace(/\s+/g, ' ').trim();

  if (!safeTitle || !safeUrl) return null;
  return {
    title: safeTitle.slice(0, 180),
    url: safeUrl,
    snippet: safeSnippet.slice(0, 300),
    provider,
  };
}

function buildTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const ms = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 10_000;
  const timeoutId = setTimeout(() => controller.abort(new Error('Search request timed out.')), ms);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeoutId),
  };
}

async function searchWithSerpApi(query, limit, timeoutMs) {
  const key = process.env.SERPAPI_KEY;
  if (!key) return null;

  const q = encodeURIComponent(query);
  const num = Math.max(1, Math.min(MAX_RESULTS, limit));
  const endpoint = `https://serpapi.com/search.json?engine=google&q=${q}&num=${num}&api_key=${encodeURIComponent(key)}`;
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
      .filter(Boolean)
      .slice(0, num);

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
  url.searchParams.set('count', String(Math.max(1, Math.min(MAX_RESULTS, limit))));
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
      .filter(Boolean)
      .slice(0, limit);

    return { provider: 'bing', results };
  } finally {
    cleanup();
  }
}

export function shouldUseWebSearch({ query, chatMode = 'chat' }) {
  if (String(chatMode || '').toLowerCase() === 'search') return true;
  const normalized = sanitizeQuery(query);
  return REALTIME_QUERY_PATTERN.test(normalized);
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

export async function runWebSearch({ query, limit = MAX_RESULTS, timeoutMs = 10_000 }) {
  const normalizedQuery = sanitizeQuery(query);
  if (!normalizedQuery) {
    return { used: false, provider: 'none', results: [], error: 'Search query is empty.' };
  }

  const providers = [searchWithSerpApi, searchWithBing];
  const errors = [];

  for (const searchFn of providers) {
    try {
      const output = await searchFn(normalizedQuery, limit, timeoutMs);
      if (!output) continue;
      return {
        used: true,
        provider: output.provider,
        results: output.results || [],
        error: null,
      };
    } catch (error) {
      errors.push(error?.message || 'Unknown search failure.');
    }
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

