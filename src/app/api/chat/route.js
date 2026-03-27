import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are Arithmo AI, a smart, friendly assistant.
- Give clear and useful answers.
- Use markdown when helpful.
- For code, use fenced code blocks with language labels.
- If unsure, say so honestly.`;

const MAX_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_IMAGE_DATA_URL_LENGTH = 5700000;
const MAX_IMAGES_PER_REQUEST = 5;

function sanitizeText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}

function isAllowedImageUrl(url) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();

  if (trimmed.startsWith('data:image/')) {
    return trimmed.length <= MAX_IMAGE_DATA_URL_LENGTH;
  }

  return trimmed.startsWith('https://') || trimmed.startsWith('http://');
}

function sanitizeMessageContent(role, content) {
  if (typeof content === 'string') {
    return sanitizeText(content);
  }

  if (!Array.isArray(content)) {
    return '';
  }

  // Assistant/tool history should remain plain text for stable replay.
  if (role !== 'user') {
    const mergedText = content
      .filter((part) => part?.type === 'text' && typeof part?.text === 'string')
      .map((part) => sanitizeText(part.text))
      .filter(Boolean)
      .join(' ');

    return sanitizeText(mergedText);
  }

  const parts = [];

  for (const part of content) {
    if (part?.type === 'text' && typeof part?.text === 'string') {
      const text = sanitizeText(part.text);
      if (text) {
        parts.push({ type: 'text', text });
      }
      continue;
    }

    const imageUrl = part?.image_url?.url;
    if (part?.type === 'image_url' && isAllowedImageUrl(imageUrl)) {
      parts.push({ type: 'image_url', image_url: { url: imageUrl.trim() } });
    }
  }

  const hasTextPart = parts.some((p) => p.type === 'text');
  const hasImagePart = parts.some((p) => p.type === 'image_url');

  if (hasImagePart && !hasTextPart) {
    parts.unshift({ type: 'text', text: 'Please analyze this image.' });
  }

  return parts.length > 0 ? parts : '';
}

function toSafeMessages(input) {
  if (!Array.isArray(input)) return [];

  return input
    .slice(-MAX_MESSAGES)
    .map((m) => {
      const role = m?.role === 'assistant' ? 'assistant' : 'user';
      const content = sanitizeMessageContent(role, m?.content);
      if (!content) return null;
      return { role, content };
    })
    .filter(Boolean);
}

function buildChatCompletionsUrl(baseUrl) {
  const clean = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!clean) return 'https://api.groq.com/openai/v1/chat/completions';
  if (clean.endsWith('/chat/completions')) return clean;
  if (clean.endsWith('/openai/v1')) return `${clean}/chat/completions`;
  if (clean.endsWith('/v1')) return `${clean}/chat/completions`;
  return `${clean}/openai/v1/chat/completions`;
}

function getGroqConfig() {
  return {
    apiKey: process.env.GROQ_API_KEY || '',
    baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    textModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    visionModel:
      process.env.GROQ_VISION_MODEL ||
      'meta-llama/llama-4-scout-17b-16e-instruct',
  };
}

function countImages(messages) {
  let count = 0;

  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;
    count += msg.content.filter((part) => part.type === 'image_url').length;
  }

  return count;
}

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const safeMessages = toSafeMessages(body?.messages);
    if (safeMessages.length === 0) {
      return NextResponse.json(
        { error: 'At least one message is required.' },
        { status: 400 }
      );
    }

    const imageCount = countImages(safeMessages);
    if (imageCount > MAX_IMAGES_PER_REQUEST) {
      return NextResponse.json(
        {
          error: `Too many images in one request. Maximum ${MAX_IMAGES_PER_REQUEST} images are allowed.`,
        },
        { status: 400 }
      );
    }

    const hasImageInput = imageCount > 0;

    const { apiKey, baseUrl, textModel, visionModel } = getGroqConfig();
    const model = hasImageInput ? visionModel : textModel;

    if (!apiKey || apiKey.includes('your_')) {
      return NextResponse.json(
        { error: 'Missing Groq API key. Set GROQ_API_KEY in .env.local.' },
        { status: 500 }
      );
    }

    const chatUrl = buildChatCompletionsUrl(baseUrl);

    const upstream = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        temperature: 0.7,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...safeMessages],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const rawError = await upstream.text().catch(() => '');

      if (upstream.status === 401) {
        return NextResponse.json(
          {
            error:
              'Invalid Groq API key (401). Create a new key at console.groq.com/keys and update GROQ_API_KEY in .env.local.',
          },
          { status: 401 }
        );
      }

      if (upstream.status === 404) {
        const details = hasImageInput
          ? 'Vision model not found. Check GROQ_VISION_MODEL in .env.local.'
          : 'Model or endpoint not found. Check GROQ_MODEL and GROQ_BASE_URL in .env.local.';

        return NextResponse.json(
          {
            error: `Groq API error (404). ${details}`,
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: `Groq API error (${upstream.status}). ${rawError || 'Request failed.'}`,
        },
        { status: upstream.status || 500 }
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = upstream.body.getReader();

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;

              const payload = trimmed.slice(5).trim();
              if (!payload || payload === '[DONE]') continue;

              try {
                const parsed = JSON.parse(payload);
                const token = parsed?.choices?.[0]?.delta?.content || '';
                if (token) {
                  controller.enqueue(encoder.encode(token));
                }
              } catch {
                // Ignore malformed partial lines.
              }
            }
          }
        } catch (error) {
          controller.enqueue(
            encoder.encode(`\n\n[Stream error] ${error?.message || 'Unknown error'}`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
