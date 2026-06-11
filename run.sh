#!/usr/bin/env bash
# run.sh — Local development startup script
# Starts SAM local API (port 3000) and Vite dev server (port 5173) concurrently.
# Prerequisites:
#   - AWS SAM CLI installed (sam --version)
#   - Node.js 20.x installed
#   - Docker running (required by SAM local)
#   - Dependencies installed: cd backend && npm install; cd frontend && npm install

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "====================================================="
echo "  validation-4 — Local Development"
echo "====================================================="
echo ""

# ─── Preflight checks ─────────────────────────────────────────────────────────
if ! command -v sam &> /dev/null; then
  echo "ERROR: AWS SAM CLI not found. Install from https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html" >&2
  exit 1
fi

if ! command -v node &> /dev/null; then
  echo "ERROR: Node.js not found. Install Node.js 20.x from https://nodejs.org" >&2
  exit 1
fi

if ! command -v docker &> /dev/null; then
  echo "ERROR: Docker not found. SAM local requires Docker to be running." >&2
  exit 1
fi

if ! docker info &> /dev/null; then
  echo "ERROR: Docker daemon is not running. Please start Docker." >&2
  exit 1
fi

# ─── Install dependencies if needed ──────────────────────────────────────────
if [ ! -d "${ROOT_DIR}/backend/node_modules" ]; then
  echo "==> Installing backend dependencies..."
  cd "${ROOT_DIR}/backend" && npm install
  cd "${ROOT_DIR}"
fi

if [ ! -d "${ROOT_DIR}/frontend/node_modules" ]; then
  echo "==> Installing frontend dependencies..."
  cd "${ROOT_DIR}/frontend" && npm install
  cd "${ROOT_DIR}"
fi

# ─── Create env.json for SAM local ───────────────────────────────────────────
ENV_JSON="${ROOT_DIR}/env.json"
if [ ! -f "${ENV_JSON}" ]; then
  echo "==> Creating env.json for SAM local..."
  cat > "${ENV_JSON}" <<'EOF'
{
  "ListTasksFunction": {
    "TASKS_TABLE": "validation-4-tasks-local"
  },
  "CreateTaskFunction": {
    "TASKS_TABLE": "validation-4-tasks-local"
  },
  "CompleteTaskFunction": {
    "TASKS_TABLE": "validation-4-tasks-local"
  },
  "DeleteTaskFunction": {
    "TASKS_TABLE": "validation-4-tasks-local"
  }
}
EOF
  echo "    Created env.json"
fi

# ─── Create frontend/.env.local if missing ────────────────────────────────────
FRONTEND_ENV="${ROOT_DIR}/frontend/.env.local"
if [ ! -f "${FRONTEND_ENV}" ]; then
  echo "==> Creating frontend/.env.local..."
  cat > "${FRONTEND_ENV}" <<'EOF'
VITE_API_URL=http://localhost:3000
EOF
  echo "    Created frontend/.env.local"
fi

# ─── Build SAM application ────────────────────────────────────────────────────
echo "==> Building SAM application..."
cd "${ROOT_DIR}"
sam build --cached --parallel

echo ""
echo "==> Starting services..."
echo "    SAM Local API  → http://localhost:3000"
echo "    Vite Dev Server → http://localhost:5173"
echo ""
echo "    Press Ctrl+C to stop all services."
echo ""

# ─── Cleanup handler ─────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "==> Stopping all services..."
  kill "${SAM_PID}" 2>/dev/null || true
  kill "${VITE_PID}" 2>/dev/null || true
  wait "${SAM_PID}" 2>/dev/null || true
  wait "${VITE_PID}" 2>/dev/null || true
  echo "    All services stopped."
  exit 0
}
trap cleanup INT TERM

# ─── Start SAM local API ──────────────────────────────────────────────────────
sam local start-api \
  --port 3000 \
  --env-vars "${ENV_JSON}" \
  --warm-containers EAGER \
  2>&1 | sed 's/^/[SAM] /' &
SAM_PID=$!

# Give SAM a moment to initialize
sleep 3

# ─── Start Vite dev server ────────────────────────────────────────────────────
cd "${ROOT_DIR}/frontend"
npm run dev 2>&1 | sed 's/^/[Vite] /' &
VITE_PID=$!

# ─── Wait for both processes ──────────────────────────────────────────────────
wait "${SAM_PID}" "${VITE_PID}"
