# Operator Runbook

This runbook covers production-safe database migrations and connector sync operations.

## 1. Preconditions

- Backend service env vars are set (`ENVIRONMENT=production`, `DATABASE_URL`, `AUTH_JWT_SECRET`, etc.).
- Migration command runs from `backend/`.
- You have a recent database backup before any migration.

## 2. Database Migrations (Alembic)

Run these commands from `backend/`:

```bash
venv\Scripts\activate
alembic current
alembic upgrade head
alembic current
```

What to expect:
- `alembic current` before upgrade may show an older revision (or none on first run).
- `alembic upgrade head` applies pending revisions.
- `alembic current` after upgrade should match the latest revision.

If migration fails:
- Stop rollout.
- Restore from backup if needed.
- Fix migration issue in a new deployment instead of editing production tables manually.

## 3. Connector Sync Operations

The app has two sync modes:
- Internal scheduler loop at backend startup (default enabled).
- Manual/cron trigger endpoint: `POST /connectors/sync-due`.

### Recommended scheduler settings

Set in backend environment:

```bash
ENABLE_CONNECTOR_SCHEDULER=true
CONNECTOR_SCHEDULER_INTERVAL_SECONDS=120
```

### Manual trigger (for external cron/ops checks)

```bash
curl -X POST "https://<backend-domain>/connectors/sync-due?secret=<optional>"
```

Notes:
- Endpoint currently accepts `secret` query param but does not enforce validation.
- Keep the endpoint behind normal platform/network controls (ingress rules, auth layer, or private cron pathing).

## 4. Post-Deploy Verification

After deploy:

1. `GET /health` returns `{"status":"ok",...}`.
2. `GET /ready` returns `{"status":"ready"}`.
3. Run one manual connector sync (`POST /connectors/{id}/sync`) and verify:
   - `status` is `success`.
   - new dataset rows are created.
   - `last_synced_at` and sync run logs update.

## 5. Rollback Guidance

If backend app code must be rolled back:

1. Roll back application image/release first.
2. Only run DB down-migrations if the latest migration is confirmed reversible and required.
3. Prefer forward-fix migrations over frequent down-migrations in production.
