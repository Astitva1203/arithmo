# Arithmo AI (Groq + OpenRouter + NVIDIA)

Arithmo is a clean AI chatbot built with Next.js, with multi-provider support for Groq, OpenRouter, and NVIDIA.

This version includes only:
- Chat UI
- Streaming AI responses
- Voice input (Web Speech API)
- Image upload and analysis
- Local chat history (browser localStorage)
- Backend API route for secure key usage

No MongoDB. No authentication. No signup/login.

## 1) Install

```bash
npm install
```

## 2) Configure environment

Create `.env.local` and set at least one key (Groq, OpenRouter, or NVIDIA):

```env
GROQ_API_KEY=your_real_groq_key
GROQ_API_KEY_2=your_second_groq_key
GROQ_API_KEYS=your_groq_key_1,your_groq_key_2
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
GROQ_BASE_URL=https://api.groq.com/openai/v1

OPENROUTER_API_KEY=your_real_openrouter_key
OPENROUTER_API_KEY_2=your_second_openrouter_key
OPENROUTER_API_KEYS=your_openrouter_key_1,your_openrouter_key_2
OPENROUTER_MODEL=openrouter/auto
OPENROUTER_VISION_MODEL=openrouter/auto
OPENROUTER_IMAGE_MODEL=bytedance-seed/seedream-4.5
OPENROUTER_IMAGE_DAILY_LIMIT=3
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_SITE_URL=https://your-app-domain.vercel.app
OPENROUTER_APP_NAME=Arithmo AI

NVIDIA_API_KEY=your_real_nvidia_key
NVIDIA_API_KEY_2=your_second_nvidia_key
NVIDIA_API_KEYS=your_nvidia_key_1,your_nvidia_key_2
NVIDIA_MODEL=nvidia/nemotron-3-super-120b-a12b
NVIDIA_VISION_MODEL=nvidia/nemotron-3-super-120b-a12b
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_ENABLE_THINKING=true
NVIDIA_REASONING_BUDGET=16384
NVIDIA_INCLUDE_REASONING=false

AI_PROVIDER=auto
NEXT_PUBLIC_API_BASE_URL=
```

If your frontend is served from a different host and `/api/chat` returns 404, set:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-vercel-app.vercel.app
```

## 3) Run

```bash
npm run dev
```

Open: [http://localhost:3000](http://localhost:3000)

## Production

```bash
npm run build
npm run start
```

## Publish As Web App (Vercel)

1. Push this project to GitHub.
2. In Vercel, click **Add New Project** and import your repo.
3. Add environment variables in Vercel project settings:
   - `GROQ_API_KEY`
   - `GROQ_MODEL` (optional, default works)
   - `GROQ_VISION_MODEL` (optional, default works)
   - `GROQ_BASE_URL` (optional, default works)
   - `OPENROUTER_API_KEY` (optional, for OpenRouter)
   - `OPENROUTER_MODEL` (optional)
   - `OPENROUTER_VISION_MODEL` (optional)
   - `OPENROUTER_IMAGE_MODEL` (optional, used by "Create Image")
   - `OPENROUTER_IMAGE_DAILY_LIMIT` (optional, default `3`)
   - `OPENROUTER_BASE_URL` (optional)
   - `OPENROUTER_SITE_URL` (optional)
   - `OPENROUTER_APP_NAME` (optional)
   - `NVIDIA_API_KEY` (optional, for NVIDIA)
   - `NVIDIA_MODEL` (optional)
   - `NVIDIA_VISION_MODEL` (optional)
   - `NVIDIA_BASE_URL` (optional)
   - `NVIDIA_ENABLE_THINKING` (optional)
   - `NVIDIA_REASONING_BUDGET` (optional)
   - `NVIDIA_INCLUDE_REASONING` (optional)
   - `AI_PROVIDER` (`auto`, `groq`, `openrouter`, or `nvidia`)
4. Deploy.
5. Copy your live URL, for example:
   - `https://your-app-name.vercel.app`

## Publish As APK (Android)

This project already includes Capacitor Android setup.

### 1) Set your deployed web URL

Open `capacitor.config.json` and set:

```json
"server": {
  "url": "https://your-app-name.vercel.app",
  "cleartext": false
}
```

### 2) Sync Android project

```bash
npm run cap:sync
```

### 3) Open Android Studio

```bash
npm run cap:open
```

### 4) Fix SDK location (required once)

If you see:
`SDK location not found...`

Create `android/local.properties` with your SDK path, for example:

```properties
sdk.dir=C:\\Users\\YOUR_USERNAME\\AppData\\Local\\Android\\Sdk
```

### 5) Build APK / AAB

In Android Studio:
- Debug APK: **Build > Build Bundle(s) / APK(s) > Build APK(s)**
- Release AAB (Play Store): **Build > Generate Signed Bundle / APK**

Use **Android App Bundle (.aab)** for Play Store publishing.

## API endpoint

- `POST /api/chat`

Request body:

```json
{
  "messages": [
    { "role": "user", "content": "Hello" }
  ]
}
```
