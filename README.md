# Arithmo AI (Groq + Nemotron + Freepik)

Arithmo is a Next.js chatbot with:
- Groq chat
- NVIDIA Nemotron chat
- Freepik image generation
- Voice input, streaming replies, and image upload analysis

## 1) Install

```bash
npm install
```

## 2) Configure environment

Create `.env.local`:

```env
GROQ_API_KEY=your_real_groq_key
NVIDIA_API_KEY=your_real_nvidia_key
FREEPIK_API_KEY=your_real_freepik_key
```

Optional only when frontend and API use different domains:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-vercel-app.vercel.app
```

## 3) Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 4) Build for production

```bash
npm run build
npm run start
```
