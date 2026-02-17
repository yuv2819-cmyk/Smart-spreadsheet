# Deployment Guide

This project is production-ready for a split deployment:
- Frontend: Vercel (Next.js)
- Backend: Railway/Render/Fly (FastAPI)
- Database: PostgreSQL

## 1. Backend Deployment

### Required production env vars
Set these on your backend host:

```bash
ENVIRONMENT=production
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/smart_spreadsheet
AUTH_JWT_SECRET=<long-random-secret-at-least-32-chars>
ALLOWED_ORIGINS=https://your-frontend-domain
TRUSTED_HOSTS=your-backend-domain
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
ENABLE_HTTPS_REDIRECT=true
# This repo currently uses SQLAlchemy `create_all` for initial schema creation (no Alembic migrations yet).
# Keep AUTO_CREATE_SCHEMA=true for first deploy so tables exist for signup/upload.
AUTO_CREATE_SCHEMA=true
AUTO_SEED_MVP_RECORDS=false
```

Optional:
```bash
MAX_UPLOAD_SIZE_BYTES=10485760
OVERVIEW_CACHE_TTL_SECONDS=30
ALLOW_VERCEL_PREVIEW_ORIGINS=false
```

### Railway
- Root directory: `backend`
- Start command:
```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers
```
- Add PostgreSQL and wire `DATABASE_URL`.
- Verify:
  - `GET /health`
  - `GET /ready`

## 2. Frontend Deployment (Vercel)

The frontend uses a server-side proxy route (`/api/backend/...`) so backend secrets stay server-side.

### Required env vars in Vercel
```bash
NEXT_PUBLIC_API_BASE=/api/backend
BACKEND_API_URL=https://your-backend-domain
BACKEND_API_TOKEN=<optional-fallback-service-token>
BACKEND_TENANT_ID=1
BACKEND_USER_ID=1
```

Do not use `NEXT_PUBLIC_API_TOKEN` in production.

## 3. Security Checklist

- Use a long random `AUTH_JWT_SECRET` (32+ chars).
- Restrict `ALLOWED_ORIGINS` to your exact frontend domains.
- Set `TRUSTED_HOSTS` to your actual domains.
- Keep `AUTO_CREATE_SCHEMA=false` in production.
- Keep `AUTO_SEED_MVP_RECORDS=false` in production.
- Rotate OpenAI and backend tokens if they were ever exposed.

## 4. Smoke Test After Deploy

1. Open frontend and upload a CSV.
2. Confirm overview metrics load.
3. Run an AI query from the assistant.
4. Confirm backend logs include request IDs and no 4xx/5xx spikes.

## 5. Docker Production Option

Use:
```bash
copy .env.prod.example .env
docker-compose -f docker-compose.prod.yml up --build -d
```

Edit `.env` first with real secrets.

Notes:
- When using Docker Compose, include `backend` in `TRUSTED_HOSTS` (the internal service hostname used by the Next.js proxy).
