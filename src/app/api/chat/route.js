import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAuthUser } from '@/lib/auth';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are Arithmo AI, a smart, friendly assistant.
- Give clear and useful answers.
- Use markdown when helpful.
- For code, use fenced code blocks with language labels.
- For math, use LaTeX notation with $...$ for inline and $$...$$ for display.
- If unsure, say so honestly.`;

const MAX_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 4000;

// ===== PROVIDER CONFIGS =====
const GROQ_CONFIG = {
  baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
  model: 'llama-3.3-70b-versatile',
};

const NVIDIA_CONFIG = {
  baseUrl: 'https://integrate.api.nvidia.com/v1/chat/completions',
  model: 'meta/llama-3.3-70b-instruct',
  maxTokens: 4096,
  temperature: 0.7,
  topP: 0.95,
};

// Image generation (Freepik)
const FREEPIK_POLL_INTERVAL_MS = 1500;
const FREEPIK_POLL_TIMEOUT_MS = 45000;

function sanitizeText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}

function toSafeMessages(input) {
  if (!Array.isArray(input)) return [];
  return input
    .slice(-MAX_MESSAGES)
    .map((m) => {
      const role = m?.role === 'assistant' ? 'assistant' : 'user';
      const content = typeof m?.content === 'string' ? sanitizeText(m.content) : '';
      if (!content) return null;
      return { role, content };
    })
    .filter(Boolean);
}

function extractToken(parsed) {
  const delta = parsed?.choices?.[0]?.delta;
  if (!delta) return '';
  let out = '';
  if (typeof delta.reasoning_content === 'string') out += delta.reasoning_content;
  if (typeof delta.content === 'string') out += delta.content;
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ===== Resolve which provider to use =====
function resolveProvider(requested) {
  const groqKey = process.env.GROQ_API_KEY;
  const nvidiaKey = process.env.NVIDIA_API_KEY;

  if (requested === 'nvidia' && nvidiaKey) return 'nvidia';
  if (requested === 'groq' && groqKey) return 'groq';

  // Auto: prefer groq, fallback nvidia
  if (requested === 'auto') {
    if (groqKey) return 'groq';
    if (nvidiaKey) return 'nvidia';
  }

  // Fallback
  if (groqKey) return 'groq';
  if (nvidiaKey) return 'nvidia';
  return null;
}

// ===== Call upstream LLM =====
async function callUpstream(provider, messages) {
  if (provider === 'nvidia') {
    const apiKey = process.env.NVIDIA_API_KEY;
    return fetch(NVIDIA_CONFIG.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: NVIDIA_CONFIG.model,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        max_tokens: NVIDIA_CONFIG.maxTokens,
        temperature: NVIDIA_CONFIG.temperature,
        top_p: NVIDIA_CONFIG.topP,
        stream: true,
      }),
    });
  }

  // Default: Groq
  const apiKey = process.env.GROQ_API_KEY;
  return fetch(GROQ_CONFIG.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_CONFIG.model,
      stream: true,
      temperature: 0.7,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    }),
  });
}

// ===== IMAGE GENERATION (Freepik) =====
async function generateImage(prompt, apiKey) {
  const createRes = await fetch('https://api.freepik.com/v1/ai/mystic', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-freepik-api-key': apiKey,
    },
    body: JSON.stringify({ prompt }),
  });

  if (!createRes.ok) {
    const err = await createRes.text().catch(() => '');
    throw new Error(`Freepik API error (${createRes.status}). ${err}`);
  }

  const taskPayload = await createRes.json().catch(() => null);
  const taskData = taskPayload?.data || {};
  const taskId = String(taskData?.task_id || '').trim();
  const immediateUrl = (taskData?.generated || []).find((u) => typeof u === 'string' && u.trim());
  if (immediateUrl) return immediateUrl;
  if (!taskId) throw new Error('Freepik image task could not be started.');

  const deadline = Date.now() + FREEPIK_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(FREEPIK_POLL_INTERVAL_MS);
    const pollRes = await fetch(`https://api.freepik.com/v1/ai/mystic/${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json', 'x-freepik-api-key': apiKey },
    });
    if (!pollRes.ok) throw new Error(`Freepik poll error (${pollRes.status}).`);
    const pollData = await pollRes.json().catch(() => null);
    const status = String(pollData?.data?.status || '').toUpperCase();
    const imageUrl = (pollData?.data?.generated || []).find((u) => typeof u === 'string' && u.trim());
    if (imageUrl) return imageUrl;
    if (status === 'FAILED' || status === 'ERROR' || status === 'CANCELLED') {
      throw new Error(`Image generation ${status.toLowerCase()}.`);
    }
  }
  throw new Error('Image generation timed out. Try again.');
}

// ===== RATE LIMITS =====
const DAILY_MESSAGE_LIMIT = 5;
const DAILY_IMAGE_LIMIT = 2;

function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // "2026-04-01"
}

async function checkAndIncrementUsage(userId, type) {
  // type: 'messages' or 'images'
  const limit = type === 'images' ? DAILY_IMAGE_LIMIT : DAILY_MESSAGE_LIMIT;
  try {
    const db = await getDb();
    if (!db) return { allowed: true, remaining: limit }; // skip if no DB

    const today = getTodayKey();
    const key = `${userId}_${today}`;

    const usage = await db.collection('usage').findOne({ _id: key });
    const currentMessages = usage?.messages || 0;
    const currentImages = usage?.images || 0;
    const current = type === 'images' ? currentImages : currentMessages;

    if (current >= limit) {
      return { allowed: false, remaining: 0, used: current, limit };
    }

    await db.collection('usage').updateOne(
      { _id: key },
      { $inc: { [type]: 1 }, $setOnInsert: { userId, date: today } },
      { upsert: true }
    );

    return { allowed: true, remaining: limit - current - 1 };
  } catch (err) {
    console.error('Rate limit check error (non-fatal):', err.message);
    return { allowed: true, remaining: limit }; // allow on error
  }
}

// ===== POST handler =====
export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    // Get auth for rate limiting
    const auth = getAuthUser(request);
    const userId = auth?.userId || 'anonymous';

    // ===== IMAGE GENERATION =====
    if (body?.generateImage) {
      // Rate limit check
      const usage = await checkAndIncrementUsage(userId, 'images');
      if (!usage.allowed) {
        return NextResponse.json({
          error: `Daily image limit reached (${DAILY_IMAGE_LIMIT}/day). Try again tomorrow!`,
        }, { status: 429 });
      }

      const freepikKey = process.env.FREEPIK_API_KEY;
      if (!freepikKey) {
        return NextResponse.json({ error: 'Image generation not configured. Set FREEPIK_API_KEY.' }, { status: 500 });
      }
      const prompt = sanitizeText(body?.imagePrompt || body?.prompt || '');
      if (!prompt) {
        return NextResponse.json({ error: 'Image prompt is required.' }, { status: 400 });
      }
      try {
        const imageUrl = await generateImage(prompt, freepikKey);
        return NextResponse.json({
          type: 'image',
          content: `Here's the generated image for: "${prompt}"`,
          imageUrl,
          remaining: usage.remaining,
        });
      } catch (err) {
        return NextResponse.json({ error: err.message || 'Image generation failed.' }, { status: 502 });
      }
    }

    // ===== CHAT COMPLETION =====
    const safeMessages = toSafeMessages(body?.messages);
    if (safeMessages.length === 0) {
      return NextResponse.json({ error: 'At least one message is required.' }, { status: 400 });
    }

    // Rate limit check
    const usage = await checkAndIncrementUsage(userId, 'messages');
    if (!usage.allowed) {
      return NextResponse.json({
        error: `Daily message limit reached (${DAILY_MESSAGE_LIMIT}/day). Try again tomorrow!`,
      }, { status: 429 });
    }

    const requestedProvider = String(body?.provider || 'auto').toLowerCase();
    const provider = resolveProvider(requestedProvider);

    if (!provider) {
      return NextResponse.json({ error: 'No API keys configured. Set GROQ_API_KEY or NVIDIA_API_KEY.' }, { status: 500 });
    }

    let upstream = await callUpstream(provider, safeMessages);

    // Fallback to Groq if NVIDIA fails and Groq key is available
    if ((!upstream.ok || !upstream.body) && provider === 'nvidia' && process.env.GROQ_API_KEY) {
      console.log(`NVIDIA failed (${upstream.status}), falling back to Groq`);
      upstream = await callUpstream('groq', safeMessages);
    }

    if (!upstream.ok || !upstream.body) {
      const rawError = upstream ? await upstream.text().catch(() => '') : '';
      const label = provider === 'nvidia' ? 'Nemotron' : 'Groq';
      return NextResponse.json(
        { error: `${label} API error (${upstream.status}). ${rawError}` },
        { status: upstream.status || 500 }
      );
    }

    // DB persistence info
    const chatId = body?.chatId || null;
    const userContent = safeMessages[safeMessages.length - 1]?.content || '';

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = upstream.body.getReader();
    let fullResponse = '';

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
                const token = extractToken(parsed);
                if (token) {
                  fullResponse += token;
                  controller.enqueue(encoder.encode(token));
                }
              } catch { /* ignore malformed */ }
            }
          }
          if (buffer) {
            const trimmed = buffer.trim();
            if (trimmed.startsWith('data:')) {
              const payload = trimmed.slice(5).trim();
              if (payload && payload !== '[DONE]') {
                try {
                  const parsed = JSON.parse(payload);
                  const token = extractToken(parsed);
                  if (token) {
                    fullResponse += token;
                    controller.enqueue(encoder.encode(token));
                  }
                } catch { /* ignore */ }
              }
            }
          }
        } catch (error) {
          controller.enqueue(encoder.encode(`\n\n[Stream error] ${error?.message || 'Unknown error'}`));
        } finally {
          controller.close();
          // Save to DB
          if (auth?.userId && chatId && fullResponse.trim()) {
            try {
              const db = await getDb();
              if (!db) throw new Error('DB unavailable');
              const now = new Date();
              await db.collection('messages').insertMany([
                { chatId, role: 'user', content: userContent, timestamp: now },
                { chatId, role: 'assistant', content: fullResponse, timestamp: new Date(now.getTime() + 1) },
              ]);
              const { ObjectId } = await import('mongodb');
              const chat = await db.collection('chats').findOne({
                _id: ObjectId.createFromHexString(chatId),
                userId: auth.userId,
              });
              if (chat && chat.title === 'New Chat') {
                const autoTitle = userContent.slice(0, 60) + (userContent.length > 60 ? '...' : '');
                await db.collection('chats').updateOne({ _id: chat._id }, { $set: { title: autoTitle, updatedAt: now } });
              } else if (chat) {
                await db.collection('chats').updateOne({ _id: chat._id }, { $set: { updatedAt: now } });
              }
            } catch (dbErr) {
              console.error('DB save error (non-fatal):', dbErr);
            }
          }
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
    return NextResponse.json({ error: error?.message || 'Internal server error.' }, { status: 500 });
  }
}
