#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────
read -rp "Remote user: " REMOTE_USER
[[ -z "$REMOTE_USER" ]] && error "Remote user is required"
read -rp "Remote host: " REMOTE_HOST
[[ -z "$REMOTE_HOST" ]] && error "Remote host is required"
REMOTE_PATH="/opt/city-communication-center/city-communication-center"
ARCHIVE_NAME="ccc-deploy-$(date +%Y%m%d-%H%M%S).tar.gz"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ─── Colors ──────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ─── Step 1: Package ────────────────────────────────────────────
info "Packaging project..."
cd "$SCRIPT_DIR/.."
COPYFILE_DISABLE=1 tar czf "/tmp/${ARCHIVE_NAME}" \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='.keys' \
  --exclude='dist' \
  --exclude='bin' \
  --exclude='obj' \
  --exclude='.DS_Store' \
  --exclude='*.user' \
  city-communication-center/

SIZE=$(ls -lh "/tmp/${ARCHIVE_NAME}" | awk '{print $5}')
info "Archive created: /tmp/${ARCHIVE_NAME} (${SIZE})"

# ─── Step 2: Upload ─────────────────────────────────────────────
info "Uploading to ${REMOTE_USER}@${REMOTE_HOST}..."
scp "/tmp/${ARCHIVE_NAME}" "${REMOTE_USER}@${REMOTE_HOST}:/tmp/${ARCHIVE_NAME}"
info "Upload complete"

# ─── Step 3: Deploy on server ───────────────────────────────────
info "Deploying on server..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" bash -s <<EOF
  set -euo pipefail
  cd /opt/city-communication-center
  echo "  Preserving .env / .keys from current deployment..."
  BACKUP_DIR="\$(mktemp -d)"
  if [ -d city-communication-center ]; then
    [ -f city-communication-center/.env ] && cp city-communication-center/.env "\$BACKUP_DIR/.env" || true
    [ -d city-communication-center/.keys ] && cp -R city-communication-center/.keys "\$BACKUP_DIR/.keys" || true
    echo "  Removing previous source tree (volumes untouched)..."
    rm -rf city-communication-center
  fi
  echo "  Extracting archive..."
  tar xzf /tmp/${ARCHIVE_NAME} --strip-components=0
  echo "  Restoring .env / .keys..."
  [ -f "\$BACKUP_DIR/.env" ] && cp "\$BACKUP_DIR/.env" city-communication-center/.env || true
  [ -d "\$BACKUP_DIR/.keys" ] && cp -R "\$BACKUP_DIR/.keys" city-communication-center/.keys || true
  rm -rf "\$BACKUP_DIR"
  cd city-communication-center
  echo "  Building and starting containers..."
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
  echo "  Waiting for health checks..."
  sleep 10
  docker compose ps
  rm -f /tmp/${ARCHIVE_NAME}
EOF

# ─── Cleanup ─────────────────────────────────────────────────────
rm -f "/tmp/${ARCHIVE_NAME}"
info "Deployment complete! 🚀"
