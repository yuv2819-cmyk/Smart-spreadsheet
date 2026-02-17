#!/usr/bin/env sh
set -eu

# Railway/Render/etc. provide PORT. Default to 8080 for local/prod parity.
PORT="${PORT:-8080}"
WORKERS="${UVICORN_WORKERS:-2}"

exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "$PORT" \
  --workers "$WORKERS" \
  --proxy-headers

