#!/bin/sh
# Safe entrypoint: run migrations with retry, then start uvicorn.
# If migrations fail, retry up to MAX_RETRIES before giving up.
# Uvicorn is exec'd so it receives signals (SIGTERM) directly for graceful shutdown.

set -e

MAX_RETRIES=${MIGRATION_RETRIES:-3}
RETRY_DELAY=${MIGRATION_RETRY_DELAY:-5}

echo "=== ERP Backend starting ==="
echo "Version: ${APP_VERSION:-dev}"
echo "Build:   ${BUILD_SHA:-unknown}"

# ── Run migrations with retry ────────────────────────────────────────────────
attempt=1
while [ $attempt -le $MAX_RETRIES ]; do
    echo "[migration] Attempt $attempt/$MAX_RETRIES..."
    if python migrate.py upgrade; then
        echo "[migration] Success."
        break
    else
        echo "[migration] Failed (attempt $attempt/$MAX_RETRIES)."
        if [ $attempt -eq $MAX_RETRIES ]; then
            echo "[migration] All $MAX_RETRIES attempts failed. Exiting."
            exit 1
        fi
        echo "[migration] Retrying in ${RETRY_DELAY}s..."
        sleep $RETRY_DELAY
        attempt=$((attempt + 1))
    fi
done

# ── Start the application ────────────────────────────────────────────────────
# exec replaces the shell so uvicorn gets PID 1 and receives SIGTERM directly
echo "[app] Starting uvicorn on port ${PORT:-8088}..."
exec uvicorn main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8088}" \
    --workers "${WORKERS:-1}" \
    --timeout-graceful-shutdown 30
