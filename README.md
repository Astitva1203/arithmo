# Arithmo AI (Groq)

Arithmo is a clean AI chatbot built with Next.js and Groq API.

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

Create `.env.local` and set your Groq key:

```env
GROQ_API_KEY=your_real_groq_key
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
GROQ_BASE_URL=https://api.groq.com/openai/v1
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
