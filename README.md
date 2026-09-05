# Smart Spreadsheet

CSV in. Charts, cleaning, and AI answers out.

A multi-tenant analytics app for SMB teams that need weekly numbers without writing SQL. Upload a messy export, get deterministic metrics first, then ask questions in plain language.

**Live:** [smart-spreadsheet-nu.vercel.app](https://smart-spreadsheet-nu.vercel.app)

## What it does

- Sign in to a tenant-isolated workspace
- Upload CSVs and manage datasets
- Overview metrics, trends, quality signals, KPI views
- AI Q&A and summaries on top of calculated numbers
- Data cleaning with preview, apply, and rollback
- Reports with share / comment / approval
- India mode: Apr–Mar fiscal year, INR formatting, India trend reports

Core numbers come from backend calculations (Pandas), not from the model making up totals. The assistant sits on that layer.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js App Router, TypeScript |
| Backend | FastAPI, SQLAlchemy, Pandas |
| Auth | JWT (`/auth/signup`, `/auth/signin`, `/auth/me`) |
| Data | SQLite locally, PostgreSQL in production |
| Deploy | Vercel frontend + proxied API, Docker / Railway-ready backend |

Frontend never talks to the backend token directly. Requests go through `frontend/app/api/backend/[...path]/route.ts`.

## Local development

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python init_db.py
python -m uvicorn app.main:app --reload
```

Optional seed:

```bash
set SEED_EXAMPLE=true
python init_db.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

### Backend (`backend/.env`)

Use `backend/.env.example`.

Production requires:

- `ENVIRONMENT=production`
- `DATABASE_URL=postgresql+asyncpg://...`
- `AUTH_JWT_SECRET`
- `ALLOWED_ORIGINS`
- `TRUSTED_HOSTS`

Common:

- `OPENAI_API_KEY`
- `OPENAI_MODEL=gpt-4o-mini`
- `AUTH_ACCESS_TOKEN_EXPIRE_MINUTES=1440`
- `MAX_UPLOAD_SIZE_BYTES=10485760`
- `OVERVIEW_CACHE_TTL_SECONDS=30`

### Frontend

- `NEXT_PUBLIC_API_BASE=/api/backend`
- `BACKEND_API_URL=http://127.0.0.1:8000`
- `BACKEND_API_TOKEN` (optional service token)
- `BACKEND_TENANT_ID=1`
- `BACKEND_USER_ID=1`

Production rejects SQLite, default hosts, and a missing JWT secret. Upload and AI routes are rate-limited. Ready probe: `GET /ready`.

## Docker

```bash
docker-compose up --build
```

Production-style:

```bash
copy .env.prod.example .env
docker-compose -f docker-compose.prod.yml up --build -d
```

## Docs

- [DEPLOYMENT.md](./DEPLOYMENT.md) — Vercel + Railway
- [docs/OPERATOR_RUNBOOK.md](./docs/OPERATOR_RUNBOOK.md) — migrations and connector sync
- [APP_BRIEF_REPORT.md](./APP_BRIEF_REPORT.md) — current product status
