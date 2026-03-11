# Arithmo

Arithmo is a full-stack AI chatbot platform with Groq-powered responses, secure auth, chat history, voice commands, file summarization, and a liquid glass UI.

## Stack

- Frontend: Next.js + React + Tailwind + Framer Motion + Zustand
- Backend: Node.js + Express
- Database: MongoDB + Mongoose
- Auth: JWT + bcrypt
- AI: Groq API
- Voice: Web Speech API + SpeechSynthesis

## Project Structure

- `/frontend` Next.js app
- `/backend` Express API

## Required Environment Variables

Backend (`backend/.env`):

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/arithmo
JWT_SECRET=change_me_super_secret
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_VISION_MODEL=llama-3.2-11b-vision-preview
SEARCH_API_URL=
SEARCH_API_KEY=
CLIENT_URL=http://localhost:3000
```

Frontend (`frontend/.env.local`):

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Install

```bash
npm install
```

Tip: you can copy from the included templates:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

## Run Locally

```bash
npm run dev
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

## API Routes

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `DELETE /api/auth/me`
- `POST /api/chat/message`
- `GET /api/chat/history`
- `GET /api/chat/:id`
- `GET /api/chat/search?q=keyword`
- `GET /api/chat/export/:id?format=md|txt|pdf`
- `DELETE /api/chat/:id`
- `DELETE /api/chat/clear/all`
- `POST /api/ai/summarize`
- `POST /api/ai/code-assist`
- `GET /api/memory`
- `POST /api/memory`
- `PUT /api/memory/:id`
- `DELETE /api/memory/:id`
- `POST /api/files/analyze`
- `POST /api/files/analyze-image`
- `POST /api/search`

## Features

- Sign up / sign in / logout
- JWT-protected routes
- Persistent chat history
- New chat + delete chat + clear all chats
- Markdown + code block rendering with syntax highlight
- Streaming AI responses from Groq
- AI mode switcher (general, coding, study, creative)
- AI memory extraction and memory manager
- Voice input (speech-to-text)
- AI voice output (text-to-speech)
- PDF/TXT/DOCX file analysis
- Image understanding (PNG/JPG/JPEG)
- Chat export in Markdown, TXT, and PDF
- Prompt template quick actions
- Sidebar conversation search via backend
- AI code playground page
- Optional internet search mode
- Liquid glass UI with dark mode toggle
- Terms & Conditions + Privacy Policy pages

## Production Deployment

### Frontend to Vercel

1. Import `frontend` as a Vercel project.
2. Build command: `npm run build`
3. Output: `.next`
4. Add env var: `NEXT_PUBLIC_API_URL=https://<your-render-backend-url>`

### Backend to Render

1. Create a Web Service from `backend` directory.
2. Build command: `npm install`
3. Start command: `npm run start`
4. Add env vars: `MONGODB_URI`, `JWT_SECRET`, `GROQ_API_KEY`, `CLIENT_URL`.

## Security Notes

- Passwords hashed with bcrypt.
- JWT required for chat and AI endpoints.
- Input validation via express-validator.
- Helmet + CORS enabled.

