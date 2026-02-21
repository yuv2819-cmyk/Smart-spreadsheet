# Smart Spreadsheet - Brief App Report

Date: 2026-02-21

## 1) What This App Is

Smart Spreadsheet is a multi-tenant SaaS analytics app for business teams that need quick insights from CSV exports without writing SQL.

It combines:
- CSV upload and dataset management
- Dashboard analytics (overview, trends, quality, KPI signals)
- AI-assisted Q&A and summaries
- Report generation and collaboration workflows
- India-focused insight mode for local business context

## 2) What The App Does Today

### Core Data Workflow
1. User signs in (workspace + tenant context).
2. Uploads CSV data.
3. App computes metrics and analyst insights.
4. User asks business questions in natural language.
5. User generates reports and shares outputs.

### Key Implemented Capabilities
- Auth and tenant-isolated workspaces (`/auth/*`).
- Dataset ingest and retrieval (`/datasets/*`).
- Overview metrics and analyst insights (`/overview/metrics`).
- AI query/summarize flows (`/ai/query`, `/ai/summarize`).
- Data cleaning profile, preview, apply, rollback (`/cleaning/*`).
- Report CRUD + sharing/comment/approval (`/reports/*`).
- India insights and India trend reporting (`/india/*`).
- Connector and workspace settings support.

## 3) Product Value

The app reduces time from "raw export" to "decision-ready summary" by combining deterministic analytics with assistant features in one workflow.

Primary value:
- Faster weekly business review cycles.
- Better visibility into margin/profit drivers.
- Clearer data quality issues before making decisions.
- Lower analytics complexity for non-technical teams.

## 4) Precision And Trust Status (Current)

The app uses deterministic backend calculations for core metrics and trends.

Recent precision upgrade includes:
- Improved parsing for messy numeric fields (currency symbols, commas, accounting negatives).
- Shared parsing logic used by overview analytics and cleaning engine.
- Precision audit metadata exposed in insights:
  - auto-coerced numeric columns
  - ignored numeric-like columns
  - coercion confidence score
- UI now shows "Precision Confidence" and precision notes.
- Automated test added for currency-formatted numeric parsing.

## 5) Tech Stack

- Frontend: Next.js + TypeScript
- Backend: FastAPI + SQLAlchemy + Pandas
- DB: SQLite (dev), PostgreSQL-ready production architecture
- Auth: JWT-based
- API proxying through Next.js backend route

## 6) Current Strengths

- Practical end-to-end analytics flow from upload to report.
- Multi-tenant structure ready for SaaS scaling.
- Deterministic insight layer reduces hallucination risk for core numbers.
- India-localized reporting makes the product region-friendly.
- Built-in cleaning and precision audit improve real-world usability.

## 7) Current Gaps

- Some advanced analytics remain heuristic for messy/unstructured schemas.
- Enterprise-grade controls can be expanded (deeper RBAC/audit depth).
- Production-scale rate limiting should move to distributed backing if needed.

## 8) Overall Assessment

Smart Spreadsheet is a solid, functional BI assistant product for SMB/mid-market operators. It is already useful for real reporting workflows and has clear differentiation through:
- combined cleaning + analytics + AI + report flow
- deterministic metric core
- India-focused insights mode

With continued UI polish and enterprise hardening, it is positioned to grow into a high-utility operational analytics platform.
