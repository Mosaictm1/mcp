# 🚀 Deployment Guide - MCP Automator

## Prerequisites

1. **GitHub Repository** - Push your code
2. **Supabase Project** - For database
3. **Render Account** - For backend
4. **Vercel Account** - For frontend
5. **Pica Account** - API key ready

---

## Step 1: Supabase Setup

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Copy connection strings from Settings > Database:
   - `DATABASE_URL` (with pooler)
   - `DIRECT_URL` (without pooler)
4. Copy from Settings > API:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2: Deploy Backend to Render

1. Go to [render.com](https://render.com)
2. Click **New > Blueprint**
3. Connect your GitHub repo
4. Render will auto-detect `render.yaml`
5. Add these environment variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | From Supabase |
| `DIRECT_URL` | From Supabase |
| `SUPABASE_URL` | From Supabase |
| `SUPABASE_ANON_KEY` | From Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase |
| `OPENAI_API_KEY` | Your OpenAI key |
| `PICA_API_KEY` | Your Pica API key from dashboard |
| `FRONTEND_URL` | Your Vercel URL (after step 3) |

6. Deploy!
7. Copy your Render URL: `https://mcp-automator-api.onrender.com`

---

## Step 3: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repo
3. Set **Root Directory**: `apps/frontend`
4. Add environment variable:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://mcp-automator-api.onrender.com` |

5. Deploy!
6. Copy your Vercel URL: `https://mcp-automator.vercel.app`

---

## Step 4: Update Render with Frontend URL

1. Go back to Render dashboard
2. Update `FRONTEND_URL` to your Vercel URL
3. Trigger redeploy

---

## Step 5: Run Database Migrations

```bash
# From your local machine
cd apps/backend
DATABASE_URL="your-supabase-pooler-url" npx prisma db push
```

---

## Step 6: Configure Pica

1. Go to [picaos.com](https://picaos.com) dashboard
2. Add your Render backend URL to allowed origins
3. Configure OAuth apps for Gmail, Slack, etc in Pica dashboard

---

## 🎉 Done!

Your app is live at: `https://mcp-automator.vercel.app`

Users can now:
1. Sign up / Login
2. Connect accounts via Pica AuthKit
3. Run automations via chat!
