# Deployment Guide (GitHub + Vercel)

This guide is the repeatable process for redeploying Arithmo safely.

## 1) Preflight checks

Run these from the project root:

```powershell
git status
npm install
npm run build
```

Expected result: build succeeds and no unexpected files are staged.

## 2) Secret safety (required)

- Keep real secrets only in `.env.local` (local machine).
- Never commit `.env.local`.
- Keep placeholders in `.env.example` only.

Quick verification:

```powershell
git ls-files .env.local
```

Expected result: no output.

## 3) Push changes to GitHub

```powershell
git add .
git commit -m "Prepare redeploy"
git pull --rebase origin main
git push origin main
```

If you use a feature branch, push the branch and merge via PR.

## 4) Configure Vercel project (first time only)

```powershell
npx vercel login
npx vercel link
```

If your token is invalid, generate a new token in Vercel Account Settings and use:

```powershell
$env:VERCEL_TOKEN="YOUR_NEW_TOKEN"
npx vercel link --yes --token $env:VERCEL_TOKEN
```

## 5) Set Vercel environment variables

Set all runtime variables in Vercel Project Settings -> Environment Variables:

- GROQ_API_KEY
- GEMINI_API_KEY
- GEMINI_MODEL
- NVIDIA_API_KEY
- FREEPIK_API_KEY
- SERPAPI_KEY
- BING_SEARCH_API_KEY
- BING_SEARCH_ENDPOINT
- MONGODB_URI
- JWT_SECRET
- DAILY_IMAGE_LIMIT
- MAX_MESSAGES_PER_CHAT

Recommended: add values to Production, Preview, and Development as needed.

## 6) Redeploy to production

Option A (GitHub integration):
- Pushing to the production branch triggers a redeploy automatically.

Option B (manual CLI deploy):

```powershell
npx vercel --prod --yes
```

Token-based deploy:

```powershell
$env:VERCEL_TOKEN="YOUR_NEW_TOKEN"
npx vercel --prod --yes --token $env:VERCEL_TOKEN
```

## 7) Post-deploy validation

- Open the production URL and hard refresh.
- Verify login, chat response streaming, model mode selector, and search mode.
- Check API health route in browser:
  - /api/health

## 8) Android note

`capacitor.config.json` points to a hosted Vercel URL, so once Vercel redeploys successfully, Android WebView loads the latest web app.
