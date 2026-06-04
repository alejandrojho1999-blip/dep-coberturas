#!/usr/bin/env bash
set -euo pipefail

BACKEND_PORT="${ERGO_QUANT_BACKEND_PORT:-8000}"
export ERGO_QUANT_API_URL="${ERGO_QUANT_API_URL:-http://127.0.0.1:${BACKEND_PORT}}"

python -m uvicorn main:app \
  --app-dir ergo-quant-api \
  --host 127.0.0.1 \
  --port "${BACKEND_PORT}" &

backend_pid=$!
backend_ready=false

cleanup() {
  kill "${backend_pid}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for _ in $(seq 1 30); do
  if curl -fsS "${ERGO_QUANT_API_URL}/health" >/dev/null 2>&1; then
    backend_ready=true
    break
  fi

  if ! kill -0 "${backend_pid}" >/dev/null 2>&1; then
    echo "Backend failed to start" >&2
    exit 1
  fi

  sleep 1
done

if [ "${backend_ready}" != "true" ]; then
  echo "Backend did not become healthy at ${ERGO_QUANT_API_URL}/health" >&2
  exit 1
fi

npm run start
