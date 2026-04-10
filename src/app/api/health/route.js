import { NextResponse } from 'next/server';
import { isGroqConfigured } from '@/services/ai/groqService';
import { isNvidiaConfigured } from '@/services/ai/nvidiaService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const groq = isGroqConfigured();
  const nvidia = isNvidiaConfigured();
  const overall = groq || nvidia ? 'online' : 'degraded';

  return NextResponse.json({
    status: overall,
    providers: {
      groq: groq ? 'configured' : 'missing',
      nvidia: nvidia ? 'configured' : 'missing',
    },
    timestamp: new Date().toISOString(),
  });
}

