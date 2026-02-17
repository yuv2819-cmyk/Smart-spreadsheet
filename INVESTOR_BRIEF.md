# SmartSheet (Working Name) - SaaS Brief (Investor / Buyer)

Date: 2026-02-17

Tagline: Upload data. Ask questions. Get business insights.

## 1) Executive Summary

SmartSheet is a lightweight business intelligence (BI) SaaS that turns CSV exports into decision-ready dashboards, profit and loss insights, and natural-language Q&A. It targets small and mid-sized teams who need answers fast but do not want to build SQL pipelines or learn complex BI tooling.

At its core, SmartSheet combines:
- A familiar spreadsheet-like grid for reviewing data
- An "Overview" dashboard that computes key metrics, trend signals, and data quality diagnostics
- An AI Analyst experience that answers questions like "Why did profit drop in March?" with a chart plus explanation, backed by deterministic analytics and optional OpenAI enrichment

## 2) What The Product Does (User Flow)

1. Create an account (workspace auto-created).
2. Upload a CSV.
3. Instantly see:
   - Profit and loss snapshot (when revenue/cost/profit columns exist)
   - Drivers, alerts, trend signals, and data quality health
   - Simple and detailed charts with plain-English explanations
4. Ask questions in natural language and receive:
   - Direct answer (analyst-style)
   - Supporting chart (when time series profit/revenue/cost can be computed)
   - Evidence and next-step recommendations
5. Generate and export an executive report (Markdown or PDF).

## 3) Core Capabilities (Implemented Today)

### A) Multi-Tenant Auth And Workspaces
- Sign up creates a new tenant workspace and an admin user.
- JWT-based authentication; password hashing via `passlib` (`pbkdf2_sha256`).
- Tenant isolation enforced by `tenant_id` on all stored datasets, rows, and AI queries.

Endpoints:
- `POST /auth/signup`
- `POST /auth/signin`
- `GET /auth/me`
- `POST /auth/logout` (stateless, for client workflow symmetry)

### B) CSV Ingest + Dataset Storage
- Upload CSV and replace the current tenant dataset (single dataset mode for MVP simplicity).
- Schema inferred and stored; data rows stored as JSON for flexible, unknown schemas.
- Configurable upload limits (default 10 MB).

Endpoints:
- `POST /datasets/upload`
- `GET /datasets/latest`
- `GET /datasets`
- `GET /datasets/{dataset_id}/data?limit=...`
- `DELETE /datasets/clear`

### C) Overview Dashboard With Business Insights
The `/overview` page computes and renders:
- Dataset stats: rows, columns, numeric stats (min/max/avg)
- Data quality: completeness, missing field hotspots, duplicate rows, inconsistent category variants
- KPI-like rollups: revenue-like totals/averages, volume-like totals/averages (heuristic column detection)
- Time trend detection (when a date-like column exists)
- Profit and loss:
  - Total revenue, total cost, total profit, profit margin %
  - Profit/loss rows count (profit vs loss vs neutral)
  - Segment-wise profit/loss breakdown (when a categorical segment exists)
- Driver highlights and alerts (deterministic, from computed signals)
- Scenario simulator (price/cost/volume what-if impact)
- Goal tracking against target revenue/profit/margin (stored in browser for MVP)

Endpoint:
- `GET /overview/metrics`

### D) Natural Language Q&A (Analyst-Style)
Users can ask questions like:
- "Why did profit drop in March?"
- "Which segments are driving losses?"

Responses include:
- A direct answer (deterministic "analyst engine" output)
- Optional chart payload (monthly revenue/cost/profit) when dates and financial columns are detected
- Explanation bullets and recommended actions
- Optional OpenAI completion (server-side) that is explicitly constrained to use provided dataset context

Endpoints:
- `POST /ai/query`
- `GET /ai/recommended-questions/{dataset_id}`
- `GET /ai/queries` (recent history per tenant)

### E) Reports (Exportable)
The "Reports" section can generate an executive report from the latest dataset and export:
- Markdown download
- PDF download (client-side PDF rendering)

Note: In the current MVP, generated reports are persisted in browser `localStorage` (not stored server-side yet).

## 4) AI Approach (Trustworthy By Default)

SmartSheet is designed to be useful even without an LLM key:
- Deterministic analytics engine computes business metrics, trends, and drivers from the dataset.
- Natural-language Q&A includes a deterministic, chart-backed answer path for common business questions.
- When an OpenAI API key is configured, the backend can enrich answers with a structured, analyst-style narrative. The UI never receives the OpenAI key.

Data handling note:
- When LLM is enabled, the backend sends only a limited dataset context (schema, sample rows, derived metrics) to the model for cost control and privacy hygiene.

## 5) Target Customers And Use Cases

Primary users:
- SMB founders and operators
- Finance and RevOps managers
- Marketing and growth leads
- Agencies handling many client exports

Common workflows:
- Upload monthly exports and track margin drift and cost creep.
- Identify loss-making segments (region, product, plan, channel).
- Ask ad-hoc questions without writing formulas or SQL.
- Generate a lightweight executive summary for weekly reviews.

## 6) Differentiation (Why This Wins)

- Spreadsheet-first UX: Familiar grid plus fast dashboarding.
- Business-first insights: Profit/loss, drivers, and alerts are first-class, not an afterthought.
- Deterministic core: Answers are grounded in computed values, reducing hallucination risk.
- LLM optionality: Works without OpenAI for demos and privacy-sensitive deployments.
- Multi-tenant foundation: Clean separation for teams and future B2B SaaS scaling.

## 7) Technology Overview (Architecture)

Frontend:
- Next.js (App Router) + TypeScript
- Charting: Recharts
- Spreadsheet grid: `react-data-grid`
- Motion/UX: `framer-motion`
- Server-side proxy route: `/api/backend/*` to keep backend tokens off the browser

Backend:
- FastAPI + async SQLAlchemy
- Pandas for deterministic analytics computations
- JWT auth (python-jose) + password hashing (passlib)
- Rate limiting (in-memory) on upload and AI routes
- Security middleware: request IDs, security headers, Trusted Host, optional HTTPS redirect
- Health endpoints: `/health`, `/ready`

Database:
- Development: SQLite (async) for fast local setup
- Production: PostgreSQL required (config validation enforces this)
- Data storage model:
  - `datasets` metadata + inferred schema
  - `data_rows` as JSON rows (flexible schema MVP)
  - `ai_queries` history per tenant/user

## 8) Security / Compliance Posture (Current)

Implemented:
- JWT auth with tenant claims
- Password hashing (strong KDF)
- CORS allowlist and Trusted Host middleware (production validation)
- Security headers + request ID correlation
- Rate limiting on upload and AI endpoints
- Production config validation to prevent insecure defaults (no SQLite, require secrets, require allowed origins, etc.)

Planned (recommended for enterprise readiness):
- Role-based permissions enforcement beyond basic role storage (admin/editor/viewer)
- Audit log for auth, dataset uploads, and exports
- Encrypted-at-rest for sensitive columns (or customer-managed keys)
- SSO/SAML for larger orgs

## 9) Deployment Options

Supported paths (docs in `DEPLOYMENT.md`):
- Split deployment:
  - Frontend: Vercel
  - Backend: Railway / Render / Fly
  - Database: managed Postgres
- Docker Compose for production-style local runs (`docker-compose.prod.yml`)

Operational endpoints:
- `GET /health` (liveness)
- `GET /ready` (DB connectivity readiness)

## 10) Known MVP Limits (Transparent)

These are deliberate tradeoffs for speed-to-demo:
- Single dataset mode per tenant (upload replaces prior data).
- Analytics computations run in-process; large datasets will require batching/aggregation strategies.
- AI analytics uses a capped sample (up to 2,500 rows) for query and summary endpoints.
- Reports and integrations are currently stored per-browser (localStorage), not server-side.
- In-memory rate limiting is per-instance (multi-instance deployments should migrate to Redis-based limiting).

## 11) Roadmap (Next 60-90 Days)

High-impact improvements for conversion to paid SaaS:
1. Persist reports and integration configs in the database (shared across devices and team members).
2. Multi-dataset support (history, versioning, comparisons, rollbacks).
3. Scheduled email/Slack reports (weekly executive summary, alert digests).
4. Stronger segmentation and drilldowns (filters, pivot-style views, cohort tables).
5. Billing and usage limits (plans based on rows, storage, AI queries, and team seats).

Enterprise-ready upgrades:
- Row-level security policies
- Audit logs and export logs
- SSO (SAML/OIDC), SCIM provisioning

## 12) Demo Script (5 Minutes)

1. Sign up and land on the Overview dashboard.
2. Upload a CSV with revenue/cost/profit and a date column.
3. Show:
   - Profit & loss snapshot and margin
   - Alerts panel and driver highlights
   - Simple trend chart and plain-English chart explanation
4. Ask the AI Analyst:
   - "Why did profit drop in March?"
   - Show chart + explanation + recommended actions.
5. Generate a Report and export PDF for sharing.

## Appendix A: API Surface (Summary)

- Auth: `/auth/*`
- Datasets: `/datasets/*`
- Overview metrics: `/overview/metrics`
- AI:
  - `/ai/query`
  - `/ai/summarize`
  - `/ai/recommended-questions/{dataset_id}`
  - `/ai/queries`
- Health: `/health`, `/ready`

## Appendix B: Naming Note

"SmartSheet" is a working name. There is a well-known SaaS in the market with a similar name; for brand and trademark risk reduction, a rename is recommended before broad distribution.

