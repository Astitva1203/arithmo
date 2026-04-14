const KNOWN_SECTIONS = [
  'Summary',
  'Key Points',
  'Perspectives',
  'Conclusion',
  'Sources',
  'Next Questions',
  'Confidence',
  'Reason',
];

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sectionMatchers(sectionName) {
  const heading = escapeRegex(sectionName);
  const otherHeadings = KNOWN_SECTIONS.filter((item) => item !== sectionName)
    .map((item) => escapeRegex(item))
    .join('|');

  return {
    multiline: new RegExp(
      `(?:^|\\n)${heading}\\s*:\\s*\\n([\\s\\S]*?)(?=\\n(?:${otherHeadings})\\s*:|$)`,
      'i'
    ),
    inline: new RegExp(
      `(?:^|\\n)${heading}\\s*:\\s*([^\\n]+)(?=\\n(?:${otherHeadings})\\s*:|$)`,
      'i'
    ),
    block: new RegExp(
      `(?:^|\\n)${heading}\\s*:\\s*(?:\\n[\\s\\S]*?|[^\\n]*)(?=\\n(?:${otherHeadings})\\s*:|$)`,
      'i'
    ),
  };
}

export function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function extractSection(text, sectionName) {
  const content = String(text || '');
  if (!content) return '';

  const matchers = sectionMatchers(sectionName);
  const multiMatch = content.match(matchers.multiline);
  if (multiMatch?.[1]) {
    return multiMatch[1].trim();
  }

  const inlineMatch = content.match(matchers.inline);
  return inlineMatch?.[1]?.trim() || '';
}

export function removeSection(text, sectionName) {
  const content = String(text || '');
  if (!content) return '';

  const matchers = sectionMatchers(sectionName);
  return content.replace(matchers.block, '').replace(/\n{3,}/g, '\n\n').trim();
}

export function removeSections(text, sectionNames) {
  return sectionNames.reduce((current, sectionName) => removeSection(current, sectionName), String(text || ''));
}

export function parseMarkdownSources(sectionText) {
  const input = String(sectionText || '');
  if (!input) return [];

  const markdownMatches = [...input.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi)];
  if (markdownMatches.length > 0) {
    return markdownMatches.map((match) => ({
      title: match[1].trim(),
      url: match[2].trim(),
    }));
  }

  const lines = input
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);

  return lines
    .map((line) => {
      const urlMatch = line.match(/https?:\/\/\S+/i);
      if (!urlMatch) return null;
      const url = urlMatch[0];
      const title = line.replace(url, '').replace(/[-–—:]/g, ' ').trim() || url;
      return { title, url };
    })
    .filter(Boolean);
}

export function parseBulletLines(sectionText) {
  return String(sectionText || '')
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
}

export function extractConfidence(content) {
  const confidenceSection = extractSection(content, 'Confidence');
  const reasonSection = extractSection(content, 'Reason');

  const confidenceMatch = String(confidenceSection || '').match(/\b(high|medium|low)\b/i);
  const level = confidenceMatch?.[1]
    ? `${confidenceMatch[1][0].toUpperCase()}${confidenceMatch[1].slice(1).toLowerCase()}`
    : '';

  return {
    level,
    reason: String(reasonSection || '').trim(),
  };
}

export function extractDomainFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

export function inferMessageMode(message) {
  if (message?.mode === 'search' || message?.mode === 'research' || message?.mode === 'chat') {
    return message.mode;
  }

  const content = String(message?.content || '');
  if (!content) return 'chat';

  const hasResearchSections =
    /\bSummary\s*:/i.test(content) &&
    /\bKey Points\s*:/i.test(content) &&
    /\bConclusion\s*:/i.test(content);

  if (hasResearchSections) return 'research';
  if (/\bSources\s*:/i.test(content)) return 'search';
  return 'chat';
}
