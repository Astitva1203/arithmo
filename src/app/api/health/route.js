import { NextResponse } from 'next/server';
import { isGroqConfigured } from '@/services/ai/groqService';
import { isGeminiConfigured } from '@/services/ai/geminiService';
import { isNvidiaConfigured } from '@/services/ai/nvidiaService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const groq = isGroqConfigured();
  const gemini = isGeminiConfigured();
  const nvidia = isNvidiaConfigured();
  const overall = groq || gemini || nvidia ? 'online' : 'degraded';

  return NextResponse.json({
    status: overall,
    providers: {
      groq: groq ? 'configured' : 'missing',
      gemini: gemini ? 'configured' : 'missing',
      nvidia: nvidia ? 'configured' : 'missing',
    },
    timestamp: new Date().toISOString(),
  });
}

