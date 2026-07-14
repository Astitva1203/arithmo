import { NextResponse } from 'next/server';
import { isGroqConfigured } from '@/services/ai/groqService';
import { isNvidiaConfigured, isNvidiaBackupConfigured } from '@/services/ai/nvidiaService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const groq = isGroqConfigured();
  const nvidia = isNvidiaConfigured();
  const nvidiaBackup = isNvidiaBackupConfigured();
  const overall = groq || nvidia || nvidiaBackup ? 'online' : 'degraded';

  return NextResponse.json({
    status: overall,
    providers: {
      groq: groq ? 'configured' : 'missing',
      nvidia: nvidia ? 'configured' : 'missing',
      nvidiaBackup: nvidiaBackup ? 'configured' : 'missing',
    },
    timestamp: new Date().toISOString(),
  });
}
