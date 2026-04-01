# Arithmo AI

A premium AI chatbot powered by [Groq API](https://groq.com/) with a liquid glass UI, persistent chat history, and user authentication.

## Features

- 🧠 **AI Chat** — Powered by Groq (Llama 3.3 70B) with streaming responses
- 💬 **Multi-Chat** — Create, rename, delete, and switch between conversations
- 🔐 **Authentication** — Email/password auth with JWT + httpOnly cookies
- 🗄️ **Database** — MongoDB for persistent chat history and user data
- 🎨 **Liquid Glass UI** — Premium glassmorphism design with dark/light themes
- 📐 **Math Rendering** — LaTeX support via KaTeX
- 💻 **Code Highlighting** — Syntax highlighting with one-click copy
- 📥 **Export** — Download chat history as TXT
- 📱 **Responsive** — Full mobile, tablet, and desktop support
- ⚖️ **Legal** — Terms of Use, Privacy Policy, AI disclaimer

## Setup

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd arithmo
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:
- `GROQ_API_KEY` — Get from [console.groq.com](https://console.groq.com/)
- `MONGODB_URI` — MongoDB connection string ([MongoDB Atlas](https://www.mongodb.com/atlas) recommended)
- `JWT_SECRET` — A long random string for JWT signing

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

### Frontend + Backend → Vercel

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Set environment variables in Vercel project settings
4. Deploy!

### Database → MongoDB Atlas

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a database user and whitelist your IP (or use `0.0.0.0/0` for Vercel)
3. Copy the connection string to `MONGODB_URI`

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS v4 + Custom CSS
- **AI**: Groq API (Llama 3.3 70B)
- **Database**: MongoDB
- **Auth**: JWT + bcrypt
- **Rendering**: React Markdown, KaTeX, Prism.js

## Contact

astitvapandey1203@gmail.com
