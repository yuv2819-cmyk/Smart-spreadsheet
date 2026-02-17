# Smart Spreadsheet

AI-powered spreadsheet analytics app built with:
- `frontend/`: Next.js (App Router, TypeScript)
- `backend/`: FastAPI + SQLAlchemy

## Local Development

### 1. Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python init_db.py
python -m uvicorn app.main:app --reload
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

### Backend (`backend/.env`)
Use `backend/.env.example` as the baseline.

Required for production:
- `ENVIRONMENT=production`
- `DATABASE_URL=postgresql+asyncpg://...`
- `AUTH_JWT_SECRET=<long-random-secret>`
- `ALLOWED_ORIGINS=https://your-frontend-domain`
- `TRUSTED_HOSTS=your-frontend-domain`

Common:
- `OPENAI_API_KEY=...`
- `OPENAI_MODEL=gpt-4o-mini`
- `AUTH_JWT_SECRET=<long-random-secret>`
- `AUTH_ACCESS_TOKEN_EXPIRE_MINUTES=1440`
- `MAX_UPLOAD_SIZE_BYTES=10485760`
- `OVERVIEW_CACHE_TTL_SECONDS=30`

### Frontend (`frontend/.env.local` or host env vars)
Browser-side:
- `NEXT_PUBLIC_API_BASE=/api/backend`

Server-side (used by Next.js proxy route):
- `BACKEND_API_URL=http://127.0.0.1:8000` (local) or your backend URL
- `BACKEND_API_TOKEN=<optional-fallback-service-token>`
- `BACKEND_TENANT_ID=1`
- `BACKEND_USER_ID=1`

## Production Notes

- Frontend now proxies API requests through `frontend/app/api/backend/[...path]/route.ts`, so backend auth token is not exposed to browsers.
- Backend enforces production config validation:
  - no SQLite in production
  - requires `AUTH_JWT_SECRET`
  - requires `ALLOWED_ORIGINS`
  - requires non-default `TRUSTED_HOSTS`
- Backend includes trusted host middleware, security headers, gzip, request IDs, and readiness probe (`/ready`).
- Upload and AI routes are rate-limited.
- Built-in JWT auth endpoints:
  - `POST /auth/signup`
  - `POST /auth/signin`
  - `GET /auth/me`
  - `POST /auth/logout`

## Docker

### Development
```bash
docker-compose up --build
```

### Production-style compose
```bash
copy .env.prod.example .env
docker-compose -f docker-compose.prod.yml up --build -d
```

## Verification

```bash
# Frontend
npm --prefix frontend run lint
npm --prefix frontend run build

# Backend
python -m compileall backend/app backend/init_db.py
```

## Deployment

See `DEPLOYMENT.md` for full production deployment steps (Vercel + Railway and alternatives).
