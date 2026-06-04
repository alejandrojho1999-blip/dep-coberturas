#!/usr/bin/env bash
set -euo pipefail

FRONTEND_PORT="${PORT:-3000}"
BACKEND_PORT="${ERGO_QUANT_BACKEND_PORT:-8000}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export ERGO_QUANT_API_URL="http://127.0.0.1:${BACKEND_PORT}"

npm run start -- --hostname "${HOSTNAME}" -p "${FRONTEND_PORT}" &
frontend_pid=$!
backend_pid=""

cleanup() {
  if [ -n "${backend_pid}" ]; then
    kill "${backend_pid}" >/dev/null 2>&1 || true
  fi
  kill "${frontend_pid}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

frontend_ready=false
for _ in $(seq 1 30); do
  if python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:${FRONTEND_PORT}/', timeout=2).close()" >/dev/null 2>&1; then
    frontend_ready=true
    break
  fi

  if ! kill -0 "${frontend_pid}" >/dev/null 2>&1; then
    echo "Frontend failed to start" >&2
    exit 1
  fi

  sleep 1
done

if [ "${frontend_ready}" != "true" ]; then
  echo "Frontend did not become healthy at http://127.0.0.1:${FRONTEND_PORT}/" >&2
  exit 1
fi

python -m uvicorn main:app \
  --app-dir ergo-quant-api \
  --host 127.0.0.1 \
  --port "${BACKEND_PORT}" &

backend_pid=$!

for _ in $(seq 1 30); do
  if python -c "import urllib.request; urllib.request.urlopen('${ERGO_QUANT_API_URL}/health', timeout=2).read()" >/dev/null 2>&1; then
    break
  fi

  if ! kill -0 "${backend_pid}" >/dev/null 2>&1; then
    echo "Backend failed to start" >&2
    exit 1
  fi

  sleep 1
done

wait "${frontend_pid}"
