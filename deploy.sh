#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────
REMOTE_USER="tim"
REMOTE_HOST="192.168.0.36"
REMOTE_SUDO_PASS="Ts.102030"
REPO_URL="https://github.com/muratztrk/city-communication-center.git"
REMOTE_DIR="/opt/city-communication-center/city-communication-center"

# ─── Colors ──────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ─── Deploy ─────────────────────────────────────────────────────
info "Connecting to ${REMOTE_USER}@${REMOTE_HOST}..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" bash -s <<EOF
  set -euo pipefail

  if [ -d "${REMOTE_DIR}/.git" ]; then
    echo "  Pulling latest from GitHub..."
    cd "${REMOTE_DIR}"
    git pull origin main
  else
    echo "  Cloning repository..."
    mkdir -p "$(dirname ${REMOTE_DIR})"
    git clone "${REPO_URL}" "${REMOTE_DIR}"
    cd "${REMOTE_DIR}"
  fi

  echo "  Building and starting containers..."
  echo "${REMOTE_SUDO_PASS}" | sudo -S docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

  echo "  Waiting for health checks..."
  sleep 10
  echo "${REMOTE_SUDO_PASS}" | sudo -S docker compose ps
EOF

info "Deployment complete! 🚀"
