'use client';

import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from '@/components/chat/CodeBlock';
import {
  extractConfidence,
  extractDomainFromUrl,
  extractSection,
  formatTime,
  inferMessageMode,
  parseBulletLines,
  parseMarkdownSources,
  removeSections,
} from '@/lib/chatFormatting';

function renderLatex(text) {
  if (typeof window === 'undefined' || typeof text !== 'string') return text;

  try {
    const katex = require('katex');
    let result = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
      } catch {
        return _;
      }
    });

    result = result.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
      } catch {
        return _;
      }
    });

    return result;
  } catch {
    return text;
  }
}

function ConfidenceMeter({ level, reason }) {
  if (!level) return null;

  const tone = level.toLowerCase();
  return (
    <div className={`confidence-meter ${tone}`}>
      <span className="confidence-label">Confidence</span>
      <strong>{level}</strong>
      {reason && <span className="confidence-reason">{reason}</span>}
    </div>
  );
}

function SourcesCards({ items }) {
  if (items.length === 0) return null;

  return (
    <div className="sources-grid">
      {items.map((item) => (
        <a
          key={`${item.url}-${item.title}`}
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="source-card"
        >
          <span className="source-domain">{extractDomainFromUrl(item.url) || 'Source'}</span>
          <strong>{item.title}</strong>
          <span className="source-link">Open Source ↗</span>
        </a>
      ))}
    </div>
  );
}

function ResearchBlocks({ summary, keyPoints, perspectives, conclusion }) {
  if (!summary && keyPoints.length === 0 && !perspectives && !conclusion) {
    return null;
  }

  return (
    <div className="research-grid">
      {summary && (
        <section className="research-card">
          <h4>Summary</h4>
          <p>{summary}</p>
        </section>
      )}
      {keyPoints.length > 0 && (
        <section className="research-card">
          <h4>Key Points</h4>
          <ul>
            {keyPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>
      )}
      {perspectives && (
        <section className="research-card">
          <h4>Perspectives</h4>
          <p>{perspectives}</p>
        </section>
      )}
      {conclusion && (
        <section className="research-card">
          <h4>Conclusion</h4>
          <p>{conclusion}</p>
        </section>
      )}
    </div>
  );
}

export default function MessageBubble({ message, onFollowUpClick }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const imageSrc = message.imageDataUrl || message.imageUrl || '';
  const mode = inferMessageMode(message);

  const sourceItems = useMemo(() => {
    if (Array.isArray(message.sources) && message.sources.length > 0) {
      return message.sources.slice(0, 6);
    }
    return parseMarkdownSources(extractSection(message.content, 'Sources')).slice(0, 6);
  }, [message.content, message.sources]);

  const nextQuestions = useMemo(
    () => parseBulletLines(extractSection(message.content, 'Next Questions')).slice(0, 3),
    [message.content]
  );

  const research = useMemo(
    () => ({
      summary: extractSection(message.content, 'Summary'),
      keyPoints: parseBulletLines(extractSection(message.content, 'Key Points')),
      perspectives: extractSection(message.content, 'Perspectives'),
      conclusion: extractSection(message.content, 'Conclusion'),
    }),
    [message.content]
  );

  const confidence = useMemo(() => extractConfidence(message.content), [message.content]);

  const markdownText = useMemo(() => {
    if (isUser) return message.content;

    const sectionsToRemove = ['Sources', 'Next Questions', 'Confidence', 'Reason'];
    if (mode === 'research') {
      sectionsToRemove.push('Summary', 'Key Points', 'Perspectives', 'Conclusion');
    }

    return removeSections(message.content, sectionsToRemove);
  }, [isUser, message.content, mode]);

  function handleCopy() {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className={`msg-row ${isUser ? 'user' : 'assistant'} message-enter`}> 
      <div className={`msg-bubble ${isUser ? 'user' : 'assistant'}`}>
        {imageSrc && (
          <div className="msg-image-wrap">
            <img src={imageSrc} alt={isUser ? 'Attached image' : 'Generated image'} loading="lazy" />
          </div>
        )}

        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <>
            {markdownText && (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code: CodeBlock,
                  p: ({ children }) => {
                    if (typeof children === 'string') {
                      return <p dangerouslySetInnerHTML={{ __html: renderLatex(children) }} />;
                    }
                    return <p>{children}</p>;
                  },
                }}
              >
                {markdownText}
              </ReactMarkdown>
            )}

            {mode === 'research' && (
              <ResearchBlocks
                summary={research.summary}
                keyPoints={research.keyPoints}
                perspectives={research.perspectives}
                conclusion={research.conclusion}
              />
            )}

            {(mode === 'search' || mode === 'research') && <SourcesCards items={sourceItems} />}

            {nextQuestions.length > 0 && (
              <div className="msg-followup-wrap">
                <div className="msg-followup-title">Next Questions</div>
                <div className="msg-followup-chips">
                  {nextQuestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      className="followup-chip"
                      onClick={() => onFollowUpClick?.(question)}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <ConfidenceMeter level={confidence.level} reason={confidence.reason} />
          </>
        )}

        <div className="msg-meta">
          <span className="msg-time">{formatTime(message.timestamp)}</span>
          {!isUser && (
            <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} type="button">
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
