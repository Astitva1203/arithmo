const duckDuckGoSearch = async (query) => {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Search request failed");
  }

  const data = await response.json();
  const results = [];

  if (data.AbstractText) {
    results.push({
      title: data.Heading || "Overview",
      snippet: data.AbstractText,
      url: data.AbstractURL || "https://duckduckgo.com"
    });
  }

  for (const topic of data.RelatedTopics || []) {
    if (results.length >= 5) break;
    if (topic.Text && topic.FirstURL) {
      results.push({ title: topic.Text.slice(0, 80), snippet: topic.Text, url: topic.FirstURL });
    }
    if (Array.isArray(topic.Topics)) {
      for (const nested of topic.Topics) {
        if (results.length >= 5) break;
        if (nested.Text && nested.FirstURL) {
          results.push({ title: nested.Text.slice(0, 80), snippet: nested.Text, url: nested.FirstURL });
        }
      }
    }
  }

  return results;
};

export const runWebSearch = async (query) => {
  const customUrl = process.env.SEARCH_API_URL;
  const customKey = process.env.SEARCH_API_KEY;

  if (customUrl && customKey) {
    const response = await fetch(`${customUrl}?q=${encodeURIComponent(query)}`, {
      headers: {
        Authorization: `Bearer ${customKey}`
      }
    });

    if (!response.ok) {
      throw new Error("Custom search provider failed");
    }

    const data = await response.json();
    return (data.results || []).slice(0, 5).map((item) => ({
      title: item.title || "Untitled",
      snippet: item.snippet || "",
      url: item.url || ""
    }));
  }

  return duckDuckGoSearch(query);
};

export const formatSearchContext = (query, results = []) => {
  if (!results.length) return "";
  return [
    `Web search results for: ${query}`,
    ...results.map((r, idx) => `${idx + 1}. ${r.title}\n${r.snippet}\nSource: ${r.url}`)
  ].join("\n\n");
};
