# Arithmo Deployment Checklist

## 1) Generate and set secrets

- `JWT_SECRET`: use a long random string (at least 32 chars).
- `GROQ_API_KEY`: production key from Groq.
- `MONGODB_URI`: production MongoDB connection string.

## 2) Deploy Backend (Render)

Use root `render.yaml` or create manually:

- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm run start`
- Health check: `/api/health`

Set Render environment variables:

- `NODE_ENV=production`
- `PORT=5000`
- `MONGODB_URI=<your value>`
- `JWT_SECRET=<your value>`
- `GROQ_API_KEY=<your value>`
- `GROQ_MODEL=llama-3.3-70b-versatile`
- `GROQ_VISION_MODEL=llama-3.2-11b-vision-preview`
- `CLIENT_URL=https://<your-vercel-domain>`

## 3) Deploy Frontend (Vercel)

- Project root: `frontend`
- Framework preset: Next.js
- Build command: `npm run build`

Set Vercel environment variable:

- `NEXT_PUBLIC_API_URL=https://<your-render-backend-domain>`

## 4) CORS match

Make sure `CLIENT_URL` on Render exactly matches deployed frontend URL.

## 5) Post-deploy smoke test

- `GET https://<backend>/api/health` returns 200.
- Sign up/sign in works.
- Chat streaming works.
- File/image analysis works.
- Prompt library, pins, bookmarks, onboarding, settings persist.
