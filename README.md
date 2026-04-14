# Arithmo AI

Arithmo is a full-stack AI chatbot with a modern liquid glass UI, streaming responses, image analysis, authentication, MongoDB persistence, and multi-provider AI routing.

## Key Features

- Multi-provider AI chat: Groq + Gemini + NVIDIA
- Intelligent provider routing (auto mode)
- Bidirectional fallback with retry:
  - Groq -> NVIDIA
  - NVIDIA -> Groq
- Real-time Search Mode (RAG-style web grounding)
- Source links added for web-grounded responses
- Streaming responses with markdown and code highlighting
- Image attach for visual questions
- Image generation via Freepik API with daily limit
- Chat history, rename, delete, auto-title, dynamic title refinement
- Auth with JWT cookie + MongoDB user storage
- Export chat to TXT
- Android packaging support (Capacitor)

## Architecture

- `src/services/ai/groqService.js`
- `src/services/ai/geminiService.js`
- `src/services/ai/nvidiaService.js`
- `src/router/aiRouter.js`
- `src/services/search/webSearch.js`
- `src/app/api/chat/route.js`
- `src/app/api/search/route.js`
- `src/app/api/health/route.js`

## Environment Variables

Copy `.env.example` to `.env.local` and fill values:

```bash
cp .env.example .env.local
```

Required:

- `GROQ_API_KEY`
- `MONGODB_URI`
- `JWT_SECRET`

Optional:

- `NVIDIA_API_KEY` (for NVIDIA provider)
- `GEMINI_API_KEY` (for Gemini provider)
- `GEMINI_MODEL` (default: `gemini-3-flash-preview`)
- `FREEPIK_API_KEY` (image generation)
- `SERPAPI_KEY` (preferred web search)
- `BING_SEARCH_API_KEY` (fallback web search)
- `BING_SEARCH_ENDPOINT` (default: `https://api.bing.microsoft.com/v7.0/search`)
- `DAILY_IMAGE_LIMIT` (default: `3`)
- `MAX_MESSAGES_PER_CHAT` (default: `0`, meaning no server-side cap)

## Run Locally

```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

## Build

```bash
npm run build
npm run start
```

## Routing Logic

- Provider `auto`:
  - Simpler prompts prefer Groq (speed)
  - Complex prompts prefer NVIDIA (depth)
- If selected provider fails, Arithmo retries once then switches provider (Groq/Gemini/NVIDIA).
- Search Mode:
  - Performs web search when mode is `search` or query looks real-time (`latest`, `news`, `today`, etc.)
  - Injects top web findings into system context
  - Appends source links in final answer

## Android (APK)

```bash
npm run android:add
npm run android:sync
npm run android:open
```

Build APK from Android Studio: `Build > Build APK(s)`.
