# Smart Spreadsheet Deployment Guide

## Overview
This guide walks you through deploying the Smart Spreadsheet application to production. The frontend will be deployed to Vercel, and the backend to Railway (recommended) or another hosting provider.

## Prerequisites
- Git repository (GitHub, GitLab, or Bitbucket)
- Vercel account (free tier available)
- Railway account (recommended for backend) OR Render/Fly.io account
- OpenAI API key (for AI features)

---

## Part 1: Backend Deployment (Railway - Recommended)

### Step 1: Prepare Backend for Production

1. **Create a PostgreSQL database** (Railway provides this automatically)

2. **Update `requirements.txt`** - Ensure it includes:
   ```
   fastapi
   uvicorn[standard]
   sqlalchemy
   asyncpg  # PostgreSQL driver
   aiosqlite
   python-dotenv
   openai
   pandas
   python-multipart
   ```

3. **Create `railway.json`** in the backend directory:
   ```json
   {
     "$schema": "https://railway.app/railway.schema.json",
     "build": {
       "builder": "NIXPACKS"
     },
     "deploy": {
       "startCommand": "uvicorn app.main:app --host 0.0.0.0 --port $PORT",
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 10
     }
   }
   ```

### Step 2: Deploy to Railway

1. Go to [Railway.app](https://railway.app) and sign in
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository and choose the `backend` directory
4. Railway will auto-detect Python and create a service

### Step 3: Add Environment Variables in Railway

In your Railway project dashboard, add these environment variables:

```bash
DATABASE_URL=<auto-provided-by-railway-postgres>
OPENAI_API_KEY=sk-your-openai-api-key
ENVIRONMENT=production
ALLOWED_ORIGINS=https://your-app.vercel.app
```

**Note**: Railway will automatically provide `DATABASE_URL` when you add a PostgreSQL database to your project.

### Step 4: Add PostgreSQL Database

1. In Railway project, click "New" → "Database" → "PostgreSQL"
2. Railway automatically links it and sets `DATABASE_URL`
3. Your backend will restart with the new database connection

### Step 5: Initialize Production Database

Railway doesn't have a direct way to run one-time scripts, so you have two options:

**Option A: Temporary startup script**
1. Modify `app/main.py` startup to create tables (it already does with `Base.metadata.create_all`)
2. Deploy and let it create tables on first run

**Option B: Railway CLI**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and link to project
railway login
railway link

# Run database initialization
railway run python init_db.py
```

---

## Part 2: Frontend Deployment (Vercel)

### Step 1: Update Environment Variables

1. In your local `.env.local` file, verify:
   ```bash
   NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
   ```

2. This is for local development only - production will use Vercel environment variables

### Step 2: Deploy to Vercel

#### Option A: Vercel CLI (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Navigate to frontend directory
cd frontend

# Deploy
vercel

# Follow prompts:
# - Link to existing project or create new
# - Set root directory to current directory
# - Don't modify build settings
# - Deploy!
```

#### Option B: Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New" → "Project"
3. Import your Git repository
4. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)

### Step 3: Add Environment Variables in Vercel

In Vercel project settings → Environment Variables:

```bash
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

**Important**: Use your actual Railway backend URL (found in Railway dashboard)

### Step 4: Redeploy

After adding environment variables:
1. Go to Vercel Deployments tab
2. Click "Redeploy" on the latest deployment
3. Or push a new commit to trigger redeployment

---

## Part 3: Post-Deployment Configuration

### Update Backend CORS

Your backend is already configured to allow Vercel deployments. If you have a custom domain:

1. Add it to Railway environment variables:
   ```bash
   ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   ```

2. Redeploy backend in Railway

### Test API Connection

1. Open browser console on your Vercel deployment
2. Check Network tab for API calls
3. Verify requests go to Railway backend URL
4. Confirm no CORS errors

---

## Part 4: Verification Checklist

- [ ] Backend deployed to Railway and running
- [ ] PostgreSQL database created and connected
- [ ] Backend environment variables set (DATABASE_URL, OPENAI_API_KEY)
- [ ] Frontend deployed to Vercel
- [ ] Frontend environment variables set (NEXT_PUBLIC_API_URL)
- [ ] API calls from frontend successfully reach backend
- [ ] No CORS errors in browser console
- [ ] Can upload CSV files
- [ ] Can view data in spreadsheet
- [ ] Overview page shows metrics
- [ ] AI summarization works (if OpenAI key is valid)

---

## Alternative Backend Hosting Options

### Render
1. Create account at [render.com](https://render.com)
2. New Web Service → Connect repository
3. Settings:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add PostgreSQL database from Render dashboard
5. Set environment variables same as Railway

### Fly.io
Requires Docker. Create `Dockerfile` in backend:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Then deploy:
```bash
fly launch
fly deploy
```

---

## Troubleshooting

### CORS Errors
- Verify `NEXT_PUBLIC_API_URL` in Vercel matches your backend URL exactly
- Check Railway logs for CORS middleware errors
- Ensure backend `ALLOWED_ORIGINS` includes your Vercel URL

### Database Connection Errors
- Verify `DATABASE_URL` format: `postgresql+asyncpg://user:password@host:port/dbname`
- Check Railway PostgreSQL is running
- View Railway logs for specific database errors

### Build Errors on Vercel
- Check you're using Node.js 18 or higher
- Verify all dependencies are in `package.json`
- Check Vercel build logs for specific errors

### API 404 Errors
- Verify backend is running in Railway
- Check Railway logs for startup errors
- Confirm API URL in Vercel env vars is correct
- Test backend health endpoint: `https://your-backend.railway.app/health`

---

## Local Development

To continue developing locally after deployment:

```bash
# Backend
cd backend
source venv/bin/activate  # or `venv\\Scripts\\activate` on Windows
python -m uvicorn app.main:app --reload

# Frontend (in new terminal)
cd frontend
npm run dev
```

Environment variables from `.env.local` will be used automatically.

---

## Cost Estimates

### Free Tier Limits
- **Vercel**: 100GB bandwidth, 6000 build minutes/month, unlimited deployments
- **Railway**: $5 credit/month (enough for small projects)
- **Render**: 750 hours/month free tier, PostgreSQL 90 days free
- **OpenAI**: Pay-per-use, ~$0.002 per 1K tokens

### Scaling Considerations
- Vercel scales automatically based on traffic
- Railway auto-scales with usage-based pricing
- Consider caching frequently accessed data
- Implement rate limiting for AI features

---

## Next Steps

1. **Set up monitoring**: Add error tracking (Sentry, LogRocket)
2. **Custom domain**: Configure in Vercel and Railway
3. **SSL/HTTPS**: Automatic with Vercel and Railway
4. **Database backups**: Railway provides automatic backups
5. **CI/CD**: GitHub Actions for automated testing

---

## Support

For deployment issues:
- **Vercel**: [docs.vercel.com](https://docs.vercel.com)
- **Railway**: [docs.railway.app](https://docs.railway.app)
- **FastAPI**: [fastapi.tiangolo.com](https://fastapi.tiangolo.com)
- **Next.js**: [nextjs.org/docs](https://nextjs.org/docs)
